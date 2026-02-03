
import "dotenv/config";
import { getCountries, getLeagues, getTeams } from "../server/football-db";

async function main() {
  console.log("Testing DB Queries...");
  
  // Test 1: Get Countries
  console.log("\n1. Testing getCountries...");
  const countries = await getCountries({ search: "England" });
  console.log(`Found ${countries.length} countries matching 'England'`);
  if (countries.length > 0) {
    console.log("First country:", countries[0].name);
  }

  // Test 2: Get Leagues
  console.log("\n2. Testing getLeagues...");
  const leagues = await getLeagues({ country: "England", search: "Premier" });
  console.log(`Found ${leagues.length} leagues matching 'Premier' in 'England'`);
  if (leagues.length > 0) {
    console.log("First league:", leagues[0].league.name);
    console.log("Seasons:", leagues[0].seasons.map((s: any) => s.year).join(", "));
  }

  // Test 3: Get Teams
  console.log("\n3. Testing getTeams...");
  const teams = await getTeams({ country: "England", season: 2023 });
  console.log(`Found ${teams.length} teams in England for 2023`);
  if (teams.length > 0) {
    console.log("First team:", teams[0].team.name);
  }

  console.log("\nDB Queries Test Completed.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
