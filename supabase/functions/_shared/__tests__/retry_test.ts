/**
 * Smoke tests for retry + timeout helpers.
 */

import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.218.0/assert/mod.ts';
import { timeoutSignal, withRetry } from '../retry.ts';

Deno.test('withRetry returns the value on first success', async () => {
  let attempts = 0;
  const result = await withRetry(async () => { attempts++; return 'ok'; });
  assertEquals(result, 'ok');
  assertEquals(attempts, 1);
});

Deno.test('withRetry retries and eventually succeeds', async () => {
  let attempts = 0;
  const result = await withRetry(async () => {
    attempts++;
    if (attempts < 3) throw new Error('transient');
    return 'finally';
  }, { attempts: 5, baseMs: 1 });
  assertEquals(result, 'finally');
  assertEquals(attempts, 3);
});

Deno.test('withRetry stops after attempts exhausted', async () => {
  let attempts = 0;
  await assertRejects(
    () => withRetry(async () => { attempts++; throw new Error('always'); }, { attempts: 3, baseMs: 1 }),
    Error,
    'always',
  );
  assertEquals(attempts, 3);
});

Deno.test('withRetry honours shouldRetry predicate', async () => {
  let attempts = 0;
  await assertRejects(
    () => withRetry(async () => { attempts++; throw new Error('fatal'); }, {
      attempts: 5,
      baseMs: 1,
      shouldRetry: (err) => !(err as Error).message.includes('fatal'),
    }),
    Error,
    'fatal',
  );
  // Should have attempted exactly once because shouldRetry returned false.
  assertEquals(attempts, 1);
});

Deno.test('timeoutSignal aborts after the deadline', async () => {
  const signal = timeoutSignal(20);
  await new Promise((r) => setTimeout(r, 50));
  assert(signal.aborted);
});
