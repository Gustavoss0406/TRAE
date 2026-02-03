
import "dotenv/config";
import { footballDataClient } from "../server/ingestion/sources/football-data-org";

async function debug() {
  console.log("Checking API Plan Constraints...");
  
  // Test a range of seasons to see what is allowed
  const seasonsToTest = [2024, 2023, 2022];
  
  for (const season of seasonsToTest) {
    console.log(`\nChecking Fixtures for Premier League (39), Season ${season}...`);
    try {
      const fixtures = await footballDataClient.getFixtures({
        league: 39,
        season: season,
        from: `${season}-08-01`, // Approx start of season
        to: `${season}-08-30`
      });
      
      if (fixtures.errors && Object.keys(fixtures.errors).length > 0) {
        console.log(`Season ${season} Errors:`, JSON.stringify(fixtures.errors, null, 2));
      } else {
        console.log(`Season ${season} SUCCESS. Found ${fixtures.results} fixtures.`);
      }
    } catch (e) {
      console.error(`Season ${season} check failed:`, e);
    }
  }
}

debug();
