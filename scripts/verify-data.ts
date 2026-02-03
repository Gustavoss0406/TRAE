
import "dotenv/config";
import { getDb } from "../server/db";
import * as schema from "../drizzle/schema";
import { sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Failed to connect to database");
    process.exit(1);
  }

  console.log("=== Verifying Data Counts ===");

  const tables = {
    leagues: schema.leagues,
    teams: schema.teams,
    fixtures: schema.fixtures,
    players: schema.players,
    injuries: schema.injuries,
    coaches: schema.coaches,
    transfers: schema.transfers,
    odds: schema.odds,
  };

  for (const [name, table] of Object.entries(tables)) {
    try {
        const result = await db.select({ count: sql<number>`count(*)` }).from(table);
        console.log(`${name}: ${result[0].count}`);
    } catch (e) {
        console.log(`${name}: Error counting (${e.message})`);
    }
  }
  
  console.log("=== Verification Complete ===");
  process.exit(0);
}

main().catch(console.error);
