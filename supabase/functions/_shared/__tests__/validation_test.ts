/**
 * Smoke tests for the validation helpers. Run via:
 *   deno test --allow-env supabase/functions/_shared/__tests__/
 *
 * These exist to catch silent regressions if anyone touches validation.ts —
 * e.g. accidentally weakening the UUID regex.
 */

import { assert, assertEquals, assertThrows } from 'https://deno.land/std@0.218.0/assert/mod.ts';
import {
  ensureArray,
  ensureBoolean,
  ensureEnum,
  ensureNonEmptyString,
  ensureNumber,
  ensureOptionalString,
  ensureUuid,
  isUuid,
  sanitizeString,
} from '../validation.ts';

const VALID_UUID = '12345678-1234-1234-9234-123456789012';

Deno.test('isUuid accepts a valid v4-shaped UUID', () => {
  assert(isUuid(VALID_UUID));
});

Deno.test('isUuid rejects non-string and non-UUID input', () => {
  assert(!isUuid(undefined));
  assert(!isUuid(null));
  assert(!isUuid(''));
  assert(!isUuid('not-a-uuid'));
  assert(!isUuid('12345678-1234-1234-1234-12345678901z'));
});

Deno.test('ensureUuid throws on invalid', () => {
  assertThrows(() => ensureUuid('id', 'nope'), Error, 'id must be a valid UUID');
});

Deno.test('ensureUuid returns the value when valid', () => {
  assertEquals(ensureUuid('id', VALID_UUID), VALID_UUID);
});

Deno.test('ensureNonEmptyString enforces both min and max', () => {
  assertEquals(ensureNonEmptyString('s', 'hi'), 'hi');
  assertThrows(() => ensureNonEmptyString('s', ''), Error, 'must be at least 1');
  assertThrows(() => ensureNonEmptyString('s', 'x'.repeat(20), 10), Error, 'must be at most 10');
});

Deno.test('ensureOptionalString skips undefined and null', () => {
  assertEquals(ensureOptionalString('s', undefined), undefined);
  assertEquals(ensureOptionalString('s', null), undefined);
  assertEquals(ensureOptionalString('s', 'x'), 'x');
});

Deno.test('ensureEnum enforces membership', () => {
  const allowed = ['a', 'b', 'c'] as const;
  assertEquals(ensureEnum('e', 'b', allowed), 'b');
  assertThrows(() => ensureEnum('e', 'd', allowed), Error, 'must be one of: a, b, c');
});

Deno.test('ensureArray enforces min/max and runs item validator', () => {
  const result = ensureArray('arr', ['a', 'b'], (v, i) => ensureNonEmptyString(`arr[${i}]`, v));
  assertEquals(result, ['a', 'b']);
  assertThrows(() => ensureArray('arr', 'not-an-array', () => null), Error, 'must be an array');
  assertThrows(() => ensureArray('arr', [], () => null, { min: 1 }), Error, 'must contain at least 1');
});

Deno.test('ensureNumber rejects NaN, infinity, and out-of-range', () => {
  assertEquals(ensureNumber('n', 5), 5);
  assertThrows(() => ensureNumber('n', NaN), Error, 'finite');
  assertThrows(() => ensureNumber('n', Infinity), Error, 'finite');
  assertThrows(() => ensureNumber('n', 5, { max: 4 }), Error, '≤ 4');
  assertThrows(() => ensureNumber('n', 5, { min: 6 }), Error, '≥ 6');
  assertThrows(() => ensureNumber('n', 5.5, { integer: true }), Error, 'integer');
});

Deno.test('ensureBoolean rejects non-booleans', () => {
  assertEquals(ensureBoolean('b', true), true);
  assertEquals(ensureBoolean('b', false), false);
  assertThrows(() => ensureBoolean('b', 'true' as unknown), Error, 'must be a boolean');
  assertThrows(() => ensureBoolean('b', 1 as unknown), Error, 'must be a boolean');
});

Deno.test('sanitizeString strips control chars and respects max length', () => {
  assertEquals(sanitizeString('hello\x00world'), 'helloworld');
  assertEquals(sanitizeString('keep\nnewlines\tand\rtabs'), 'keep\nnewlines\tand\rtabs');
  assertEquals(sanitizeString('a'.repeat(20), 5), 'aaaaa');
});
