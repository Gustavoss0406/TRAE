/**
 * Cache Strategy
 * 
 * Multi-layer caching for Football Data Platform:
 * - Edge Cache (Cloudflare Cache API): 1-5 minutes
 * - D1 Database: Always available as fallback
 * 
 * Note: KV Store integration will be added in future iteration
 */

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  staleWhileRevalidate?: number; // Serve stale data while fetching fresh
}

export const CACHE_CONFIG: Record<string, CacheConfig> = {
  // Fixtures
  fixtures_live: {
    ttl: 60, // 1 minute for live fixtures
    staleWhileRevalidate: 30,
  },
  fixtures_upcoming: {
    ttl: 300, // 5 minutes for upcoming fixtures
    staleWhileRevalidate: 60,
  },
  fixtures_finished: {
    ttl: 3600, // 1 hour for finished fixtures
    staleWhileRevalidate: 300,
  },
  
  // Standings
  standings: {
    ttl: 3600, // 1 hour
    staleWhileRevalidate: 600,
  },
  
  // Players
  players: {
    ttl: 21600, // 6 hours
    staleWhileRevalidate: 3600,
  },
  
  // Static data
  countries: {
    ttl: 86400, // 24 hours
  },
  leagues: {
    ttl: 86400, // 24 hours
  },
  teams: {
    ttl: 43200, // 12 hours
  },
  timezones: {
    ttl: 86400, // 24 hours
  },
};

/**
 * Get cache key for a resource
 */
export function getCacheKey(resource: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join("&");
  
  return `${resource}:${sortedParams}`;
}

/**
 * Get cache config for a resource
 */
export function getCacheConfig(resource: string, status?: string): CacheConfig {
  // Special handling for fixtures based on status
  if (resource === "fixtures") {
    if (status === "FT" || status === "AET" || status === "PEN") {
      return CACHE_CONFIG.fixtures_finished;
    } else if (status === "LIVE" || status === "1H" || status === "HT" || status === "2H" || status === "ET" || status === "P") {
      return CACHE_CONFIG.fixtures_live;
    } else {
      return CACHE_CONFIG.fixtures_upcoming;
    }
  }
  
  return CACHE_CONFIG[resource] || { ttl: 300 }; // Default 5 minutes
}

/**
 * Check if cached data is stale
 */
export function isStale(cachedAt: Date, ttl: number): boolean {
  const now = Date.now();
  const cacheTime = cachedAt.getTime();
  const age = (now - cacheTime) / 1000; // Age in seconds
  
  return age > ttl;
}

/**
 * Check if we should serve stale data while revalidating
 */
export function shouldServeStale(cachedAt: Date, config: CacheConfig): boolean {
  if (!config.staleWhileRevalidate) {
    return false;
  }
  
  const now = Date.now();
  const cacheTime = cachedAt.getTime();
  const age = (now - cacheTime) / 1000; // Age in seconds
  
  return age > config.ttl && age < (config.ttl + config.staleWhileRevalidate);
}

/**
 * Get cache headers for HTTP response
 */
export function getCacheHeaders(config: CacheConfig, isStaleData: boolean = false): Record<string, string> {
  const headers: Record<string, string> = {
    "Cache-Control": `public, max-age=${config.ttl}`,
  };
  
  if (config.staleWhileRevalidate) {
    headers["Cache-Control"] += `, stale-while-revalidate=${config.staleWhileRevalidate}`;
  }
  
  if (isStaleData) {
    headers["X-Data-Stale"] = "true";
    headers["X-Cache-Status"] = "STALE";
  } else {
    headers["X-Cache-Status"] = "FRESH";
  }
  
  return headers;
}
