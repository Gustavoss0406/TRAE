/**
 * Standings Sync Worker
 * 
 * Synchronizes league standings from football-data.org to D1 database.
 * Runs every 1 hour to keep standings up-to-date.
 */

import { footballDataClient } from "../ingestion/sources/football-data-org";
import { syncLogger } from "../ingestion/utils/sync-logger";
import { getDb } from "../db";
import { standings, leagues, seasons, teams } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export async function syncStandings(options?: { seasonId?: number; year?: number }) {
  const context = syncLogger.startSync("standings-sync");
  
  try {
    console.log("[standings-sync] Starting standings synchronization...");
    
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }
    
    let targetSeasons: { season: typeof seasons.$inferSelect; league: typeof leagues.$inferSelect }[] = [];

    if (options?.seasonId) {
        const result = await db
            .select({ season: seasons, league: leagues })
            .from(seasons)
            .innerJoin(leagues, eq(seasons.leagueId, leagues.id))
            .where(eq(seasons.id, options.seasonId))
            .limit(1);
        if (result.length > 0) targetSeasons = result;
    } else if (options?.year) {
        const result = await db
            .select({ season: seasons, league: leagues })
            .from(seasons)
            .innerJoin(leagues, eq(seasons.leagueId, leagues.id))
            .where(eq(seasons.year, options.year))
            .limit(1);
        if (result.length > 0) targetSeasons = result;
    } else {
        // Get active leagues (current season)
        targetSeasons = await db
        .select({ season: seasons, league: leagues })
        .from(seasons)
        .innerJoin(leagues, eq(seasons.leagueId, leagues.id))
        .where(eq(seasons.current, true));
    }
    
    console.log(`[standings-sync] Found ${targetSeasons.length} seasons to sync`);
    
    // Pre-fetch all teams for mapping
    const allTeams = await db.select({ id: teams.id, apiFootballId: teams.apiFootballId }).from(teams);
    const teamMap = new Map(allTeams.map(t => [t.apiFootballId, t.id]));

    // Process each active season
    for (const { season, league } of targetSeasons) {
      try {
        context.recordsProcessed++;
        
        console.log(`[standings-sync] Fetching standings for league ${league.name} (${league.apiFootballId}), season ${season.year}`);
        
        // Fetch standings from football-data.org
        const response = await footballDataClient.getStandings(league.apiFootballId || 0, season.year);
        
        console.log(`[standings-sync] API Response keys: ${Object.keys(response || {})}`);
        if (response?.errors && Object.keys(response.errors).length > 0) {
            console.error(`[standings-sync] API Errors:`, JSON.stringify(response.errors));
        }
        if (response?.response) {
            console.log(`[standings-sync] Response length: ${response.response.length}`);
        } else {
            console.log(`[standings-sync] No 'response' field in API result`);
        }

        if (!response || !response.response || response.response.length === 0) {
          console.warn(`[standings-sync] No standings found for league ${league.apiFootballId}, season ${season.year}`);
          continue;
        }
        
        const standingsData = response.response[0].league.standings;
        
        if (!standingsData || standingsData.length === 0) {
          console.warn(`[standings-sync] Empty standings for league ${season.leagueId}, season ${season.year}`);
          continue;
        }
        
        // Process each standing group (usually just one, but can be multiple for groups)
        for (const standingGroup of standingsData) {
          for (const standing of standingGroup) {
            try {
              // Find internal team ID
              let internalTeamId = teamMap.get(standing.team.id);

              if (!internalTeamId) {
                 console.log(`[standings-sync] Team ${standing.team.name} (API ID: ${standing.team.id}) not found. Inserting...`);
                 
                 const [newTeam] = await db.insert(teams).values({
                    apiFootballId: standing.team.id,
                    name: standing.team.name,
                    logo: standing.team.logo,
                    updatedAt: new Date(),
                 }).returning({ id: teams.id });
                 
                 internalTeamId = newTeam.id;
                 teamMap.set(standing.team.id, internalTeamId);
              }

              // Check if standing exists
              const existingStanding = await db
                .select()
                .from(standings)
                .where(
                  and(
                    eq(standings.leagueId, season.leagueId),
                    eq(standings.seasonId, season.id),
                    eq(standings.teamId, internalTeamId)
                  )
                )
                .limit(1);
              
              const standingRecord = {
                leagueId: season.leagueId,
                seasonId: season.id,
                teamId: internalTeamId,
                rank: standing.rank,
                points: standing.points,
                goalsDiff: standing.goalsDiff,
                group: standing.group || null,
                form: standing.form || null,
                status: standing.status || null,
                description: standing.description || null,
                // All matches
                allPlayed: standing.all.played || 0,
                allWin: standing.all.win || 0,
                allDraw: standing.all.draw || 0,
                allLose: standing.all.lose || 0,
                allGoalsFor: standing.all.goals.for || 0,
                allGoalsAgainst: standing.all.goals.against || 0,
                // Home matches
                homePlayed: standing.home.played || 0,
                homeWin: standing.home.win || 0,
                homeDraw: standing.home.draw || 0,
                homeLose: standing.home.lose || 0,
                homeGoalsFor: standing.home.goals.for || 0,
                homeGoalsAgainst: standing.home.goals.against || 0,
                // Away matches
                awayPlayed: standing.away.played || 0,
                awayWin: standing.away.win || 0,
                awayDraw: standing.away.draw || 0,
                awayLose: standing.away.lose || 0,
                awayGoalsFor: standing.away.goals.for || 0,
                awayGoalsAgainst: standing.away.goals.against || 0,
              };
              
              if (existingStanding.length > 0) {
                // Update existing standing
                await db
                  .update(standings)
                  .set({
                    ...standingRecord,
                    updatedAt: new Date(),
                  })
                  .where(eq(standings.id, existingStanding[0].id));
                
                context.recordsUpdated++;
              } else {
                // Insert new standing
                await db.insert(standings).values(standingRecord);
                context.recordsInserted++;
              }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              context.errors.push(`Standing team ${standing.team.id}: ${errorMsg}`);
              console.error(`[standings-sync] Error processing standing for team ${standing.team.id}:`, error);
            }
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        context.errors.push(`Season ${season.id}: ${errorMsg}`);
        console.error(`[standings-sync] Error processing season ${season.id}:`, error);
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
    console.error("[standings-sync] Fatal error:", error);
    
    const log = syncLogger.endSync(context, "football-data.org");
    
    return {
      success: false,
      log,
      error: errorMsg,
    };
  }
}
