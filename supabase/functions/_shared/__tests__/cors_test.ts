/**
 * Smoke tests for CORS helpers.
 */

import { assert, assertEquals } from 'https://deno.land/std@0.218.0/assert/mod.ts';
import { CORS_HEADERS, buildCorsHeaders, handlePreflight } from '../cors.ts';

Deno.test('CORS_HEADERS includes Allow-Origin, Allow-Headers, Allow-Methods, Max-Age', () => {
  assertEquals(CORS_HEADERS['Access-Control-Allow-Origin'], '*');
  assert(CORS_HEADERS['Access-Control-Allow-Headers'].includes('authorization'));
  assert(CORS_HEADERS['Access-Control-Allow-Headers'].includes('content-type'));
  assert(CORS_HEADERS['Access-Control-Allow-Methods'].includes('POST'));
  assertEquals(CORS_HEADERS['Access-Control-Max-Age'], '86400');
});

Deno.test('buildCorsHeaders accepts extra headers', () => {
  const h = buildCorsHeaders({ extraAllowHeaders: ['stripe-signature'] });
  assert(h['Access-Control-Allow-Headers'].includes('stripe-signature'));
});

Deno.test('handlePreflight returns 204 for OPTIONS, null otherwise', () => {
  const opts = handlePreflight(new Request('https://example.com', { method: 'OPTIONS' }));
  assertEquals(opts?.status, 204);

  const get = handlePreflight(new Request('https://example.com', { method: 'GET' }));
  assertEquals(get, null);
});
