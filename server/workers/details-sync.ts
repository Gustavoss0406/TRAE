/**
 * Details Sync Worker
 * 
 * Synchronizes fixture details (events, lineups, statistics) from football-data.org to D1 database.
 * Runs every 30 minutes to keep match details up-to-date.
 */

import { footballDataClient } from "../ingestion/sources/football-data-org";
import { syncLogger } from "../ingestion/utils/sync-logger";
import { getDb } from "../db";
import { fixtures, fixtureEvents, fixtureLineups, fixtureStatistics, fixturePlayerStatistics, teams, players } from "../../drizzle/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export async function syncFixtureDetails() {
  const context = syncLogger.startSync("details-sync");
  
  try {
    console.log("[details-sync] Starting fixture details synchronization...");
    
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }
    
    const homeTeam = alias(teams, "homeTeam");
    const awayTeam = alias(teams, "awayTeam");

    // Get fixtures that need details sync (recent and live fixtures)
    const recentFixtures = await db
      .select({
        fixture: fixtures,
        homeTeam: homeTeam,
        awayTeam: awayTeam
      })
      .from(fixtures)
      .innerJoin(homeTeam, eq(fixtures.homeTeamId, homeTeam.id))
      .innerJoin(awayTeam, eq(fixtures.awayTeamId, awayTeam.id))
      .where(
        or(
          inArray(fixtures.statusShort, ["NS", "1H", "HT", "2H", "ET", "P", "FT", "AET", "PEN"]),
          eq(fixtures.statusShort, "LIVE")
        )
      )
      .limit(10); // Reduced limit to avoid rate limiting
    
    console.log(`[details-sync] Found ${recentFixtures.length} fixtures to sync details`);
    
    // Process each fixture
    for (const { fixture, homeTeam, awayTeam } of recentFixtures) {
      try {
        context.recordsProcessed++;
        
        console.log(`[details-sync] Syncing details for fixture ${fixture.id} (Ext: ${fixture.externalId})`);
        
        if (!fixture.externalId) {
             console.warn(`[details-sync] Fixture ${fixture.id} has no external ID. Skipping.`);
             continue;
        }

        const teamMap = new Map<number, number>();
        if (homeTeam.apiFootballId) teamMap.set(homeTeam.apiFootballId, homeTeam.id);
        if (awayTeam.apiFootballId) teamMap.set(awayTeam.apiFootballId, awayTeam.id);

        // Sync events
        await syncFixtureEvents(db, fixture.id, fixture.externalId, teamMap, context);
        
        // Sync lineups
        await syncFixtureLineups(db, fixture.id, fixture.externalId, teamMap, context);
        
        // Sync statistics
        await syncFixtureStatistics(db, fixture.id, fixture.externalId, teamMap, context);
        
        // Sync player statistics
        await syncFixturePlayerStatistics(db, fixture.id, fixture.externalId, teamMap, context);
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        context.errors.push(`Fixture ${fixture.id}: ${errorMsg}`);
        console.error(`[details-sync] Error processing fixture ${fixture.id}:`, error);
      }
    }
    
    const log = syncLogger.endSync(context, "football-data.org");
    
    return {
      success: true,
      log,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    context.errors.push(`Fatal error: ${errorMsg}`);
    console.error("[details-sync] Fatal error:", error);
    
    const log = syncLogger.endSync(context, "football-data.org");
    
    return {
      success: false,
      log,
      error: errorMsg,
    };
  }
}

