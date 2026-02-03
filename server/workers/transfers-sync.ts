
import { footballDataClient } from "../ingestion/sources/football-data-org";
import { syncLogger } from "../ingestion/utils/sync-logger";
import { getDb } from "../db";
import { transfers, teams, players, seasons, leagues, standings } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export async function syncTransfers() {
  const context = syncLogger.startSync("transfers-sync");
  
  try {
    console.log("[transfers-sync] Starting transfers synchronization...");
    
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
      .where(eq(seasons.current, true))
      .limit(5); 
    
    console.log(`[transfers-sync] Found ${activeSeasons.length} active seasons`);

    for (const { season, league } of activeSeasons) {
      // Get teams
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
        .limit(10);
      
      for (const team of teamsInSeason) {
        if (!team.apiFootballId) continue;
        
        try {
            console.log(`[transfers-sync] Fetching transfers for team ${team.name}`);
            const response = await footballDataClient.getTransfers({ team: team.apiFootballId });
            
            if (!response || !response.response) continue;

            const transfersData = response.response;

            for (const item of transfersData) {
                // item has { player: { id, name }, transfers: [ { date, type, teams: { in: { id, name }, out: { id, name } } } ] }
                
                // Find player
                const playerApiId = item.player.id;
                const playerRecs = await db.select().from(players).where(eq(players.externalId, playerApiId)).limit(1);
                const playerRec = playerRecs[0];

                if (!playerRec) {
                    // console.warn(`[transfers-sync] Player ${item.player.name} (${playerApiId}) not found in DB. Skipping transfer.`);
                    continue; 
                }

                for (const t of item.transfers) {
                    // Find teamIn
                    let teamInId = null;
                    if (t.teams.in.id) {
                        const teamIns = await db.select().from(teams).where(eq(teams.apiFootballId, t.teams.in.id)).limit(1);
                        teamInId = teamIns[0]?.id || null;
                    }

                    // Find teamOut
                    let teamOutId = null;
                    if (t.teams.out.id) {
                        const teamOuts = await db.select().from(teams).where(eq(teams.apiFootballId, t.teams.out.id)).limit(1);
                        teamOutId = teamOuts[0]?.id || null;
                    }

                    // Insert transfer
                    // Check duplicate?
                    const existing = await db.select().from(transfers).where(
                        and(
                            eq(transfers.playerId, playerRec.id),
                            eq(transfers.date, new Date(t.date))
                        )
                    ).limit(1);

                    if (existing.length === 0) {
                        await db.insert(transfers).values({
                            playerId: playerRec.id,
                            date: new Date(t.date),
                            type: t.type,
                            teamInId: teamInId,
                            teamOutId: teamOutId
                        });
                        context.recordsInserted++;
                    }
                }
            }

        } catch (err) {
            console.error(`[transfers-sync] Error processing team ${team.name}:`, err);
            context.errors.push(err instanceof Error ? err.message : "Unknown error");
        }
      }
    }

    syncLogger.endSync(context, "football-data.org");
  } catch (error) {
    console.error("[transfers-sync] Fatal error:", error);
    context.errors.push(error instanceof Error ? error.message : "Unknown error");
    syncLogger.endSync(context, "football-data.org");
  }
}
