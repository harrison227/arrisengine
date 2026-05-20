/**
 * Transcribe a video / audio clip via OpenAI Whisper.
 *
 * Contract preserved:
 *   Request:  { audioBase64?, mimeType?, videoUrl? }
 *   Response: { transcript } | { transcript:'', warning } | { error }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { badRequest, rateLimited, upstream } from '../_shared/errors.ts';
import { ensureOptionalString } from '../_shared/validation.ts';
import { requireUser } from '../_shared/auth.ts';
import { requireEnv } from '../_shared/env.ts';
import { timeoutSignal } from '../_shared/retry.ts';

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';
const MAX_BYTES = 25 * 1024 * 1024;

interface RequestBody { audioBase64?: unknown; mimeType?: unknown; videoUrl?: unknown }

function extensionFor(mimeType: string | undefined): string {
  const m = (mimeType ?? '').toLowerCase();
  if (m.includes('wav') || m.includes('wave')) return 'wav';
  if (m.includes('webm')) return 'webm';
  if (m.includes('mp3') || m.includes('mpeg')) return 'mp3';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('m4a') || m.includes('mp4')) return 'm4a';
  return 'webm';
}

Deno.serve(withErrorHandling({ fn: 'transcribe-video' }, async ({ req, log }) => {
  await requireUser(req);
  const apiKey = requireEnv('OPENAI_API_KEY');
  const body = await parseJsonBody<RequestBody>(req);
  const audioBase64 = ensureOptionalString('audioBase64', body.audioBase64, 50_000_000);
  const mimeType = ensureOptionalString('mimeType', body.mimeType, 200);
  const videoUrl = ensureOptionalString('videoUrl', body.videoUrl, 4_000);

  let audioBlob: Blob;
  let extension = 'webm';

  if (audioBase64) {
    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    audioBlob = new Blob([bytes], { type: mimeType || 'audio/webm' });
    extension = extensionFor(mimeType);
    log.info('audio_blob_decoded', { size: audioBlob.size, extension });
  } else if (videoUrl) {
    const res = await fetch(videoUrl, { signal: timeoutSignal(60_000) });
    if (!res.ok) throw badRequest('Failed to fetch video file');
    audioBlob = await res.blob();
    const urlExt = new URL(videoUrl).pathname.split('.').pop()?.toLowerCase();
    if (urlExt && ['mp4', 'mov', 'webm', 'avi', 'm4a', 'mp3', 'wav'].includes(urlExt)) extension = urlExt;
    log.info('video_fetched', { size: audioBlob.size, extension });
  } else {
    throw badRequest('Either audioBase64 or videoUrl is required');
  }

  if (audioBlob.size > MAX_BYTES) {
    log.warn('audio_too_large', { size: audioBlob.size });
    return jsonResponse({
      transcript: '',
      warning: 'Audio exceeds 25MB limit for transcription. Caption will need to be written manually.',
    });
  }

  const formData = new FormData();
  formData.append('file', audioBlob, `audio.${extension}`);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'text');

  const res = await fetch(WHISPER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
    signal: timeoutSignal(120_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 429) throw rateLimited('Rate limit exceeded. Please try again later.');
    log.error('whisper_failed', undefined, { status: res.status, body: text.slice(0, 500) });
    throw upstream('Transcription failed', 502, { details: text.slice(0, 500) });
  }
  const transcript = (await res.text()).trim();
  log.info('transcription_done', { length: transcript.length });
  return jsonResponse({ transcript });
}));
