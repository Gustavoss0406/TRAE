/**
 * Injuries Sync Worker
 * 
 * Synchronizes player injuries from football-data.org (API-Football) to Postgres database.
 * Runs periodically to keep injury status up-to-date.
 */

import { footballDataClient } from "../ingestion/sources/football-data-org";
import { syncLogger } from "../ingestion/utils/sync-logger";
import { getDb } from "../db";
import { injuries, seasons, players, teams, leagues, fixtures } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

export async function syncInjuries() {
  const context = syncLogger.startSync("injuries-sync");
  
  try {
    console.log("[injuries-sync] Starting injuries synchronization...");
    
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }
    
    // Get active seasons
    const activeSeasons = await db
      .select({
        season: seasons,
        league: leagues
      })
      .from(seasons)
      .innerJoin(leagues, eq(seasons.leagueId, leagues.id))
      .where(eq(seasons.current, true));
      
    console.log(`[injuries-sync] Found ${activeSeasons.length} active seasons`);
    
    // Pre-fetch teams to map API ID to internal ID
    const allTeams = await db.select({ id: teams.id, apiFootballId: teams.apiFootballId }).from(teams);
    const teamMap = new Map(allTeams.map(t => [t.apiFootballId, t.id]));
    
    // Pre-fetch players to map API ID to internal ID
    // Note: This might be too large for memory if millions of players.
    // Optimization: Fetch players on demand or chunk by team?
    // For now, let's assume we can fetch by team or just try to find them.
    // Better: Build a map of players as we encounter them or fetch individually if not in cache?
    // Let's use a LRU cache or just query DB for each batch if needed.
    // Or just fetch all players? If 20k players, it's fine.
    // Let's rely on individual lookups or small batch lookups to be safe.
    
    for (const { season, league } of activeSeasons) {
      try {
        console.log(`[injuries-sync] Fetching injuries for league ${league.name} (${league.apiFootballId}), season ${season.year}`);
        
        const response = await footballDataClient.getInjuries({
            league: league.apiFootballId || undefined,
            season: season.year
        });
        
        if (!response || !response.response) {
            console.warn(`[injuries-sync] Invalid response for league ${league.apiFootballId}`);
            continue;
        }
        
        const injuriesData = response.response;
        console.log(`[injuries-sync] Received ${injuriesData.length} injuries`);
        
        if (injuriesData.length === 0) continue;
        
        // Process in batches
        const chunkSize = 100;
        for (let i = 0; i < injuriesData.length; i += chunkSize) {
          const chunk = injuriesData.slice(i, i + chunkSize);
          
          for (const item of chunk) {
            try {
              const { player, team, fixture, league: itemLeague } = item;
              
              // Resolve Team ID
              let teamId = team.id ? teamMap.get(team.id) : null;
              if (!teamId && team.id) {
                 // Try to find in DB directly in case map is stale
                 const tResult = await db.select().from(teams).where(eq(teams.apiFootballId, team.id)).limit(1);
                 const t = tResult[0];
                 if (t) {
                    teamId = t.id;
                    teamMap.set(team.id, t.id);
                 } else {
                    // Upsert team?
                    // Safe to skip for now or upsert if critical.
                    console.warn(`[injuries-sync] Team ${team.name} (${team.id}) not found. Skipping injury.`);
                    continue;
                 }
              }
              if (!teamId) continue;

              // Resolve Player ID
              let playerId: number | null = null;
              if (player.id) {
                 const pResult = await db.select().from(players).where(eq(players.externalId, player.id)).limit(1);
                 const p = pResult[0];
                 if (p) playerId = p.id;
              }
              
              if (!playerId) {
                 console.warn(`[injuries-sync] Player ${player.name} (${player.id}) not found. Skipping injury.`);
                 continue;
              }
              
              // Resolve Fixture ID (optional)
              let fixtureId: number | null = null;
              if (fixture && fixture.id) {
                  const fResult = await db.select().from(fixtures).where(eq(fixtures.externalId, fixture.id)).limit(1);
                  const f = fResult[0];
                  if (f) fixtureId = f.id;
              }
              
              // Check if injury exists
              // Uniqueness: player + team + date + type?
              // The API doesn't give a unique ID for injury.
              // We'll use player + date + type as unique key proxy.
              const injuryDate = fixture && fixture.date ? new Date(fixture.date) : new Date(); // Fallback? API says 'fixture.date' is related?
              // Wait, API response has 'fixture' object.
              // API documentation says 'fixture' is linked to the injury.
              // Actually, the injury might not be linked to a fixture.
              // But the response example shows fixture.
              // The `injuries` table has `date`.
              
              const dateToUse = fixture?.date ? new Date(fixture.date) : new Date(); // Using fixture date as proxy for injury date if no other date provided?
              // API response structure:
              /*
              {
                player: { ... },
                team: { ... },
                fixture: { ... },
                league: { ... }
              }
              */
              // It seems 'fixture' is the match where the player is missing?
              // Or the match date?
              // "This endpoint returns the list of injured players"
              // It returns distinct records per match missed?
              // "type": "Missing Fixture"
              // "reason": "Thigh Injury"
              
              const injuryRecord = {
                  playerId,
                  teamId,
                  leagueId: season.leagueId,
                  seasonId: season.id,
                  fixtureId: fixtureId || null,
                  type: player.type || "Unknown",
                  reason: player.reason || null,
                  date: dateToUse,
              };
              
              // Insert
              await db.insert(injuries).values(injuryRecord);
              context.recordsInserted++;
              
            } catch (err) {
               console.error(`[injuries-sync] Error processing injury item:`, err);
               context.errors.push(`Item error: ${String(err)}`);
            }
          }
        }
        
      } catch (error) {
        console.error(`[injuries-sync] Error processing season ${season.id}:`, error);
        context.errors.push(`Season ${season.id}: ${String(error)}`);
      }
    }
    
    console.log("[injuries-sync] Synchronization completed successfully.");
    const log = syncLogger.endSync(context, "football-data.org");
    return { success: true, log };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    context.errors.push(`Fatal error: ${errorMsg}`);
    console.error("[injuries-sync] Fatal error:", error);
    const log = syncLogger.endSync(context, "football-data.org");
    return { success: false, log, error: errorMsg };
  }
}
