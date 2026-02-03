
import { footballDataClient } from "../ingestion/sources/football-data-org";
import { syncLogger } from "../ingestion/utils/sync-logger";
import { getDb } from "../db";
import { coaches, teams, seasons, leagues, standings } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export async function syncCoaches() {
  const context = syncLogger.startSync("coaches-sync");
  
  try {
    console.log("[coaches-sync] Starting coaches synchronization...");
    
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }
    
    // Get active seasons to sync coaches for
    const activeSeasons = await db
      .select({
        season: seasons,
        league: leagues
      })
      .from(seasons)
      .innerJoin(leagues, eq(seasons.leagueId, leagues.id))
      .where(eq(seasons.current, true))
      .limit(5); 
    
    console.log(`[coaches-sync] Found ${activeSeasons.length} active seasons`);

    // Process each active season
    for (const { season, league } of activeSeasons) {
      try {
        // Get teams for this league/season
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
        
        console.log(`[coaches-sync] Processing ${teamsInSeason.length} teams for season ${season.year}`);
        
        for (const team of teamsInSeason) {
          try {
            if (!team.apiFootballId) continue;

            console.log(`[coaches-sync] Fetching coaches for team ${team.name} (${team.apiFootballId})`);
            
            const response = await footballDataClient.getCoaches({
              team: team.apiFootballId
            });
            
            if (!response || !response.response || response.response.length === 0) {
              continue;
            }
            
            const coachesData = response.response;
            
            for (const coachData of coachesData) {
              // Parse coach data
              const c = {
                externalId: coachData.id,
                name: coachData.name,
                firstname: coachData.firstname,
                lastname: coachData.lastname,
                age: coachData.age,
                birthDate: coachData.birth?.date ? new Date(coachData.birth.date) : null,
                birthPlace: coachData.birth?.place,
                birthCountry: coachData.birth?.country,
                nationality: coachData.nationality,
                height: coachData.height,
                weight: coachData.weight,
                photo: coachData.photo,
                teamId: team.id
              };

              // Upsert coach
              // Check if exists by externalId
              const existing = await db.select().from(coaches).where(eq(coaches.externalId, c.externalId)).limit(1);
              
              if (existing.length > 0) {
                 await db.update(coaches).set({ ...c, updatedAt: new Date() }).where(eq(coaches.id, existing[0].id));
              } else {
                 await db.insert(coaches).values(c);
              }
              context.recordsProcessed++;
            }
            
          } catch (err) {
            console.error(`[coaches-sync] Error processing team ${team.name}:`, err);
            context.errors.push(err instanceof Error ? err.message : "Unknown error");
          }
        }
      } catch (err) {
        console.error(`[coaches-sync] Error processing season ${season.year}:`, err);
        context.errors.push(err instanceof Error ? err.message : "Unknown error");
      }
    }
    
    syncLogger.endSync(context, "football-data.org");
    
  } catch (error) {
    console.error("[coaches-sync] Fatal error:", error);
    context.errors.push(error instanceof Error ? error.message : "Unknown error");
    syncLogger.endSync(context, "football-data.org");
  }
}
