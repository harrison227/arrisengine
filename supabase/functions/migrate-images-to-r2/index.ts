import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { uploadToR2 } from '../_shared/cloudinary-upload.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const r2PublicUrl = Deno.env.get('R2_PUBLIC_URL') || '';
    const supabaseStorageDomain = new URL(supabaseUrl).hostname;
    const requestedBatchSize = Number((await req.clone().json().catch(() => ({})))?.batchSize ?? 10);
    const BATCH_SIZE = Math.min(Math.max(requestedBatchSize, 1), 10);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let remaining = 0;

    // Helper: check if URL is from internal storage and not already on R2
    const needsMigration = (url: string | null): boolean => {
      if (!url) return false;
      if (r2PublicUrl && url.startsWith(r2PublicUrl)) return false;
      return url.includes(supabaseStorageDomain) || url.includes('supabase.co/storage');
    };

    // Helper: infer extension by content type
    const extensionFromContentType = (contentType: string): string => {
      if (contentType.includes('jpeg')) return 'jpg';
      if (contentType.includes('webp')) return 'webp';
      if (contentType.includes('gif')) return 'gif';
      if (contentType.includes('avif')) return 'avif';
      return 'png';
    };

    // Helper: fetch image from URL and upload to R2
    const migrateUrl = async (url: string, folder: string): Promise<string | null> => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.error(`Failed to fetch ${url}: ${response.status}`);
          return null;
        }
        const contentType = response.headers.get('content-type') || 'image/png';
        const ext = extensionFromContentType(contentType);
        if (!response.body) {
          console.error(`No response body for ${url}`);
          return null;
        }

        const result = await uploadToR2(
          { stream: response.body, contentType },
          { folder, filename: `${crypto.randomUUID()}.${ext}` }
        );
        if (result.uploaded) {
          return result.url;
        }
        return null;
      } catch (err) {
        console.error(`Migration error for ${url}:`, err);
        return null;
      }
    };

    // Get true global remaining count (not windowed)
    const [batchCountRes, revisionCountRes, assetCountRes] = await Promise.all([
      supabase.from('image_batch_items').select('id', { count: 'exact', head: true }).like('generated_image_url', '%supabase.co/storage%'),
      supabase.from('image_batch_revisions').select('id', { count: 'exact', head: true }).like('image_url', '%supabase.co/storage%'),
      supabase.from('assets').select('id', { count: 'exact', head: true }).like('thumbnail_url', '%supabase.co/storage%'),
    ]);

    const totalRemainingBefore =
      (batchCountRes.count || 0) +
      (revisionCountRes.count || 0) +
      (assetCountRes.count || 0);

    type MigrationItem = { table: string; id: string; field: string; url: string; folder: string };
    const nextItems: MigrationItem[] = [];

    const { data: nextBatchItems } = await supabase
      .from('image_batch_items')
      .select('id, generated_image_url, created_at')
      .like('generated_image_url', '%supabase.co/storage%')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    for (const item of nextBatchItems ?? []) {
      if (nextItems.length >= BATCH_SIZE) break;
      if (item.generated_image_url && needsMigration(item.generated_image_url)) {
        nextItems.push({
          table: 'image_batch_items',
          id: item.id,
          field: 'generated_image_url',
          url: item.generated_image_url,
          folder: 'batch-items',
        });
      }
    }

    if (nextItems.length < BATCH_SIZE) {
      const { data: nextRevisions } = await supabase
        .from('image_batch_revisions')
        .select('id, image_url, created_at')
        .like('image_url', '%supabase.co/storage%')
        .order('created_at', { ascending: true })
        .limit(BATCH_SIZE - nextItems.length);

      for (const item of nextRevisions ?? []) {
        if (nextItems.length >= BATCH_SIZE) break;
        if (item.image_url && needsMigration(item.image_url)) {
          nextItems.push({
            table: 'image_batch_revisions',
            id: item.id,
            field: 'image_url',
            url: item.image_url,
            folder: 'revisions',
          });
        }
      }
    }

    if (nextItems.length < BATCH_SIZE) {
      const { data: nextAssets } = await supabase
        .from('assets')
        .select('id, thumbnail_url, created_at')
        .like('thumbnail_url', '%supabase.co/storage%')
        .order('created_at', { ascending: true })
        .limit(BATCH_SIZE - nextItems.length);

      for (const item of nextAssets ?? []) {
        if (nextItems.length >= BATCH_SIZE) break;
        if (item.thumbnail_url && needsMigration(item.thumbnail_url)) {
          nextItems.push({
            table: 'assets',
            id: item.id,
            field: 'thumbnail_url',
            url: item.thumbnail_url,
            folder: 'assets',
          });
        }
      }
    }

    if (nextItems.length === 0) {
      remaining = 0;
      return new Response(
        JSON.stringify({
          success: true,
          migrated: 0,
          skipped: 0,
          errors: 0,
          remaining,
          message: 'All images are already migrated.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (const item of nextItems) {
      try {
        console.log(`Migrating ${item.table}/${item.id}...`);
        const newUrl = await migrateUrl(item.url, item.folder);
        if (!newUrl) {
          errorCount++;
          continue;
        }

        const { error: updateError } = await supabase
          .from(item.table)
          .update({ [item.field]: newUrl })
          .eq('id', item.id);

        if (updateError) {
          console.error(`Update failed for ${item.table}/${item.id}:`, updateError);
          errorCount++;
        } else {
          migratedCount++;
        }
      } catch (err) {
        console.error(`Error migrating ${item.id}:`, err);
        errorCount++;
      }
    }

    remaining = Math.max(totalRemainingBefore - migratedCount, 0);

    return new Response(
      JSON.stringify({
        success: true,
        migrated: migratedCount,
        skipped: skippedCount,
        errors: errorCount,
        remaining,
        message: `Migrated ${migratedCount} images, skipped ${skippedCount} (already on R2), ${errorCount} errors, ${remaining} remaining (batch size ${BATCH_SIZE})`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
