/**
 * Structured logger with per-request correlation IDs.
 *
 * Why: the codebase had ~530 ad-hoc console.log calls with inconsistent
 * shapes and no way to tie a single request's log lines together. This
 * module emits one structured JSON line per call, attaches a request_id,
 * and offers level filtering via LOG_LEVEL env var.
 *
 * Usage:
 *   const log = createLogger('generate-caption', { requestId: ... });
 *   log.info('parsed_request', { clientId });
 *   log.error('upstream_error', err, { provider: 'anthropic' });
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function getLevelThreshold(): number {
  const raw = (Deno.env.get('LOG_LEVEL') ?? 'info').toLowerCase() as Level;
  return LEVEL_ORDER[raw] ?? LEVEL_ORDER.info;
}

const THRESHOLD = getLevelThreshold();

export interface Logger {
  requestId: string;
  fn: string;
  child(extra: Record<string, unknown>): Logger;
  debug(event: string, fields?: Record<string, unknown>): void;
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, err?: unknown, fields?: Record<string, unknown>): void;
}

export function newRequestId(): string {
  return crypto.randomUUID();
}

export function createLogger(fn: string, base: Record<string, unknown> = {}): Logger {
  const requestId = (base.requestId as string | undefined) ?? newRequestId();
  const baseFields = { ...base, requestId, fn };

  function emit(level: Level, event: string, fields?: Record<string, unknown>) {
    if (LEVEL_ORDER[level] < THRESHOLD) return;
    const line = {
      level,
      ts: new Date().toISOString(),
      event,
      ...baseFields,
      ...(fields ?? {}),
    };
    const json = JSON.stringify(line);
    if (level === 'error' || level === 'warn') {
      console.error(json);
    } else {
      console.log(json);
    }
  }

  return {
    requestId,
    fn,
    child(extra: Record<string, unknown>): Logger {
      return createLogger(fn, { ...baseFields, ...extra });
    },
    debug(event, fields) { emit('debug', event, fields); },
    info(event, fields) { emit('info', event, fields); },
    warn(event, fields) { emit('warn', event, fields); },
    error(event, err, fields) {
      const errFields: Record<string, unknown> = { ...(fields ?? {}) };
      if (err instanceof Error) {
        errFields.err_message = err.message;
        errFields.err_name = err.name;
        // stack is intentionally omitted from the response, but kept in logs
        errFields.err_stack = err.stack;
      } else if (err !== undefined) {
        errFields.err = String(err);
      }
      emit('error', event, errFields);
    },
  };
}
