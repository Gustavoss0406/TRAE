/**
 * Players Sync Worker
 * 
 * Synchronizes player data and statistics from football-data.org to D1 database.
 * Runs every 6 hours to keep player information up-to-date.
 */

import { footballDataClient } from "../ingestion/sources/football-data-org";
import { syncLogger } from "../ingestion/utils/sync-logger";
import { getDb } from "../db";
import { players, playerStatistics, teams, seasons, leagues, standings } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export async function syncPlayers() {
  const context = syncLogger.startSync("players-sync");
  
  try {
    console.log("[players-sync] Starting players synchronization...");
    
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }
    
    // Get active seasons to sync players for
    const activeSeasons = await db
      .select({
        season: seasons,
        league: leagues
      })
      .from(seasons)
      .innerJoin(leagues, eq(seasons.leagueId, leagues.id))
      .where(eq(seasons.current, true))
      .limit(5); // Limit to avoid rate limiting
    
    console.log(`[players-sync] Found ${activeSeasons.length} active seasons`);

    // Pre-fetch all leagues for mapping statistics
    const allLeagues = await db.select({ id: leagues.id, apiFootballId: leagues.apiFootballId }).from(leagues);
    const leagueMap = new Map(allLeagues.map(l => [l.apiFootballId, l.id]));
    
    // Process each active season
    for (const { season, league } of activeSeasons) {
      try {
        context.recordsProcessed++;
        
        // Get teams for this league/season via standings
        // This ensures we only get teams actually participating in this season
        const teamsInSeason = await db
          .select({
            id: teams.id,
            apiFootballId: teams.apiFootballId,
            name: teams.name
          })
          .from(teams)
          .innerJoin(standings, eq(teams.id, standings.teamId))
          .where(
            and(
                eq(standings.seasonId, season.id),
                eq(standings.leagueId, league.id)
            )
          )
          .limit(10); // Limit to avoid rate limiting (10 teams per run)
        
        console.log(`[players-sync] Processing ${teamsInSeason.length} teams for season ${season.year}`);
        
        // Process each team
        for (const team of teamsInSeason) {
          try {
            console.log(`[players-sync] Fetching players for team ${team.name} (${team.apiFootballId}), season ${season.year}`);
            
            if (!team.apiFootballId) {
                console.warn(`[players-sync] Team ${team.name} has no API ID. Skipping.`);
                continue;
            }

            // Fetch players from football-data.org
            const response = await footballDataClient.getPlayers({
              team: team.apiFootballId,
              season: season.year,
            });
            
            if (!response || !response.response || response.response.length === 0) {
              console.warn(`[players-sync] No players found for team ${team.name}, season ${season.year}`);
              continue;
            }
            
            const playersData = response.response;
            console.log(`[players-sync] Received ${playersData.length} players for team ${team.name}`);
            
            // Process each player
            for (const playerData of playersData) {
              try {
                const player = playerData.player;
                const statistics = playerData.statistics;
                
                // Check if player exists
                const existingPlayer = await db
                  .select()
                  .from(players)
                  .where(eq(players.externalId, player.id))
                  .limit(1);
                
                const playerRecord = {
                  externalId: player.id,
                  name: player.name,
                  firstname: player.firstname,
                  lastname: player.lastname,
                  age: player.age,
                  birthDate: player.birth?.date ? new Date(player.birth.date) : null,
                  birthPlace: player.birth?.place || null,
                  birthCountry: player.birth?.country || null,
                  nationality: player.nationality,
                  height: player.height,
                  weight: player.weight,
                  injured: player.injured || false,
                  photo: player.photo,
                };
                
                let internalPlayerId: number;

                if (existingPlayer.length > 0) {
                  internalPlayerId = existingPlayer[0].id;
                  // Update existing player
                  await db
                    .update(players)
                    .set({
                      ...playerRecord,
                      updatedAt: new Date(),
                    })
                    .where(eq(players.id, internalPlayerId));
                  
                  context.recordsUpdated++;
                } else {
                  // Insert new player
                  const inserted = await db.insert(players).values(playerRecord).returning({ id: players.id });
                  internalPlayerId = inserted[0].id;
                  context.recordsInserted++;
                }
                
                // Sync player statistics if available
                if (statistics && statistics.length > 0) {
                  for (const stat of statistics) {
                    try {
                      const internalLeagueId = leagueMap.get(stat.league.id);
                      if (!internalLeagueId) {
                          // Skip stats for leagues we don't track
                          continue;
                      }

                      // Check if statistics exist
                      const existingStats = await db
                        .select()
                        .from(playerStatistics)
                        .where(
                          and(
                            eq(playerStatistics.playerId, internalPlayerId),
                            eq(playerStatistics.teamId, team.id),
                            eq(playerStatistics.leagueId, internalLeagueId),
                            eq(playerStatistics.seasonId, season.id)
                          )
                        )
                        .limit(1);
                      
                      const statsRecord = {
                        playerId: internalPlayerId,
                        teamId: team.id,
                        leagueId: internalLeagueId,
                        seasonId: season.id,
                        position: stat.games?.position || null,
                        rating: stat.games?.rating || null,
                        captain: stat.games?.captain || false,
                        appearences: stat.games?.appearences || 0,
                        lineups: stat.games?.lineups || 0,
                        minutes: stat.games?.minutes || 0,
                        substitutesIn: stat.substitutes?.in || 0,
                        substitutesOut: stat.substitutes?.out || 0,
                        substitutesBench: stat.substitutes?.bench || 0,
                        shotsTotal: stat.shots?.total || 0,
                        shotsOn: stat.shots?.on || 0,
                        goalsTotal: stat.goals?.total || 0,
                        goalsConceded: stat.goals?.conceded || 0,
                        goalsAssists: stat.goals?.assists || 0,
                        goalsSaves: stat.goals?.saves || 0,
                        passesTotal: stat.passes?.total || 0,
                        passesKey: stat.passes?.key || 0,
                        passesAccuracy: stat.passes?.accuracy || 0,
                        tacklesTotal: stat.tackles?.total || 0,
                        tacklesBlocks: stat.tackles?.blocks || 0,
                        tacklesInterceptions: stat.tackles?.interceptions || 0,
                        duelsTotal: stat.duels?.total || 0,
                        duelsWon: stat.duels?.won || 0,
                        dribblesAttempts: stat.dribbles?.attempts || 0,
                        dribblesSuccess: stat.dribbles?.success || 0,
                        dribblesPast: stat.dribbles?.past || 0,
                        foulsDrawn: stat.fouls?.drawn || 0,
                        foulsCommitted: stat.fouls?.committed || 0,
                        cardsYellow: stat.cards?.yellow || 0,
                        cardsYellowred: stat.cards?.yellowred || 0,
                        cardsRed: stat.cards?.red || 0,
                        penaltyWon: stat.penalty?.won || 0,
                        penaltyCommitted: stat.penalty?.commited || 0,
                        penaltyScored: stat.penalty?.scored || 0,
                        penaltyMissed: stat.penalty?.missed || 0,
                        penaltySaved: stat.penalty?.saved || 0,
                      };
                      
                      if (existingStats.length > 0) {
                        // Update existing statistics
                        await db
                          .update(playerStatistics)
                          .set({
                            ...statsRecord,
                            updatedAt: new Date(),
                          })
                          .where(eq(playerStatistics.id, existingStats[0].id));
                      } else {
                        // Insert new statistics
                        await db.insert(playerStatistics).values(statsRecord);
                      }
                    } catch (error) {
                      const errorMsg = error instanceof Error ? error.message : String(error);
                      context.errors.push(`Player stats ${player.id}: ${errorMsg}`);
                      console.error(`[players-sync] Error processing player statistics ${player.id}:`, error);
                    }
                  }
                }
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                context.errors.push(`Player ${playerData.player.id}: ${errorMsg}`);
                console.error(`[players-sync] Error processing player ${playerData.player.id}:`, error);
              }
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            context.errors.push(`Team ${team.id}: ${errorMsg}`);
            console.error(`[players-sync] Error processing team ${team.id}:`, error);
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        context.errors.push(`Season ${season.id}: ${errorMsg}`);
        console.error(`[players-sync] Error processing season ${season.id}:`, error);
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
    console.error("[players-sync] Fatal error:", error);
    
    const log = syncLogger.endSync(context, "football-data.org");
    
    return {
      success: false,
      log,
      error: errorMsg,
    };
  }
}
