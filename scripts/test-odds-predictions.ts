
import "dotenv/config";
import { getDb } from "../server/db";
import { fixtures, seasons, leagues } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getFixtures, getTeamStats } from "../server/football-db";
import { generateMatchOdds } from "../server/models/poisson-odds";
import { createApiResponse } from "../server/_core/normalizers";

async function testOddsPredictions() {
  const db = await getDb();
  if (!db) {
    console.error("DB Connection failed");
    return;
  }

  // 1. Get a random fixture from PL 2026
  const league = await db.query.leagues.findFirst({
    where: eq(leagues.name, "Premier League")
  });
  if (!league) return;

  const season = await db.query.seasons.findFirst({
    where: and(eq(seasons.leagueId, league.id), eq(seasons.year, 2026))
  });
  if (!season) return;

  const fixture = await db.query.fixtures.findFirst({
    where: eq(fixtures.seasonId, season.id)
  });

  if (!fixture) {
    console.error("No fixture found for PL 2026");
    return;
  }

  console.log(`Testing Odds for Fixture ID: ${fixture.id} (${fixture.date})`);

  // 2. Simulate Logic
  const fixtureDataList = await getFixtures({ id: fixture.id });
  const fixtureData = fixtureDataList[0];

  // Get team stats for both teams
  let homeStats = await getTeamStats(
    fixtureData.fixture.homeTeamId,
    fixtureData.fixture.seasonId,
    true
  );
  let awayStats = await getTeamStats(
    fixtureData.fixture.awayTeamId,
    fixtureData.fixture.seasonId,
    false
  );

  console.log("Stats (Current Season):");
  console.log("Home:", homeStats ? `${homeStats.matchesPlayed} matches` : "No stats");
  console.log("Away:", awayStats ? `${awayStats.matchesPlayed} matches` : "No stats");

  // Fallback: If insufficient data
  if ((!homeStats || !homeStats.matchesPlayed || homeStats.matchesPlayed < 5) && fixtureData.league?.id && fixtureData.season?.year) {
    console.log("Using Fallback to Previous Season...");
    const prevSeason = await db.select().from(seasons)
      .where(and(eq(seasons.leagueId, fixtureData.league.id), eq(seasons.year, fixtureData.season.year - 1)))
      .limit(1);
    
    if (prevSeason.length > 0) {
      console.log(`Found Previous Season ID: ${prevSeason[0].id}`);
      const prevHomeStats = await getTeamStats(fixtureData.fixture.homeTeamId, prevSeason[0].id, true);
      if (prevHomeStats && prevHomeStats.matchesPlayed > 0) {
          homeStats = prevHomeStats;
          console.log("Home Stats (Fallback):", prevHomeStats.matchesPlayed);
      }
      
      const prevAwayStats = await getTeamStats(fixtureData.fixture.awayTeamId, prevSeason[0].id, false);
      if (prevAwayStats && prevAwayStats.matchesPlayed > 0) {
          awayStats = prevAwayStats;
          console.log("Away Stats (Fallback):", prevAwayStats.matchesPlayed);
      }
    } else {
        console.log("Previous Season not found.");
    }
  }

  if (!homeStats || !awayStats) {
    console.error("Insufficient data to generate odds.");
    return;
  }

  // Generate odds
  const oddsData = generateMatchOdds(
    {
      goalsScored: homeStats.goalsScored || 0,
      goalsConceded: homeStats.goalsConceded || 0,
      matchesPlayed: homeStats.matchesPlayed || 0,
    },
    {
      goalsScored: awayStats.goalsScored || 0,
      goalsConceded: awayStats.goalsConceded || 0,
      matchesPlayed: awayStats.matchesPlayed || 0,
    }
  );

  console.log("\nGenerated Odds:");
  console.log("Home Win:", oddsData.match_winner.home.toFixed(2));
  console.log("Draw:    ", oddsData.match_winner.draw.toFixed(2));
  console.log("Away Win:", oddsData.match_winner.away.toFixed(2));
  
  if (oddsData.match_winner.home > 1 && oddsData.match_winner.away > 1) {
      console.log("✅ Odds validation passed (Values > 1.0)");
  } else {
      console.log("❌ Odds validation failed (Values <= 1.0)");
  }
}

testOddsPredictions().catch(console.error);
