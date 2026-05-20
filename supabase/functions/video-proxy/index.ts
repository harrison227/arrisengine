/**
 * Video proxy: streams a remote video through the edge with Range support
 * and CORS for the in-app player.
 *
 * Contract preserved:
 *   GET ?url=<encoded video url>
 *   Honours `Range` header, propagates Content-Range / Accept-Ranges.
 */

import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';
import { createLogger, newRequestId } from '../_shared/logger.ts';
import { timeoutSignal } from '../_shared/retry.ts';

const corsHeaders = buildCorsHeaders({
  extraAllowHeaders: ['range'],
  allowMethods: ['GET', 'OPTIONS'],
});
corsHeaders['Access-Control-Expose-Headers'] = 'Content-Length, Content-Range, Accept-Ranges';

Deno.serve(async (req) => {
  const pre = handlePreflight(req, corsHeaders);
  if (pre) return pre;

  const requestId = req.headers.get('x-request-id') ?? newRequestId();
  const log = createLogger('video-proxy', { requestId });

  try {
    const url = new URL(req.url);
    const target = url.searchParams.get('url');
    if (!target) {
      return new Response(JSON.stringify({ error: 'Missing url parameter', requestId }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const range = req.headers.get('Range');
    const fetchHeaders: Record<string, string> = {};
    if (range) fetchHeaders['Range'] = range;

    const upstreamRes = await fetch(target, { headers: fetchHeaders, signal: timeoutSignal(120_000) });
    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      log.warn('upstream_failed', { status: upstreamRes.status });
      return new Response(JSON.stringify({ error: 'Failed to fetch video', requestId }), {
        status: upstreamRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': upstreamRes.headers.get('Content-Type') ?? 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
      'x-request-id': requestId,
    };
    const cl = upstreamRes.headers.get('Content-Length');
    if (cl) responseHeaders['Content-Length'] = cl;
    const cr = upstreamRes.headers.get('Content-Range');
    if (cr) responseHeaders['Content-Range'] = cr;

    return new Response(upstreamRes.body, { status: upstreamRes.status, headers: responseHeaders });
  } catch (err) {
    log.error('proxy_error', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message, requestId }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
