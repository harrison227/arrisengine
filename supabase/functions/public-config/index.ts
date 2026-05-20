import { withErrorHandling, jsonResponse } from '../_shared/http.ts';
import { optionalEnv } from '../_shared/env.ts';

Deno.serve(withErrorHandling({ fn: 'public-config' }, ({ log }) => {
  const publicSiteUrl = optionalEnv('VITE_PUBLIC_SITE_URL') ?? '';
  log.info('config_returned', { publicSiteUrlSet: Boolean(publicSiteUrl) });
  return jsonResponse({ publicSiteUrl }, { cacheControl: 'public, max-age=300' });
}));
