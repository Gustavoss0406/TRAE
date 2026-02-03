
import "dotenv/config";
import { getDb } from "../server/db";
import { fixtures, leagues, seasons } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

async function verifyFixtures2026() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  console.log("Verifying 2026 Fixtures...");

  const result = await db
    .select({
      leagueName: leagues.name,
      seasonYear: seasons.year,
      count: sql<number>`count(*)`,
      source: fixtures.source,
      isOfficial: fixtures.isOfficial
    })
    .from(fixtures)
    .innerJoin(leagues, eq(fixtures.leagueId, leagues.id))
    .innerJoin(seasons, eq(fixtures.seasonId, seasons.id))
    .where(eq(seasons.year, 2026))
    .groupBy(leagues.name, seasons.year, fixtures.source, fixtures.isOfficial)
    .orderBy(leagues.name);

  console.table(result);
}

verifyFixtures2026();
