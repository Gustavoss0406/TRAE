
import "dotenv/config";
import { getDb } from "../server/db";
import { fixtures, seasons, leagues } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { generateFixturesForLeague } from "../server/workers/fixtures-generator";

const PL_TEAM_IDS = [
  30,  // Arsenal
  387, // Aston Villa
  26,  // Bournemouth
  394, // Brentford
  37,  // Brighton
  35,  // Chelsea
  38,  // Crystal Palace
  32,  // Everton
  388, // Fulham
  46,  // Ipswich
  45,  // Leicester
  29,  // Liverpool
  36,  // Man City
  24,  // Man Utd
  25,  // Newcastle
  391, // Nottingham Forest
  44,  // Southampton
  33,  // Tottenham
  34,  // West Ham
  28   // Wolves
];

async function fixPL2026() {
  const db = await getDb();
  if (!db) return;

  console.log("Fixing Premier League 2026 Fixtures...");

  // 1. Get League and Season
  const league = await db.query.leagues.findFirst({
    where: eq(leagues.name, "Premier League") // Or ID 1 if we are sure
  });

  if (!league) {
    console.error("Premier League not found");
    return;
  }
  console.log(`League ID: ${league.id}`);

  const season = await db.query.seasons.findFirst({
    where: and(eq(seasons.leagueId, league.id), eq(seasons.year, 2026))
  });

  if (!season) {
    console.error("Season 2026 not found");
    return;
  }
  console.log(`Season ID: ${season.id}`);

  // 2. Delete existing fixtures for this season
  const deleted = await db.delete(fixtures)
    .where(eq(fixtures.seasonId, season.id))
    .returning({ id: fixtures.id });
  
  console.log(`Deleted ${deleted.length} existing fixtures.`);

  // 3. Generate new fixtures
  console.log(`Generating fixtures for ${PL_TEAM_IDS.length} teams...`);
  
  await generateFixturesForLeague(
    league.id,
    2026,
    PL_TEAM_IDS
  );

  console.log("✅ Premier League 2026 fixtures regenerated successfully.");
}

fixPL2026().catch(console.error);
