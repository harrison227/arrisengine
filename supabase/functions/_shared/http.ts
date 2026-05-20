/**
 * HTTP helpers: response builders, body parsing, error-handling wrapper.
 *
 * The withErrorHandling wrapper is the spine of every refactored edge
 * function — it sets up CORS, generates a request id, runs the body,
 * and translates any HttpError into a sane JSON response. Generic
 * Errors are logged in full but reported to clients as 500 'internal_error'
 * to avoid leaking stack traces.
 */

import { HttpError, badRequest, internal } from './errors.ts';
import { CORS_HEADERS, handlePreflight } from './cors.ts';
import { createLogger, type Logger, newRequestId } from './logger.ts';

export interface JsonResponseInit {
  status?: number;
  headers?: Record<string, string>;
  cacheControl?: string;
}

export function jsonResponse(body: unknown, init: JsonResponseInit = {}): Response {
  const headers: Record<string, string> = {
    ...CORS_HEADERS,
    ...(init.headers ?? {}),
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (init.cacheControl) headers['Cache-Control'] = init.cacheControl;
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

export function errorResponse(err: HttpError, requestId: string, corsHeaders: Record<string, string> = CORS_HEADERS): Response {
  const body: Record<string, unknown> = {
    error: err.message,
    code: err.code,
    requestId,
  };
  if (err.details !== undefined) body.details = err.details;
  return new Response(JSON.stringify(body), {
    status: err.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function parseJsonBody<T = unknown>(req: Request): Promise<T> {
  if (req.method === 'GET' || req.method === 'HEAD') return {} as T;
  const text = await req.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw badRequest('Invalid JSON in request body');
  }
}

export interface HandlerContext {
  req: Request;
  log: Logger;
  requestId: string;
  corsHeaders: Record<string, string>;
}

export type Handler = (ctx: HandlerContext) => Promise<Response> | Response;

export interface WithErrorHandlingOptions {
  fn: string;
  corsHeaders?: Record<string, string>;
}

/**
 * Wrap a handler with CORS, preflight, request-ID, structured logging
 * and error translation. Every refactored function calls Deno.serve(withErrorHandling({fn}, handler)).
 */
export function withErrorHandling(options: WithErrorHandlingOptions, handler: Handler) {
  const corsHeaders = options.corsHeaders ?? CORS_HEADERS;
  return async (req: Request): Promise<Response> => {
    const pre = handlePreflight(req, corsHeaders);
    if (pre) return pre;

    const requestId = req.headers.get('x-request-id') ?? newRequestId();
    const log = createLogger(options.fn, { requestId, method: req.method });

    try {
      const response = await handler({ req, log, requestId, corsHeaders });
      // Always set the request-id header on success responses for client correlation.
      if (!response.headers.has('x-request-id')) {
        response.headers.set('x-request-id', requestId);
      }
      return response;
    } catch (err) {
      if (err instanceof HttpError) {
        log.warn('http_error', { status: err.status, code: err.code, msg: err.message });
        return errorResponse(err, requestId, corsHeaders);
      }
      log.error('unhandled_error', err);
      return errorResponse(internal(), requestId, corsHeaders);
    }
  };
}
