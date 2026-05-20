/**
 * Single source of truth for CORS handling across all edge functions.
 *
 * Why: previously every function defined its own CORS map with subtle
 * differences (some missing Allow-Methods, some adding stripe-signature,
 * some omitting Max-Age). This file collapses that into one constant and
 * one preflight helper so a CORS bug only ever needs to be fixed once.
 */

const ALLOW_HEADERS_DEFAULT = [
  'authorization',
  'x-client-info',
  'apikey',
  'content-type',
  'x-request-id',
];

export interface CorsOptions {
  /** Extra request headers a function expects (e.g. 'stripe-signature'). */
  extraAllowHeaders?: string[];
  /** Override allowed methods. Defaults to the full set. */
  allowMethods?: string[];
}

export function buildCorsHeaders(options: CorsOptions = {}): Record<string, string> {
  const allowHeaders = [
    ...ALLOW_HEADERS_DEFAULT,
    ...(options.extraAllowHeaders ?? []),
  ].join(', ');
  const allowMethods = (options.allowMethods ?? ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']).join(', ');
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': allowHeaders,
    'Access-Control-Allow-Methods': allowMethods,
    'Access-Control-Max-Age': '86400',
  };
}

/** Default headers used by 95% of functions. Use buildCorsHeaders() if you need extras. */
export const CORS_HEADERS = buildCorsHeaders();

/**
 * Returns a 204 preflight response if the request is OPTIONS, otherwise null.
 * Usage:
 *   const pre = handlePreflight(req);
 *   if (pre) return pre;
 */
export function handlePreflight(req: Request, headers: Record<string, string> = CORS_HEADERS): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }
  return null;
}
