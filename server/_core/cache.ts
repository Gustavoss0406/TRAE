/**
 * Multi-layer caching utilities for Football Data Platform
 * 
 * Implements a 3-layer caching strategy:
 * 1. Edge Cache (Cloudflare CDN) - for complete API responses
 * 2. KV Store - for hot data fragments
 * 3. Database (D1) - persistent cache and source of truth
 */

import { Request, Response } from "express";

/**
 * Cache TTL (Time-To-Live) configurations in seconds
 */
export const CACHE_TTL = {
  // Static data - rarely changes
  STATIC: 24 * 60 * 60, // 24 hours
  COUNTRIES: 7 * 24 * 60 * 60, // 7 days
  VENUES: 7 * 24 * 60 * 60, // 7 days
  
  // Semi-dynamic data - changes periodically
  LEAGUES: 24 * 60 * 60, // 24 hours
  TEAMS: 24 * 60 * 60, // 24 hours
  STANDINGS: 3 * 60 * 60, // 3 hours
  SEASONS: 24 * 60 * 60, // 24 hours
  
  // Dynamic data - changes frequently
  FIXTURES_UPCOMING: 60 * 60, // 1 hour
  FIXTURES_FINISHED: 24 * 60 * 60, // 24 hours
  FIXTURES_LIVE: 60, // 1 minute
  
  // Player and team statistics
  PLAYER_STATS: 6 * 60 * 60, // 6 hours
  TEAM_STATS: 6 * 60 * 60, // 6 hours
  
  // Predictions and odds
  PREDICTIONS: 60 * 60, // 1 hour
  ODDS: 60 * 60, // 1 hour
} as const;

/**
 * Generate a cache key from request parameters
 */
export function generateCacheKey(endpoint: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join("&");
  
  return `api:${endpoint}:${sortedParams}`;
}

/**
 * Set cache headers for edge caching
 */
export function setCacheHeaders(res: Response, ttl: number, tags?: string[]) {
  // Set Cache-Control header for edge caching
  res.setHeader("Cache-Control", `public, max-age=${ttl}, s-maxage=${ttl}`);
  
  // Set cache tags for purging (if supported)
  if (tags && tags.length > 0) {
    res.setHeader("Cache-Tag", tags.join(","));
  }
  
  // Set ETag for conditional requests
  // Note: ETag should be generated based on response content
  // This is a placeholder - implement proper ETag generation
  res.setHeader("ETag", `W/"${Date.now()}"`);
}

/**
 * Check if request has valid cache
 */
export function hasValidCache(req: Request): boolean {
  const ifNoneMatch = req.headers["if-none-match"];
  const etag = req.headers["etag"];
  
  if (ifNoneMatch && etag && ifNoneMatch === etag) {
    return true;
  }
  
  return false;
}

/**
 * Determine cache TTL based on fixture status
 */
export function getFixtureCacheTTL(status: string): number {
  const liveStatuses = ["LIVE", "HT", "ET", "P", "SUSP", "INT"];
  const finishedStatuses = ["FT", "AET", "PEN", "FT_PEN"];
  
  if (liveStatuses.includes(status)) {
    return CACHE_TTL.FIXTURES_LIVE;
  } else if (finishedStatuses.includes(status)) {
    return CACHE_TTL.FIXTURES_FINISHED;
  } else {
    return CACHE_TTL.FIXTURES_UPCOMING;
  }
}

/**
 * Cache middleware for Express routes
 */
export function cacheMiddleware(ttl: number, tags?: string[]) {
  return (req: Request, res: Response, next: Function) => {
    // Check if client has valid cache
    if (hasValidCache(req)) {
      return res.status(304).end();
    }
    
    // Set cache headers
    setCacheHeaders(res, ttl, tags);
    
    next();
  };
}

/**
 * Invalidate cache by tags
 * Note: This is a placeholder - actual implementation depends on caching infrastructure
 */
export async function invalidateCacheByTags(tags: string[]): Promise<void> {
  // TODO: Implement cache invalidation
  // This would typically call Cloudflare's purge API or similar
  console.log(`Cache invalidation requested for tags: ${tags.join(", ")}`);
}

/**
 * KV Store helper (placeholder for Cloudflare KV integration)
 */
export class KVCache {
  /**
   * Get value from KV store
   */
  static async get<T>(key: string): Promise<T | null> {
    // TODO: Implement KV store integration
    // For now, return null (cache miss)
    return null;
  }
  
  /**
   * Set value in KV store with TTL
   */
  static async set(key: string, value: any, ttl: number): Promise<void> {
    // TODO: Implement KV store integration
    console.log(`KV Cache SET: ${key} (TTL: ${ttl}s)`);
  }
  
  /**
   * Delete value from KV store
   */
  static async delete(key: string): Promise<void> {
    // TODO: Implement KV store integration
    console.log(`KV Cache DELETE: ${key}`);
  }
  
  /**
   * Delete multiple keys by prefix
   */
  static async deleteByPrefix(prefix: string): Promise<void> {
    // TODO: Implement KV store integration
    console.log(`KV Cache DELETE BY PREFIX: ${prefix}`);
  }
}
