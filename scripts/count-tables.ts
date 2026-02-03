
import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const TABLES = [
  "coaches", "countries", "data_ingestion_log", "elo_ratings", "fixture_events",
  "fixture_lineups", "fixture_player_statistics", "fixture_statistics", "fixtures",
  "injuries", "leagues", "odds", "player_statistics", "players", "predictions",
  "seasons", "standings", "teams", "timezones", "transfers", "trophies", "users", "venues"
];

async function countTables() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  console.log("Table Row Counts:");
  for (const table of TABLES) {
    try {
        const result = await db.execute(sql.raw(`SELECT count(*) as count FROM "${table}"`));
        console.log(`${table}: ${result.rows[0].count}`);
    } catch (e: any) {
        console.log(`${table}: ERROR (${e.message})`);
    }
  }
}

countTables();
