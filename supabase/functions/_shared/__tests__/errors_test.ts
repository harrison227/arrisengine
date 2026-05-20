/**
 * Smoke tests for the typed error builders.
 */

import { assert, assertEquals } from 'https://deno.land/std@0.218.0/assert/mod.ts';
import {
  HttpError,
  badRequest,
  conflict,
  forbidden,
  internal,
  notFound,
  rateLimited,
  unauthorized,
  upstream,
} from '../errors.ts';

Deno.test('HttpError carries status, code, message', () => {
  const err = new HttpError(418, 'teapot', 'short and stout', { foo: 1 });
  assert(err instanceof Error);
  assertEquals(err.status, 418);
  assertEquals(err.code, 'teapot');
  assertEquals(err.message, 'short and stout');
  assertEquals(err.details, { foo: 1 });
});

Deno.test('badRequest builds a 400', () => {
  const e = badRequest('nope');
  assertEquals(e.status, 400);
  assertEquals(e.code, 'bad_request');
});

Deno.test('unauthorized builds a 401', () => {
  assertEquals(unauthorized().status, 401);
  assertEquals(unauthorized().code, 'unauthorized');
});

Deno.test('forbidden builds a 403', () => {
  assertEquals(forbidden().status, 403);
});

Deno.test('notFound builds a 404', () => {
  assertEquals(notFound().status, 404);
});

Deno.test('conflict builds a 409', () => {
  assertEquals(conflict('clash').status, 409);
});

Deno.test('rateLimited carries waitTime in details', () => {
  const e = rateLimited('slow down', 30);
  assertEquals(e.status, 429);
  assertEquals(e.details, { waitTime: 30 });
});

Deno.test('upstream defaults to 502 but accepts overrides', () => {
  assertEquals(upstream('msg').status, 502);
  assertEquals(upstream('msg', 503).status, 503);
});

Deno.test('internal defaults to 500', () => {
  assertEquals(internal().status, 500);
});
