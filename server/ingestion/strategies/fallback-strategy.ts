/**
 * Fallback Strategy
 * 
 * Handles scenarios when upstream (football-data.org) is unavailable.
 * Always returns data from D1 database, never returns 503 errors.
 */

import { getDb } from "../../db";
import { isStale, shouldServeStale, getCacheConfig } from "./cache-strategy";

export interface FallbackResult<T> {
  data: T | null;
  source: "upstream" | "cache" | "d1_fallback";
  isStale: boolean;
  age?: number; // Age of data in seconds
  error?: string;
}

/**
 * Execute with fallback to D1
 * 
 * Tries to fetch from upstream, falls back to D1 if upstream fails.
 */
export async function executeWithFallback<T>(
  upstreamFn: () => Promise<T>,
  fallbackFn: () => Promise<T | null>,
  resource: string,
  status?: string
): Promise<FallbackResult<T>> {
  const config = getCacheConfig(resource, status);
  
  try {
    // Try upstream first
    const data = await upstreamFn();
    
    return {
      data,
      source: "upstream",
      isStale: false,
    };
  } catch (upstreamError) {
    console.warn(`[Fallback] Upstream failed for ${resource}, falling back to D1:`, upstreamError);
    
    try {
      // Fallback to D1
      const fallbackData = await fallbackFn();
      
      if (!fallbackData) {
        return {
          data: null,
          source: "d1_fallback",
          isStale: true,
          error: "No data available in D1",
        };
      }
      
      // Check if data is stale
      const cachedAt = (fallbackData as any).updatedAt || (fallbackData as any).createdAt;
      const dataIsStale = cachedAt ? isStale(new Date(cachedAt), config.ttl) : true;
      const age = cachedAt ? (Date.now() - new Date(cachedAt).getTime()) / 1000 : undefined;
      
      return {
        data: fallbackData,
        source: "d1_fallback",
        isStale: dataIsStale,
        age,
      };
    } catch (fallbackError) {
      console.error(`[Fallback] D1 fallback also failed for ${resource}:`, fallbackError);
      
      return {
        data: null,
        source: "d1_fallback",
        isStale: true,
        error: `Both upstream and D1 failed: ${fallbackError}`,
      };
    }
  }
}

/**
 * Execute with stale-while-revalidate pattern
 * 
 * Serves stale data immediately while fetching fresh data in background.
 */
export async function executeWithStaleWhileRevalidate<T>(
  upstreamFn: () => Promise<T>,
  fallbackFn: () => Promise<T | null>,
  revalidateFn: (data: T) => Promise<void>,
  resource: string,
  status?: string
): Promise<FallbackResult<T>> {
  const config = getCacheConfig(resource, status);
  
  try {
    // Get cached data from D1
    const cachedData = await fallbackFn();
    
    if (!cachedData) {
      // No cached data, fetch from upstream
      const data = await upstreamFn();
      return {
        data,
        source: "upstream",
        isStale: false,
      };
    }
    
    const cachedAt = (cachedData as any).updatedAt || (cachedData as any).createdAt;
    const dataIsStale = cachedAt ? isStale(new Date(cachedAt), config.ttl) : true;
    const canServeStale = cachedAt ? shouldServeStale(new Date(cachedAt), config) : false;
    
    if (!dataIsStale) {
      // Data is fresh, return it
      return {
        data: cachedData,
        source: "cache",
        isStale: false,
      };
    }
    
    if (canServeStale) {
      // Serve stale data and revalidate in background
      upstreamFn()
        .then(freshData => revalidateFn(freshData))
        .catch(error => console.error(`[StaleWhileRevalidate] Background revalidation failed:`, error));
      
      return {
        data: cachedData,
        source: "cache",
        isStale: true,
        age: cachedAt ? (Date.now() - new Date(cachedAt).getTime()) / 1000 : undefined,
      };
    }
    
    // Data is too stale, fetch fresh data
    try {
      const freshData = await upstreamFn();
      return {
        data: freshData,
        source: "upstream",
        isStale: false,
      };
    } catch (error) {
      // Upstream failed, return stale data anyway
      console.warn(`[StaleWhileRevalidate] Upstream failed, serving stale data:`, error);
      return {
        data: cachedData,
        source: "d1_fallback",
        isStale: true,
        age: cachedAt ? (Date.now() - new Date(cachedAt).getTime()) / 1000 : undefined,
      };
    }
  } catch (error) {
    console.error(`[StaleWhileRevalidate] Fatal error:`, error);
    
    // Last resort: try upstream
    try {
      const data = await upstreamFn();
      return {
        data,
        source: "upstream",
        isStale: false,
      };
    } catch (upstreamError) {
      return {
        data: null,
        source: "d1_fallback",
        isStale: true,
        error: `All strategies failed: ${error}`,
      };
    }
  }
}
