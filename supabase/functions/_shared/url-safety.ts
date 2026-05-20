/**
 * SSRF guard. Validates that a user-supplied URL is safe to fetch from
 * an edge function — i.e. is http/https and is not pointing at a
 * private / link-local / loopback address.
 *
 * Originally lived inside scrape-client-website. Moved here so any
 * future function that fetches external URLs can opt in.
 */

const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

const BLOCKED_DOMAIN_FRAGMENTS = ['internal', 'intranet', 'localhost', 'local'];

export function isPublicHttpUrl(input: string): boolean {
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    // Deno (WHATWG-compliant) wraps IPv6 hostnames in brackets, e.g.
    // `http://[::1]/`.hostname === '[::1]'. Strip them before pattern
    // matching so `/^::1$/` and friends actually match.
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return false;
    if (PRIVATE_IP_PATTERNS.some((re) => re.test(host))) return false;
    if (BLOCKED_DOMAIN_FRAGMENTS.some((frag) => host.includes(frag))) return false;
    return true;
  } catch {
    return false;
  }
}

export function sanitizeUrl(raw: string): string {
  // eslint-disable-next-line no-control-regex -- intentional: strip C0 controls + DEL
  return raw.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

/** Normalises a URL string by adding https:// when missing. */
export function normalizeUrl(raw: string): string {
  const cleaned = sanitizeUrl(raw);
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) return `https://${cleaned}`;
  return cleaned;
}
