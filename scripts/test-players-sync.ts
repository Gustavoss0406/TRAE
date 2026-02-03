
import "dotenv/config";
import { syncPlayers } from "../server/workers/players-sync";

async function main() {
  console.log("Testing Players Sync Worker...");

  try {
    // This will try to sync players for active seasons (2024)
    // It limits to 10 teams, so it should be relatively quick
    await syncPlayers();
    
    console.log("Players sync completed check logs above.");

  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
  process.exit(0);
}

main();
