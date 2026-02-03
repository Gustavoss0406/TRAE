
import "dotenv/config";
import { footballDataClient } from "../server/ingestion/sources/football-data-org";

async function run() {
  console.log("Checking API status for Premier League (ID: 39)...");

  const leaguesToCheck = [
    { name: "Premier League", id: 39 },
  ];

  const seasonsToCheck = [2026, 2025, 2024];

  for (const league of leaguesToCheck) {
    for (const season of seasonsToCheck) {
      console.log(`\n--- Checking ${league.name} (${league.id}) Season ${season} ---`);
      try {
        const response = await footballDataClient.getFixtures({
          league: league.id,
          season: season,
        });

        if (response.errors && Object.keys(response.errors).length > 0) {
          console.error("API Error:", JSON.stringify(response.errors, null, 2));
        } else {
          console.log(`Results: ${response.results}`);
          if (response.response && response.response.length > 0) {
            console.log(`First fixture: ${response.response[0].fixture.date} - ${response.response[0].teams.home.name} vs ${response.response[0].teams.away.name}`);
          } else {
            console.log("No fixtures found in response.");
          }
        }
      } catch (error: any) {
        console.error("Request failed:", error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
        }
      }
    }
  }
}

run();
