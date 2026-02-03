
import "dotenv/config";
import { syncFixtures } from "../server/workers/fixtures-sync";

async function main() {
  console.log("Testing Fixtures Sync Worker (2024)...");

  try {
    // Sync fixtures for Dec 2024
    const result = await syncFixtures({
        fromDate: "2024-12-01",
        toDate: "2024-12-10"
    });
    
    console.log("Fixtures sync completed:", JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
  process.exit(0);
}

main();
