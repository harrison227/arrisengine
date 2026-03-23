import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPublicSiteUrl } from '@/lib/utils';

/**
 * Redirects users from non-production hosts (like lovableproject.com preview domains)
 * to the canonical production domain for public-facing pages.
 * 
 * This ensures there's only ONE public UI experience - on the production domain.
 * 
 * @param enabled - Whether redirect should be active (default: true)
 * @returns void
 * 
 * To bypass redirect for testing, add ?dev=1 to the URL
 */
export function useCanonicalRedirect(enabled = true) {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!enabled) return;

    // Allow dev override to bypass redirect for testing
    if (searchParams.get('dev') === '1') {
      return;
    }

    const productionUrl = getPublicSiteUrl();
    const currentOrigin = window.location.origin;

    // If we're already on production, do nothing
    if (productionUrl === currentOrigin) {
      return;
    }

    // If production URL is just the fallback (same as current), do nothing
    // This handles the case where no production domain is configured
    if (!import.meta.env.VITE_PUBLIC_SITE_URL) {
      return;
    }

    // Redirect to production domain, preserving path and query string
    const redirectUrl = new URL(window.location.pathname + window.location.search, productionUrl);
    
    // Perform redirect
    window.location.replace(redirectUrl.toString());
  }, [enabled, searchParams]);
}
