
import "dotenv/config";
import { syncHistoricalOdds } from "../server/workers/historical-odds-import";
import { scrapeCoaches } from "../server/workers/coaches-scraper";
import { importTransfersFromCsv } from "../server/workers/transfers-import";
import { scrapeInjuries } from "../server/workers/injuries-scraper";
import path from "path";
import fs from "fs";
import { eq, and } from "drizzle-orm";

async function runEnrichment() {
  console.log("Starting Data Enrichment (Hybrid Pipeline)...");

  // 1. Historical Odds (Football-Data.co.uk)
  // Syncing Premier League 2024/2025 odds (Historical)
  console.log("\n--- Syncing Historical Odds ---");
  
  const { getDb } = await import("../server/db");
  const { leagues, seasons } = await import("../drizzle/schema"); 
  const db = await getDb();
  
  if (db) {
    // List of leagues to process
    const TARGET_LEAGUES = ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"];

    for (const leagueName of TARGET_LEAGUES) {
        console.log(`\n=== Processing ${leagueName} ===`);
        const league = await db.query.leagues.findFirst({ where: eq(leagues.name, leagueName) });
        
        if (league) {
            console.log(`Found ${leagueName} ID: ${league.id}`);
            
            // 1. Historical Odds
            console.log("--- Syncing Historical Odds ---");
            await syncHistoricalOdds(league.id, 2024);

            // 2. Coaches
            console.log("--- Scraping Coaches ---");
            await scrapeCoaches(leagueName);

            // 3. Injuries
            console.log("--- Scraping Injuries ---");
            const season = await db.query.seasons.findFirst({
                where: and(eq(seasons.leagueId, league.id), eq(seasons.year, 2024))
            });

            if (season) {
                 await scrapeInjuries(leagueName, league.id, season.id);
            } else {
                console.log(`Season 2024 not found for ${leagueName}, skipping injuries.`);
            }

        } else {
            console.log(`${leagueName} not found in DB.`);
        }
    }
  }

  // 4. Transfers (CSV)
  console.log("\n--- Importing Transfers ---");
  const transferFile = path.resolve(process.cwd(), "data/imports/transfers_latest.csv");
  // Create dummy file if not exists for demo
  if (!fs.existsSync(path.dirname(transferFile))) {
      fs.mkdirSync(path.dirname(transferFile), { recursive: true });
  }
  if (!fs.existsSync(transferFile)) {
      fs.writeFileSync(transferFile, "PlayerName,FromTeam,ToTeam,Date,Type,Fee\nJ. Gomez,Liverpool,Real Madrid,2026-06-01,Transfer,50m");
      console.log("Created demo transfers file.");
  }
  await importTransfersFromCsv(transferFile);

  console.log("\nEnrichment Complete.");
  process.exit(0);
}

runEnrichment().catch(console.error);
