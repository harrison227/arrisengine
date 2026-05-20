/**
 * Typed errors and standard error builders.
 *
 * Throw an HttpError anywhere inside an edge function — the
 * withErrorHandling() wrapper in http.ts will translate it into the
 * correct status code + JSON body. Anything that isn't an HttpError is
 * treated as a 500 with a generic message (the underlying error is
 * logged but never leaked to the client).
 */

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, 'bad_request', message, details);

export const unauthorized = (message = 'Unauthorized') =>
  new HttpError(401, 'unauthorized', message);

export const forbidden = (message = 'Forbidden') =>
  new HttpError(403, 'forbidden', message);

export const notFound = (message = 'Not found') =>
  new HttpError(404, 'not_found', message);

export const conflict = (message: string) =>
  new HttpError(409, 'conflict', message);

export const rateLimited = (message: string, waitSeconds?: number) =>
  new HttpError(429, 'rate_limited', message, waitSeconds !== undefined ? { waitTime: waitSeconds } : undefined);

export const upstream = (message: string, status = 502, details?: unknown) =>
  new HttpError(status, 'upstream_error', message, details);

export const internal = (message = 'Internal server error') =>
  new HttpError(500, 'internal_error', message);
