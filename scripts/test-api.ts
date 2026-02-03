
import { FootballDataOrgClient } from "../server/ingestion/sources/football-data-org";
import { config } from "dotenv";

config();

async function main() {
  console.log("Testing API Connection...");
  console.log("API Key:", process.env.FOOTBALL_DATA_API_KEY ? "Set" : "Not Set");

  const client = new FootballDataOrgClient();
  
  try {
    // Try to fetch status or simple data
    // getStatus() isn't in the class I saw earlier, let's try getFixtures with a date
    const today = new Date().toISOString().split('T')[0];
    console.log(`Fetching fixtures for ${today}...`);
    
    // Test 1: Specific Date
    console.log("Test 1: specific date");
    const fixtures = await client.getFixtures({ date: today });
    console.log("Fixtures count (date):", fixtures.results || fixtures.response?.length || 0);
    
    if (fixtures.response && fixtures.response.length > 0) {
        const leagues = new Set(fixtures.response.map((f: any) => `${f.league.name} (${f.league.id})`));
        console.log("Leagues with matches today:", Array.from(leagues).slice(0, 10));
    }

    // Test 3: Standings
     console.log("Test 3: Standings for PL 2025 (League 39)");
     try {
         const standings = await client.getStandings(39, 2025);
         console.log("Standings response:", standings.results || standings.response?.length || 0);
         if (standings.response && standings.response.length > 0) {
             console.log("League:", standings.response[0].league.name);
             console.log("Season:", standings.response[0].league.season);
         } else {
             console.log("No standings found for 2025. Trying 2024...");
             const standings24 = await client.getStandings(39, 2024);
             console.log("Standings 2024:", standings24.results || standings24.response?.length || 0);
         }
     } catch (err) {
        console.error("Standings error:", err);
    }

  } catch (error) {
    console.error("API Test Failed:", error);
  }
}

main();
