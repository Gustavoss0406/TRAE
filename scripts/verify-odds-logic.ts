
import "dotenv/config";
import { getDb } from "../server/db";
import { fixtures, seasons, leagues } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getTeamStats, getEloRating } from "../server/football-db";

async function verifyOddsLogic() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  console.log("🔍 Verifying Odds/Predictions Fallback Logic for 2026...");

  // 1. Get a 2026 fixture
  const result = await db.select({
      fixture: fixtures,
      league: leagues,
      season: seasons
  })
  .from(fixtures)
  .leftJoin(leagues, eq(fixtures.leagueId, leagues.id))
  .leftJoin(seasons, eq(fixtures.seasonId, seasons.id))
  .where(eq(fixtures.source, "generated"))
  .limit(1);

  if (result.length === 0) {
    console.error("❌ No generated fixtures found for 2026.");
    return;
  }

  const { fixture: fixtureData, league: leagueData, season: seasonData } = result[0];

  console.log(`\n📅 Fixture: ${fixtureData.id} | League: ${leagueData?.name} | Season: ${seasonData?.year}`);
  console.log(`🏠 Home Team ID: ${fixtureData.homeTeamId}`);
  console.log(`✈️ Away Team ID: ${fixtureData.awayTeamId}`);

  // 2. Try get stats for 2026 (Expected: Empty/Zero)
  console.log("\n--- Testing Team Stats (Poisson) ---");
  let homeStats = await getTeamStats(fixtureData.homeTeamId, fixtureData.seasonId, true);
  console.log(`2026 Stats (Home): Played ${homeStats?.matchesPlayed || 0}`);

  // 3. Simulate Fallback Logic
  if ((!homeStats || !homeStats.matchesPlayed || homeStats.matchesPlayed < 5) && leagueData?.id && seasonData?.year) {
    console.log("⚠️ Insufficient data for 2026. Attempting fallback...");
    
    const prevSeason = await db.select().from(seasons)
        .where(and(eq(seasons.leagueId, leagueData.id), eq(seasons.year, seasonData.year - 1)))
        .limit(1);
    
    if (prevSeason.length > 0) {
        console.log(`✅ Found Previous Season: ${prevSeason[0].year} (ID: ${prevSeason[0].id})`);
        
        const prevHomeStats = await getTeamStats(fixtureData.homeTeamId, prevSeason[0].id, true);
        console.log(`🔄 Fallback Stats (Home): Played ${prevHomeStats?.matchesPlayed || 0} | Goals: ${prevHomeStats?.goalsScored || 0}`);
        
        if (prevHomeStats && prevHomeStats.matchesPlayed > 0) {
            console.log("✅ Fallback successful! Odds can be generated.");
        } else {
            console.warn("⚠️ Fallback stats also empty (maybe teams didn't play in 2025/2024?).");
        }
    } else {
        console.error("❌ No previous season found.");
    }
  }

  // 4. Test ELO Rating Fallback
  console.log("\n--- Testing ELO Ratings (Predictions) ---");
  let homeRating = await getEloRating(fixtureData.homeTeamId, fixtureData.seasonId);
  console.log(`2026 Rating: ${homeRating ? homeRating.rating : "Not found"}`);

  if (!homeRating) {
      console.log("⚠️ No rating for 2026. Attempting fallback...");
      if (leagueData?.id && seasonData?.year) {
       const prevSeason = await db.select().from(seasons)
        .where(and(eq(seasons.leagueId, leagueData.id), eq(seasons.year, seasonData.year - 1)))
        .limit(1);
        
       if (prevSeason.length > 0) {
            const prevRating = await getEloRating(fixtureData.homeTeamId, prevSeason[0].id);
            console.log(`🔄 Fallback Rating: ${prevRating ? prevRating.rating : "Not found"}`);
            
            if (prevRating) {
                console.log("✅ Fallback successful! Prediction can be generated.");
            } else {
                console.warn("⚠️ Fallback rating also missing.");
            }
       }
      }
  }
}

verifyOddsLogic().catch(console.error);
