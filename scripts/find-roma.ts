
import "dotenv/config";
import { getDb } from "../server/db";
import { teams } from "../drizzle/schema";
import { sql } from "drizzle-orm";

async function findRoma() {
  const db = await getDb();
  if (!db) return;

  const result = await db.query.teams.findMany({
      where: sql`lower(${teams.name}) LIKE '%roma%'`
  });
  console.log(result.map(t => t.name));
  process.exit(0);
}

findRoma();
