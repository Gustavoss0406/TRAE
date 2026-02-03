
import "dotenv/config";
import { syncStandings } from "../server/workers/standings-sync";

async function main() {
  console.log("Testing Standings Sync Worker (2024)...");

  try {
    // Sync standings for 2024
    const result = await syncStandings({
        year: 2024
    });
    
    console.log("Standings sync completed:", JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
  process.exit(0);
}

main();
