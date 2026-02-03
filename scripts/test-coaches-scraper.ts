
import "dotenv/config";
import { scrapeCoaches } from "../server/workers/coaches-scraper";

async function main() {
  console.log("Starting coaches scraper test...");
  
  await scrapeCoaches("Premier League");
  
  console.log("Done.");
  process.exit(0);
}

main().catch(console.error);
