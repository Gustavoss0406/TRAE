
import "dotenv/config";
import { getDb } from "../server/db";
import { generateFixturesForLeague } from "../server/workers/fixtures-generator";
import { leagues } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const REQUESTED_LEAGUES = [
  { code: "WC", name: "World Cup", id: 1 },
  { code: "CL", name: "UEFA Champions League", id: 2 },
  { code: "BL1", name: "Bundesliga", id: 78 },
  { code: "DED", name: "Eredivisie", id: 88 },
  { code: "BSA", name: "Serie A (BRA)", id: 71 },
  { code: "PD", name: "Primera Division", id: 140 }, // La Liga
  { code: "FL1", name: "Ligue 1", id: 61 },
  { code: "ELC", name: "Championship", id: 40 },
  { code: "PPL", name: "Primeira Liga", id: 94 },
  { code: "EC", name: "Euro Championship", id: 4 },
  { code: "SA", name: "Serie A", id: 135 },
  { code: "PL", name: "Premier League", id: 39 },
  { code: "FCWC", name: "FIFA Club World Cup", id: 15 } // Added based on report
];

async function run() {
  console.log("Starting 2026 Fixture Generation...");
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  for (const reqLeague of REQUESTED_LEAGUES) {
    try {
        console.log(`\nProcessing ${reqLeague.name} (API ID: ${reqLeague.id})...`);
        
        // Find internal ID
        const leagueRecords = await db.select().from(leagues).where(eq(leagues.apiFootballId, reqLeague.id)).limit(1);
        const league = leagueRecords[0];

        if (!league) {
            console.error(`League ${reqLeague.name} not found in DB. Skipping.`);
            continue;
        }

        await generateFixturesForLeague(league.id, 2026);

    } catch (error) {
        console.error(`Failed to generate fixtures for ${reqLeague.name}:`, error);
    }
  }

  console.log("\nGeneration Complete.");
}

run();
