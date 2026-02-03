/**
 * Fixtures Sync Worker
 * 
 * Synchronizes fixtures from football-data.org to D1 database.
 * Runs every 15 minutes to keep fixtures up-to-date.
 */

import { footballDataClient } from "../ingestion/sources/football-data-org";
import { syncLogger } from "../ingestion/utils/sync-logger";
import { getDb } from "../db";
import { fixtures, leagues, seasons, teams, venues } from "../../drizzle/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export async function syncFixtures(options?: { fromDate?: string; toDate?: string }) {
  const context = syncLogger.startSync("fixtures-sync");
  
  try {
    console.log("[fixtures-sync] Starting fixtures synchronization...");
    
    // Get fixtures for next 7 days or use provided dates
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const fromDate = options?.fromDate || today.toISOString().split("T")[0];
    const toDate = options?.toDate || nextWeek.toISOString().split("T")[0];
    
    console.log(`[fixtures-sync] Fetching fixtures from ${fromDate} to ${toDate}`);
    
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Get active seasons with league info
    const activeSeasons = await db
      .select({
        season: seasons,
        league: leagues
      })
      .from(seasons)
      .innerJoin(leagues, eq(seasons.leagueId, leagues.id))
      .where(eq(seasons.current, true));

    console.log(`[fixtures-sync] Found ${activeSeasons.length} active seasons`);

    // Pre-fetch all teams and venues for mapping
    const allTeams = await db.select({ id: teams.id, apiFootballId: teams.apiFootballId }).from(teams);
    const teamMap = new Map(allTeams.map(t => [t.apiFootballId, t.id]));

    const allVenues = await db.select({ id: venues.id, apiFootballId: venues.apiFootballId }).from(venues);
    const venueMap = new Map(allVenues.map(v => [v.apiFootballId, v.id]));

    for (const { season, league } of activeSeasons) {
        // Fetch from football-data.org
        const response = await footballDataClient.getFixtures({
            from: fromDate,
            to: toDate,
            league: league.apiFootballId || undefined,
            season: season.year
        });
        
        if (response.errors && Object.keys(response.errors).length > 0) {
            console.error(`[fixtures-sync] API Error for league ${league.name} (${league.apiFootballId}):`, JSON.stringify(response.errors));
            context.errors.push(`API Error for league ${league.name}: ${JSON.stringify(response.errors)}`);
            continue;
        }

        if (!response || !response.response) {
            console.warn(`[fixtures-sync] Invalid response for league ${league.apiFootballId}`);
            continue;
        }
        
        const fixturesData = response.response;
        console.log(`[fixtures-sync] Received ${fixturesData.length} fixtures for league ${league.name} (${league.apiFootballId})`);
        
        // Process each fixture
        for (const fixtureData of fixturesData) {
      try {
        context.recordsProcessed++;
        
        // Map external IDs to internal IDs
        let homeTeamId = teamMap.get(fixtureData.teams.home.id);
        let awayTeamId = teamMap.get(fixtureData.teams.away.id);
        const venueId = fixtureData.fixture.venue?.id ? venueMap.get(fixtureData.fixture.venue.id) : null;

        if (!homeTeamId) {
             console.log(`[fixtures-sync] Home team ${fixtureData.teams.home.name} (API ID: ${fixtureData.teams.home.id}) not found. Inserting...`);
             const [newTeam] = await db.insert(teams).values({
                apiFootballId: fixtureData.teams.home.id,
                name: fixtureData.teams.home.name,
                logo: fixtureData.teams.home.logo,
                updatedAt: new Date(),
             }).returning({ id: teams.id });
             homeTeamId = newTeam.id;
             teamMap.set(fixtureData.teams.home.id, homeTeamId);
        }

        if (!awayTeamId) {
             console.log(`[fixtures-sync] Away team ${fixtureData.teams.away.name} (API ID: ${fixtureData.teams.away.id}) not found. Inserting...`);
             const [newTeam] = await db.insert(teams).values({
                apiFootballId: fixtureData.teams.away.id,
                name: fixtureData.teams.away.name,
                logo: fixtureData.teams.away.logo,
                updatedAt: new Date(),
             }).returning({ id: teams.id });
             awayTeamId = newTeam.id;
             teamMap.set(fixtureData.teams.away.id, awayTeamId);
        }

        // if (!homeTeamId || !awayTeamId) { ... } // No longer needed as we upserted them

        // Check if fixture exists by external ID
        const existingFixture = await db
          .select()
          .from(fixtures)
          .where(eq(fixtures.externalId, fixtureData.fixture.id))
          .limit(1);
        
        const fixtureRecord = {
          externalId: fixtureData.fixture.id,
          referee: fixtureData.fixture.referee,
          timezone: fixtureData.fixture.timezone,
          date: new Date(fixtureData.fixture.date),
          timestamp: fixtureData.fixture.timestamp,
          periodsFirst: fixtureData.fixture.periods?.first || null,
          periodsSecond: fixtureData.fixture.periods?.second || null,
          venueId: venueId || null,
          statusLong: fixtureData.fixture.status.long,
          statusShort: fixtureData.fixture.status.short,
          statusElapsed: fixtureData.fixture.status.elapsed,
          leagueId: season.leagueId,
          seasonId: season.id,
          round: fixtureData.league.round,
          homeTeamId: homeTeamId,
          awayTeamId: awayTeamId,
          goalsHome: fixtureData.goals.home,
          goalsAway: fixtureData.goals.away,
          scoreHalftimeHome: fixtureData.score.halftime?.home || null,
          scoreHalftimeAway: fixtureData.score.halftime?.away || null,
          scoreFulltimeHome: fixtureData.score.fulltime?.home || null,
          scoreFulltimeAway: fixtureData.score.fulltime?.away || null,
          scoreExtratimeHome: fixtureData.score.extratime?.home || null,
          scoreExtratimeAway: fixtureData.score.extratime?.away || null,
          scorePenaltyHome: fixtureData.score.penalty?.home || null,
          scorePenaltyAway: fixtureData.score.penalty?.away || null,
          homeWinner: fixtureData.teams.home.winner,
          awayWinner: fixtureData.teams.away.winner,
        };
        
        if (existingFixture.length > 0) {
          // Update existing fixture
          await db
            .update(fixtures)
            .set({
              ...fixtureRecord,
              updatedAt: new Date(),
            })
            .where(eq(fixtures.id, existingFixture[0].id));
          
          context.recordsUpdated++;
        } else {
          // Insert new fixture
          await db.insert(fixtures).values(fixtureRecord);
          context.recordsInserted++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        context.errors.push(`Fixture ${fixtureData.fixture.id}: ${errorMsg}`);
        console.error(`[fixtures-sync] Error processing fixture ${fixtureData.fixture.id}:`, error);
      }
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
    console.error("[fixtures-sync] Fatal error:", error);
    
    const log = syncLogger.endSync(context, "football-data.org");
    
    return {
      success: false,
      log,
      error: errorMsg,
    };
  }
}
