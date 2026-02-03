
import "dotenv/config";
import { getDb } from "../server/db";
import { players } from "../drizzle/schema";
import { sql } from "drizzle-orm";

const PLAYERS_TO_CHECK = [
    "Vinicius Junior", "Gavi", "Harry Kane", "Paulo Dybala", "Kylian Mbappe", "Kylian Mbappé"
];

async function checkPlayers() {
  const db = await getDb();
  if (!db) return;

  for (const name of PLAYERS_TO_CHECK) {
      const player = await db.query.players.findFirst({
          where: sql`lower(${players.name}) LIKE ${'%' + name.toLowerCase() + '%'}`
      });
      console.log(`${name}: ${player ? 'Found' : 'Not Found'}`);
  }
  process.exit(0);
}

checkPlayers();
