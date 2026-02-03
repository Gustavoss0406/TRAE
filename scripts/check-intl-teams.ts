
import "dotenv/config";
import { getDb } from "../server/db";
import { teams } from "../drizzle/schema";
import { sql } from "drizzle-orm";

const TEAMS_TO_CHECK = [
    "Real Madrid", "Barcelona", "Bayern", "Roma", "PSG", "Paris Saint-Germain"
];

async function checkTeams() {
  const db = await getDb();
  if (!db) return;

  for (const name of TEAMS_TO_CHECK) {
      const team = await db.query.teams.findFirst({
          where: sql`lower(${teams.name}) LIKE ${'%' + name.toLowerCase() + '%'}`
      });
      console.log(`${name}: ${team ? 'Found' : 'Not Found'} (${team?.name})`);
  }
  process.exit(0);
}

checkTeams();
