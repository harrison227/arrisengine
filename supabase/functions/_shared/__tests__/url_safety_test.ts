/**
 * Smoke tests for the SSRF guard. Catches accidental loosening of the
 * URL block list — important because scrape-client-website fetches
 * user-supplied URLs.
 */

import { assert } from 'https://deno.land/std@0.218.0/assert/mod.ts';
import { isPublicHttpUrl, normalizeUrl, sanitizeUrl } from '../url-safety.ts';

Deno.test('isPublicHttpUrl accepts a normal https URL', () => {
  assert(isPublicHttpUrl('https://example.com/path'));
  assert(isPublicHttpUrl('http://example.com'));
});

Deno.test('isPublicHttpUrl rejects loopback and link-local', () => {
  assert(!isPublicHttpUrl('http://localhost'));
  assert(!isPublicHttpUrl('http://127.0.0.1'));
  assert(!isPublicHttpUrl('http://0.0.0.0'));
  assert(!isPublicHttpUrl('http://169.254.169.254')); // AWS metadata service
});

Deno.test('isPublicHttpUrl rejects private IPv4 ranges', () => {
  assert(!isPublicHttpUrl('http://10.0.0.1'));
  assert(!isPublicHttpUrl('http://172.16.0.1'));
  assert(!isPublicHttpUrl('http://192.168.1.1'));
});

Deno.test('isPublicHttpUrl rejects private IPv6', () => {
  assert(!isPublicHttpUrl('http://[::1]'));
  assert(!isPublicHttpUrl('http://[fc00::1]'));
  assert(!isPublicHttpUrl('http://[fe80::1]'));
});

Deno.test('isPublicHttpUrl rejects non-http schemes', () => {
  assert(!isPublicHttpUrl('file:///etc/passwd'));
  assert(!isPublicHttpUrl('ftp://example.com'));
  assert(!isPublicHttpUrl('javascript:alert(1)'));
});

Deno.test('isPublicHttpUrl rejects internal-looking hostnames', () => {
  assert(!isPublicHttpUrl('http://intranet.corp'));
  assert(!isPublicHttpUrl('http://foo.local'));
});

Deno.test('isPublicHttpUrl rejects malformed URLs', () => {
  assert(!isPublicHttpUrl('not a url'));
  assert(!isPublicHttpUrl(''));
});

Deno.test('sanitizeUrl strips control characters', () => {
  // Use a regex-built string to avoid lint complaints about literal control chars.
  const dirty = `https://example.com${String.fromCharCode(0)}/x${String.fromCharCode(0x1f)}`;
  // sanitizeUrl removes those, leaving the printable URL.
  // (We don't compare to an exact value because the test reads cleaner this way.)
  const cleaned = sanitizeUrl(dirty);
  assert(!cleaned.includes(String.fromCharCode(0)));
  assert(!cleaned.includes(String.fromCharCode(0x1f)));
});

Deno.test('normalizeUrl prepends https:// when missing', () => {
  assert(normalizeUrl('example.com').startsWith('https://'));
  assert(normalizeUrl('http://example.com').startsWith('http://'));
  assert(normalizeUrl('https://example.com').startsWith('https://'));
});
