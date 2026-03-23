import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getCachedPublicSiteUrl } from "./publicConfig";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Gets the public site URL for share links.
 *
 * Fallback chain:
 * 1. If running on a Lovable preview/localhost domain, use the current origin (so previews work).
 * 2. Vite env variable (build-time) (typically your production domain)
 * 3. Cached backend config (runtime)
 * 4. Current window origin
 */
export function getPublicSiteUrl(): string {
  const host = window.location.hostname;

  // Use the current origin on Lovable hosts/localhost so testing works without publishing.
  // (Works for both preview and published .lovable.app domains.)
  const isLovableHost = host.endsWith('.lovable.app') || host.endsWith('.lovableproject.com');
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';

  if (isLovableHost || isLocalHost) {
    return window.location.origin;
  }

  if (import.meta.env.VITE_PUBLIC_SITE_URL) {
    return import.meta.env.VITE_PUBLIC_SITE_URL;
  }

  const cached = getCachedPublicSiteUrl();
  if (cached) {
    return cached;
  }

  return window.location.origin;
}
