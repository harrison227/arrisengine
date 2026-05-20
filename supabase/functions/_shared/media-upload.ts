/**
 * Media handling helpers for the Late.is sync paths.
 *
 * The post-now-to-late and sync-to-late functions both had local copies
 * of the same MIME map + base64-data-URL parser + Storage upload helper.
 * This module centralises them so a fix in one place takes effect for
 * both pathways.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

export const MIME_EXT_MAP: Readonly<Record<string, string>> = Object.freeze({
  // Images
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  // Videos
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-msvideo': 'avi',
  'video/x-matroska': 'mkv',
  'video/ogg': 'ogv',
});

export function parseBase64DataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

export interface UploadDataUrlArgs {
  supabase: SupabaseClient;
  dataUrl: string;
  clientId: string | null | undefined;
  contentPieceId: string;
  /** Bucket to upload to. Defaults to 'client-assets' (matches legacy callers). */
  bucket?: string;
  /** When true, also rewrites content_pieces.asset_url with the new public URL. */
  persistAssetUrl?: boolean;
}

export interface UploadResult { publicUrl?: string; error?: string }

export async function uploadDataUrlToPublicStorage(args: UploadDataUrlArgs): Promise<UploadResult> {
  const parsed = parseBase64DataUrl(args.dataUrl);
  if (!parsed) return { error: 'Unsupported data URL format. Please re-upload the media.' };

  const isImage = parsed.mimeType.startsWith('image/');
  const isVideo = parsed.mimeType.startsWith('video/');
  if (!isImage && !isVideo) return { error: 'Media must be re-uploaded. Only image/video uploads are supported.' };

  const estimatedBytes = Math.floor((parsed.base64.length * 3) / 4);
  if (estimatedBytes / 1024 / 1024 > 20) {
    return { error: 'Media must be re-uploaded. Inline media is too large to sync automatically (please upload the file normally).' };
  }

  const ext = MIME_EXT_MAP[parsed.mimeType] ?? (isVideo ? 'mp4' : 'png');
  const safeClientId = args.clientId ?? 'unknown-client';
  const storagePath = `${safeClientId}/auto-upload/${args.contentPieceId}-${Date.now()}.${ext}`;
  const bucket = args.bucket ?? 'client-assets';

  try {
    const binary = atob(parsed.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: parsed.mimeType });

    const { data: uploadData, error: uploadError } = await args.supabase.storage
      .from(bucket)
      .upload(storagePath, blob, {
        contentType: parsed.mimeType,
        cacheControl: '3600',
        upsert: false,
      });
    if (uploadError || !uploadData) return { error: uploadError?.message ?? 'Failed to upload media to storage' };

    const { data: urlData } = args.supabase.storage.from(bucket).getPublicUrl(uploadData.path);
    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) return { error: 'Failed to generate public media URL' };

    if (args.persistAssetUrl) {
      await args.supabase
        .from('content_pieces')
        .update({ asset_url: publicUrl, late_error_message: null })
        .eq('id', args.contentPieceId);
    }

    return { publicUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: `Failed to process inline media: ${message}` };
  }
}
