/**
 * Smoke tests for the Late.is helper.
 *
 * We test the post-id extractor and platform map without making real
 * network calls — those are end-to-end tests, not unit tests.
 */

import { assertEquals } from 'https://deno.land/std@0.218.0/assert/mod.ts';
import { extractLatePostId, mapPlatform, PLATFORM_MAP } from '../late.ts';

Deno.test('extractLatePostId reads {post: {_id}}', () => {
  assertEquals(extractLatePostId({ post: { _id: 'abc' } }), 'abc');
});

Deno.test('extractLatePostId reads {post: {id}}', () => {
  assertEquals(extractLatePostId({ post: { id: 'def' } }), 'def');
});

Deno.test('extractLatePostId reads top-level _id and id', () => {
  assertEquals(extractLatePostId({ _id: 'xyz' }), 'xyz');
  assertEquals(extractLatePostId({ id: '123' }), '123');
});

Deno.test('extractLatePostId returns null for unknown shapes', () => {
  assertEquals(extractLatePostId(null), null);
  assertEquals(extractLatePostId(undefined), null);
  assertEquals(extractLatePostId({}), null);
  assertEquals(extractLatePostId('a string'), null);
});

Deno.test('mapPlatform passes through known platforms', () => {
  assertEquals(mapPlatform('instagram'), 'instagram');
  assertEquals(mapPlatform('tiktok'), 'tiktok');
});

Deno.test('mapPlatform collapses stories variants to base', () => {
  assertEquals(mapPlatform('instagram_stories'), 'instagram');
  assertEquals(mapPlatform('facebook_stories'), 'facebook');
});

Deno.test('mapPlatform leaves unknown platforms unchanged', () => {
  assertEquals(mapPlatform('mastodon'), 'mastodon');
});

Deno.test('PLATFORM_MAP is frozen', () => {
  // ts will complain if we try to mutate it; runtime should also throw.
  let threw = false;
  try {
    (PLATFORM_MAP as unknown as Record<string, string>).new_platform = 'x';
  } catch {
    threw = true;
  }
  // Frozen objects throw in strict mode; this is the documented behaviour.
  // We don't assert threw because in non-strict it silently fails — the
  // important invariant is that the map didn't change.
  assertEquals((PLATFORM_MAP as Record<string, string | undefined>).new_platform, undefined);
});
