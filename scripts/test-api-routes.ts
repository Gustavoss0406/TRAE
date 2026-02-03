
import "dotenv/config";
import { getCountries, getLeagues, getStandings, getTeams, getFixtures } from "../server/football-db";

async function main() {
  console.log("Testing API Routes (Database Layer)...");

  try {
    // 1. Test getCountries
    console.log("\n--- Testing getCountries ---");
    const countries = await getCountries({ name: "England" });
    console.log(`Found ${countries.length} countries matching 'England'`);
    if (countries.length > 0) {
        console.log(`First country: ${countries[0].name} (ID: ${countries[0].id})`);
    }

    // 2. Test getLeagues
    console.log("\n--- Testing getLeagues ---");
    const leagues = await getLeagues({ name: "Premier League" });
    console.log(`Found ${leagues.length} leagues matching 'Premier League'`);
    if (leagues.length > 0) {
        console.log(`First league: ${leagues[0].league.name} (ID: ${leagues[0].league.id}, API ID: ${leagues[0].league.apiFootballId})`);
    }

    // 3. Test getTeams
    console.log("\n--- Testing getTeams ---");
    const teams = await getTeams({ league: 1, season: 2024 }); 
    console.log(`Found ${teams.length} teams for League ID 1, Season 2024`);
    if (teams.length > 0) {
        console.log(`First team: ${teams[0].team.name} (ID: ${teams[0].team.id})`);
    }

    // 4. Test getStandings
    console.log("\n--- Testing getStandings ---");
    const standings = await getStandings({ league: 1, season: 2024 });
    console.log(`Found ${standings.length} standings entries for League ID 1, Season 2024`);
    if (standings.length > 0) {
        console.log(`First standing: Rank ${standings[0].standing.rank} - ${standings[0].team.name} (${standings[0].standing.points} pts)`);
    }

    // 5. Test getFixtures
    console.log("\n--- Testing getFixtures ---");
    // Filter by season 2024
    const fixtures = await getFixtures({ season: 2024 });
    console.log(`Found ${fixtures.length} fixtures for Season 2024`);
    if (fixtures.length > 0) {
        const f = fixtures[0];
        console.log(`First fixture: ${f.fixture.date} - ${f.fixture.statusShort} - Home: ${f.fixture.homeTeamId} vs Away: ${f.fixture.awayTeamId}`);
    }

  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
  process.exit(0);
}

main();
