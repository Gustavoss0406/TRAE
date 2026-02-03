
import "dotenv/config";
import { getDb } from "../server/db";
import { seasons, leagues } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) return;

  const currentSeasons = await db
    .select({
      season: seasons,
      league: leagues
    })
    .from(seasons)
    .innerJoin(leagues, eq(seasons.leagueId, leagues.id))
    .where(eq(seasons.current, true));

  console.log("Current Seasons:");
  currentSeasons.forEach(s => {
    console.log(`${s.league.name} (${s.league.apiFootballId}): Season ${s.season.year} (ID: ${s.season.id})`);
  });
  
  const allSeasons = await db.select().from(seasons);
  console.log("\nAll Seasons count:", allSeasons.length);
}

main();
