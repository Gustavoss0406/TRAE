
import { syncLeagues } from "../server/workers/leagues-sync";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function main() {
  console.log("Testing leagues sync...");
  try {
    const result = await syncLeagues();
    console.log("Sync result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Test failed:", error);
  }
  process.exit(0);
}

main();
