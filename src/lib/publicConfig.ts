import { supabase } from "@/integrations/supabase/client";

interface PublicConfig {
  publicSiteUrl: string;
}

let cachedConfig: PublicConfig | null = null;
let fetchPromise: Promise<PublicConfig | null> | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function invokePublicConfigOnce() {
  return supabase.functions.invoke("public-config");
}

async function invokePublicConfigWithRetry(): Promise<
  Awaited<ReturnType<typeof invokePublicConfigOnce>>
> {
  const first = await invokePublicConfigOnce();
  if (!first.error) return first;

  // One quick retry handles transient CORS/proxy hiccups.
  await sleep(1500);
  return invokePublicConfigOnce();
}

/**
 * Fetches public config from the backend and caches it.
 * Returns cached value if available.
 */
export async function fetchPublicConfig(): Promise<PublicConfig | null> {
  // Return cached value if available
  if (cachedConfig) {
    return cachedConfig;
  }

  // If a fetch is already in progress, wait for it
  if (fetchPromise) {
    return fetchPromise;
  }

  // Try localStorage first for faster initial load
  const stored = localStorage.getItem("publicConfig");
  if (stored) {
    try {
      cachedConfig = JSON.parse(stored);
      // Still fetch in background to refresh
      refreshConfigInBackground();
      return cachedConfig;
    } catch {
      localStorage.removeItem("publicConfig");
    }
  }

  // Fetch from backend
  fetchPromise = (async () => {
    try {
      const { data, error } = await invokePublicConfigWithRetry();

      if (error) {
        console.error("Failed to fetch public config:", error);
        return null;
      }

      if (data?.publicSiteUrl) {
        cachedConfig = data as PublicConfig;
        localStorage.setItem("publicConfig", JSON.stringify(cachedConfig));
        return cachedConfig;
      }

      return null;
    } catch (err) {
      console.error("Error fetching public config:", err);
      return null;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

function refreshConfigInBackground() {
  invokePublicConfigWithRetry()
    .then(({ data, error }) => {
      if (!error && data?.publicSiteUrl) {
        cachedConfig = data as PublicConfig;
        localStorage.setItem("publicConfig", JSON.stringify(cachedConfig));
      }
    })
    .catch(() => {
      // Silent fail for background refresh
    });
}

/**
 * Gets the cached public site URL synchronously.
 * Returns undefined if not yet cached.
 */
export function getCachedPublicSiteUrl(): string | undefined {
  if (cachedConfig?.publicSiteUrl) {
    return cachedConfig.publicSiteUrl;
  }

  // Try localStorage
  const stored = localStorage.getItem("publicConfig");
  if (stored) {
    try {
      const config = JSON.parse(stored);
      if (config?.publicSiteUrl) {
        cachedConfig = config;
        return config.publicSiteUrl;
      }
    } catch {
      // Ignore parse errors
    }
  }

  return undefined;
}

/**
 * Initialize config fetch on app startup
 */
export function initPublicConfig(): void {
  fetchPublicConfig();
}