async function syncFixtureEvents(db: any, fixtureId: number, externalFixtureId: number, teamMap: Map<number, number>, context: any) {
  try {
    console.log(`[details-sync] Fetching events for fixture ${fixtureId} (API: ${externalFixtureId})`);
    
    const response = await footballDataClient.getFixtureEvents(externalFixtureId);
    
    if (!response || !response.response || response.response.length === 0) {
      console.log(`[details-sync] No events found for fixture ${fixtureId}`);
      return;
    }
    
    const eventsData = response.response; // getFixtureEvents returns array of events directly? Check client.
    // Client: return response.data;
    // API: response: [ { ...event... }, ... ]
    // Wait, earlier code said: response.response[0]?.events ??
    // API-Football /fixtures/events returns an array of events directly in response field.
    // Let's check `football-data-org.ts` again?
    // "getFixtureEvents" -> "/fixtures/events"
    // Documentation says response is an array of objects.
    // BUT the previous code had `response.response[0]?.events`.
    // Maybe it was confused with /fixtures? 
    // Let's assume response.response IS the array of events.
    
    // Actually, let's verify `football-data-org.ts` implementation for `getFixtureEvents`.
    // It calls `/fixtures/events`.
    // Response format: { get:..., parameters:..., errors:..., results:..., paging:..., response: [ { time:..., team:..., player:..., assist:..., type:..., detail:..., comments:... } ] }
    // So response.response is the array of events.
    
    // The previous code `response.response[0]?.events` looked suspicious.
    // Let's assume `response.response` is the array.

    const eventsDataArray = response.response;
    console.log(`[details-sync] Received ${eventsDataArray.length} events for fixture ${fixtureId}`);
    
    // Delete existing events for this fixture
    await db.delete(fixtureEvents).where(eq(fixtureEvents.fixtureId, fixtureId));
    
    if (eventsDataArray.length === 0) return;

    // Fetch player mappings for all players in events
    const playerExternalIds = new Set<number>();
    eventsDataArray.forEach((event: any) => {
      if (event.player?.id) playerExternalIds.add(event.player.id);
      if (event.assist?.id) playerExternalIds.add(event.assist.id);
    });

    const playerMap = new Map<number, number>();
    if (playerExternalIds.size > 0) {
      const existingPlayers = await db.select({ id: players.id, externalId: players.externalId })
        .from(players)
        .where(inArray(players.externalId, Array.from(playerExternalIds)));
      existingPlayers.forEach((p: any) => playerMap.set(p.externalId, p.id));
    }

    // Prepare records for batch insert
    const eventRecords = eventsDataArray.map((event: any) => {
      const teamId = event.team?.id ? teamMap.get(event.team.id) : null;
      if (!teamId) return null;

      return {
        fixtureId,
        teamId,
        playerId: event.player?.id ? (playerMap.get(event.player.id) || null) : null,
        assistPlayerId: event.assist?.id ? (playerMap.get(event.assist.id) || null) : null,
        timeElapsed: event.time?.elapsed || null,
        timeExtra: event.time?.extra || null,
        type: event.type,
        detail: event.detail,
        comments: event.comments || null,
      };
    }).filter((record: any) => record !== null);
    
    if (eventRecords.length > 0) {
      await db.insert(fixtureEvents).values(eventRecords);
      context.recordsInserted += eventRecords.length;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[details-sync] Error syncing events for fixture ${fixtureId}:`, error);
    throw error;
  }
}

async function syncFixtureLineups(db: any, fixtureId: number, externalFixtureId: number, teamMap: Map<number, number>, context: any) {
  try {
    console.log(`[details-sync] Fetching lineups for fixture ${fixtureId}`);
    
    const response = await footballDataClient.getFixtureLineups(externalFixtureId);
    
    if (!response || !response.response || response.response.length === 0) {
      console.log(`[details-sync] No lineups found for fixture ${fixtureId}`);
      return;
    }
    
    const lineupsData = response.response;
    console.log(`[details-sync] Received ${lineupsData.length} lineups for fixture ${fixtureId}`);
    
    // Delete existing lineups for this fixture
    await db.delete(fixtureLineups).where(eq(fixtureLineups.fixtureId, fixtureId));
    
    // Prepare records for batch insert
    const lineupRecords = lineupsData.map((lineup: any) => {
      const teamId = lineup.team?.id ? teamMap.get(lineup.team.id) : null;
      if (!teamId) return null;

      return {
        fixtureId,
        teamId,
        formation: lineup.formation,
        startXI: JSON.stringify(lineup.startXI || []),
        substitutes: JSON.stringify(lineup.substitutes || []),
        coach: JSON.stringify(lineup.coach || null),
      };
    }).filter((record: any) => record !== null);

    if (lineupRecords.length > 0) {
      await db.insert(fixtureLineups).values(lineupRecords);
      context.recordsInserted += lineupRecords.length;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[details-sync] Error syncing lineups for fixture ${fixtureId}:`, error);
    throw error;
  }
}

