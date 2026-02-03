
import "dotenv/config";
import { getDb } from "../server/db";
import { leagues } from "../drizzle/schema";

async function listLeagues() {
  const db = await getDb();
  if (!db) return;

  const results = await db.select().from(leagues);
  console.log(results.map(l => ({ id: l.id, name: l.name, country: l.country })));
  process.exit(0);
}

listLeagues();
