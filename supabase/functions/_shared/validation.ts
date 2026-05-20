/**
 * Lightweight, allocation-free validators that previously lived as
 * duplicated `isValidUUID` / `sanitizeString` helpers inside ~8 edge
 * functions. Throw HttpError(badRequest) on invalid input so the
 * withErrorHandling wrapper produces a consistent 400 response.
 */

import { badRequest } from './errors.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function ensureUuid(name: string, value: unknown): string {
  if (!isUuid(value)) throw badRequest(`${name} must be a valid UUID`);
  return value;
}

export function ensureOptionalUuid(name: string, value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return ensureUuid(name, value);
}

export function ensureString(name: string, value: unknown, opts: { min?: number; max?: number } = {}): string {
  if (typeof value !== 'string') throw badRequest(`${name} must be a string`);
  const min = opts.min ?? 0;
  const max = opts.max ?? Number.POSITIVE_INFINITY;
  if (value.length < min) throw badRequest(`${name} must be at least ${min} characters`);
  if (value.length > max) throw badRequest(`${name} must be at most ${max} characters`);
  return value;
}

export function ensureNonEmptyString(name: string, value: unknown, max = 10_000): string {
  return ensureString(name, value, { min: 1, max });
}

export function ensureOptionalString(name: string, value: unknown, max = 10_000): string | undefined {
  if (value === undefined || value === null) return undefined;
  return ensureString(name, value, { max });
}

export function ensureEnum<T extends string>(name: string, value: unknown, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw badRequest(`${name} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

export function ensureOptionalEnum<T extends string>(name: string, value: unknown, allowed: readonly T[]): T | undefined {
  if (value === undefined || value === null) return undefined;
  return ensureEnum(name, value, allowed);
}

export function ensureArray<T>(
  name: string,
  value: unknown,
  itemValidator: (item: unknown, index: number) => T,
  opts: { min?: number; max?: number } = {},
): T[] {
  if (!Array.isArray(value)) throw badRequest(`${name} must be an array`);
  const min = opts.min ?? 0;
  const max = opts.max ?? 1_000;
  if (value.length < min) throw badRequest(`${name} must contain at least ${min} items`);
  if (value.length > max) throw badRequest(`${name} must contain at most ${max} items`);
  return value.map(itemValidator);
}

export function ensureOptionalArray<T>(
  name: string,
  value: unknown,
  itemValidator: (item: unknown, index: number) => T,
  opts: { min?: number; max?: number } = {},
): T[] | undefined {
  if (value === undefined || value === null) return undefined;
  return ensureArray(name, value, itemValidator, opts);
}

export function ensureBoolean(name: string, value: unknown): boolean {
  if (typeof value !== 'boolean') throw badRequest(`${name} must be a boolean`);
  return value;
}

export function ensureOptionalBoolean(name: string, value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  return ensureBoolean(name, value);
}

export function ensureNumber(name: string, value: unknown, opts: { min?: number; max?: number; integer?: boolean } = {}): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw badRequest(`${name} must be a finite number`);
  if (opts.integer && !Number.isInteger(value)) throw badRequest(`${name} must be an integer`);
  if (opts.min !== undefined && value < opts.min) throw badRequest(`${name} must be ≥ ${opts.min}`);
  if (opts.max !== undefined && value > opts.max) throw badRequest(`${name} must be ≤ ${opts.max}`);
  return value;
}

/**
 * Strip control characters that have no business in user input. Allows
 * standard whitespace (newline, tab, carriage return).
 */
export function sanitizeString(value: string, maxLength = 10_000): string {
  // eslint-disable-next-line no-control-regex -- intentional: strip non-printable controls (preserves \n \r \t)
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, maxLength);
}

export function ensureRecord(name: string, value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw badRequest(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}