async function syncFixturePlayerStatistics(db: any, fixtureId: number, externalFixtureId: number, teamMap: Map<number, number>, context: any) {
  try {
    console.log(`[details-sync] Fetching player statistics for fixture ${fixtureId}`);
    
    const response = await footballDataClient.getFixturePlayerStatistics(externalFixtureId);
    
    if (!response || !response.response || response.response.length === 0) {
      console.log(`[details-sync] No player statistics found for fixture ${fixtureId}`);
      return;
    }

    const playersData = response.response; // Array of { team:..., players: [...] }
    
    // Delete existing stats
    await db.delete(fixturePlayerStatistics).where(eq(fixturePlayerStatistics.fixtureId, fixtureId));
    
    // Need to resolve player IDs first
    const playerExternalIds = new Set<number>();
    playersData.forEach((teamData: any) => {
        teamData.players.forEach((p: any) => {
            if (p.player.id) playerExternalIds.add(p.player.id);
        });
    });

    const playerMap = new Map<number, number>();
    if (playerExternalIds.size > 0) {
      const existingPlayers = await db.select({ id: players.id, externalId: players.externalId })
        .from(players)
        .where(inArray(players.externalId, Array.from(playerExternalIds)));
      existingPlayers.forEach((p: any) => playerMap.set(p.externalId, p.id));
    }
    
    // Prepare records for batch insert
    const statsRecords: any[] = [];
    
    for (const teamData of playersData) {
        const teamId = teamData.team?.id ? teamMap.get(teamData.team.id) : null;
        if (!teamId) continue;
        
        for (const p of teamData.players) {
            const playerId = p.player.id ? playerMap.get(p.player.id) : null;
            if (!playerId) continue;
            
            // p.statistics is array of stats [ { games:..., offsides:..., ... } ]
            // Usually just one object in array for single match
            const statsObj = p.statistics[0] || {};
            
            statsRecords.push({
                fixtureId,
                teamId,
                playerId,
                statistics: JSON.stringify(statsObj)
            });
        }
    }

    if (statsRecords.length > 0) {
        await db.insert(fixturePlayerStatistics).values(statsRecords);
        context.recordsInserted += statsRecords.length;
    }

  } catch (error) {
     const errorMsg = error instanceof Error ? error.message : String(error);
     console.error(`[details-sync] Error syncing player statistics for fixture ${fixtureId}:`, error);
     throw error;
  }
}

async function syncFixtureStatistics(db: any, fixtureId: number, externalFixtureId: number, teamMap: Map<number, number>, context: any) {
  try {
    console.log(`[details-sync] Fetching statistics for fixture ${fixtureId}`);
    
    const response = await footballDataClient.getFixtureStatistics(externalFixtureId);
    
    if (!response || !response.response || response.response.length === 0) {
      console.log(`[details-sync] No statistics found for fixture ${fixtureId}`);
      return;
    }

    const statsData = response.response; // Array of { team:..., statistics: [...] }
    
    // Delete existing stats
    await db.delete(fixtureStatistics).where(eq(fixtureStatistics.fixtureId, fixtureId));
    
    // Prepare records for batch insert
    const statsRecords = statsData.map((statItem: any) => {
        const teamId = statItem.team?.id ? teamMap.get(statItem.team.id) : null;
        if (!teamId) return null;

        // statItem.statistics is array of { type: string, value: any }
        // We need to convert it to a JSON object
        const statsObj: Record<string, any> = {};
        if (Array.isArray(statItem.statistics)) {
            statItem.statistics.forEach((s: any) => {
                statsObj[s.type] = s.value;
            });
        }

        return {
            fixtureId,
            teamId,
            statistics: JSON.stringify(statsObj) // Store as JSON object
        };
    }).filter((record: any) => record !== null);

    if (statsRecords.length > 0) {
        await db.insert(fixtureStatistics).values(statsRecords);
        context.recordsInserted += statsRecords.length;
    }

  } catch (error) {
     const errorMsg = error instanceof Error ? error.message : String(error);
     console.error(`[details-sync] Error syncing statistics for fixture ${fixtureId}:`, error);
     throw error;
  }
}
