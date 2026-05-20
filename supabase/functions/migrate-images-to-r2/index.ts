/**
 * One-shot migration helper that copies images from Supabase Storage to
 * Cloudflare R2 in small batches and rewrites the database URL.
 *
 * Contract preserved:
 *   Request:  { batchSize? } (1-10, default 10)
 *   Response: { success, migrated, skipped, errors, remaining, message }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { unauthorized } from '../_shared/errors.ts';
import { ensureNumber } from '../_shared/validation.ts';
import { getSupabaseAdmin, getUserIdFromAuth } from '../_shared/supabase.ts';
import { optionalEnv, SUPABASE_URL } from '../_shared/env.ts';
import { uploadToR2 } from '../_shared/cloudinary-upload.ts';
import { timeoutSignal } from '../_shared/retry.ts';

interface RequestBody { batchSize?: unknown }
interface MigrationItem { table: string; id: string; field: string; url: string; folder: string }

function extensionFromContentType(contentType: string): string {
  if (contentType.includes('jpeg')) return 'jpg';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  if (contentType.includes('avif')) return 'avif';
  return 'png';
}

Deno.serve(withErrorHandling({ fn: 'migrate-images-to-r2' }, async ({ req, log }) => {
  // Require authenticated caller; this is an admin-style operation.
  const userId = await getUserIdFromAuth(req);
  if (!userId) throw unauthorized();

  const body = await parseJsonBody<RequestBody>(req);
  const requestedBatch = body.batchSize === undefined ? 10 : ensureNumber('batchSize', body.batchSize, { integer: true, min: 1, max: 10 });
  const BATCH_SIZE = Math.min(Math.max(requestedBatch, 1), 10);

  const supabase = getSupabaseAdmin();
  const r2PublicUrl = optionalEnv('R2_PUBLIC_URL') ?? '';
  const supabaseStorageDomain = new URL(SUPABASE_URL()).hostname;

  const needsMigration = (url: string | null): boolean => {
    if (!url) return false;
    if (r2PublicUrl && url.startsWith(r2PublicUrl)) return false;
    return url.includes(supabaseStorageDomain) || url.includes('supabase.co/storage');
  };

  const migrateUrl = async (url: string, folder: string): Promise<string | null> => {
    try {
      const response = await fetch(url, { signal: timeoutSignal(60_000) });
      if (!response.ok) {
        log.warn('source_fetch_failed', { url, status: response.status });
        return null;
      }
      const contentType = response.headers.get('content-type') ?? 'image/png';
      const ext = extensionFromContentType(contentType);
      if (!response.body) return null;
      const result = await uploadToR2({ stream: response.body, contentType }, { folder, filename: `${crypto.randomUUID()}.${ext}` });
      return result.uploaded ? result.url : null;
    } catch (err) {
      log.error('migration_fetch_error', err, { url });
      return null;
    }
  };

  const [batchCountRes, revisionCountRes, assetCountRes] = await Promise.all([
    supabase.from('image_batch_items').select('id', { count: 'exact', head: true }).like('generated_image_url', '%supabase.co/storage%'),
    supabase.from('image_batch_revisions').select('id', { count: 'exact', head: true }).like('image_url', '%supabase.co/storage%'),
    supabase.from('assets').select('id', { count: 'exact', head: true }).like('thumbnail_url', '%supabase.co/storage%'),
  ]);
  const totalRemainingBefore = (batchCountRes.count ?? 0) + (revisionCountRes.count ?? 0) + (assetCountRes.count ?? 0);

  const nextItems: MigrationItem[] = [];

  const { data: nextBatchItems } = await supabase
    .from('image_batch_items')
    .select('id, generated_image_url, created_at')
    .like('generated_image_url', '%supabase.co/storage%')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);
  for (const item of nextBatchItems ?? []) {
    if (nextItems.length >= BATCH_SIZE) break;
    if (needsMigration(item.generated_image_url)) {
      nextItems.push({ table: 'image_batch_items', id: item.id, field: 'generated_image_url', url: item.generated_image_url, folder: 'batch-items' });
    }
  }

  if (nextItems.length < BATCH_SIZE) {
    const { data } = await supabase
      .from('image_batch_revisions')
      .select('id, image_url, created_at')
      .like('image_url', '%supabase.co/storage%')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE - nextItems.length);
    for (const item of data ?? []) {
      if (nextItems.length >= BATCH_SIZE) break;
      if (needsMigration(item.image_url)) {
        nextItems.push({ table: 'image_batch_revisions', id: item.id, field: 'image_url', url: item.image_url, folder: 'revisions' });
      }
    }
  }

  if (nextItems.length < BATCH_SIZE) {
    const { data } = await supabase
      .from('assets')
      .select('id, thumbnail_url, created_at')
      .like('thumbnail_url', '%supabase.co/storage%')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE - nextItems.length);
    for (const item of data ?? []) {
      if (nextItems.length >= BATCH_SIZE) break;
      if (needsMigration(item.thumbnail_url)) {
        nextItems.push({ table: 'assets', id: item.id, field: 'thumbnail_url', url: item.thumbnail_url, folder: 'assets' });
      }
    }
  }

  if (nextItems.length === 0) {
    return jsonResponse({ success: true, migrated: 0, skipped: 0, errors: 0, remaining: 0, message: 'All images are already migrated.' });
  }

  let migratedCount = 0;
  let errorCount = 0;
  for (const item of nextItems) {
    try {
      const newUrl = await migrateUrl(item.url, item.folder);
      if (!newUrl) { errorCount++; continue; }
      const { error: updateError } = await supabase.from(item.table).update({ [item.field]: newUrl }).eq('id', item.id);
      if (updateError) {
        log.error('row_update_failed', updateError, { table: item.table, id: item.id });
        errorCount++;
      } else {
        migratedCount++;
      }
    } catch (err) {
      log.error('migrate_loop_error', err, { id: item.id });
      errorCount++;
    }
  }

  const remaining = Math.max(totalRemainingBefore - migratedCount, 0);
  log.info('migration_batch_done', { migrated: migratedCount, errors: errorCount, remaining });

  return jsonResponse({
    success: true,
    migrated: migratedCount,
    skipped: 0,
    errors: errorCount,
    remaining,
    message: `Migrated ${migratedCount} images, ${errorCount} errors, ${remaining} remaining (batch size ${BATCH_SIZE})`,
  });
}));
