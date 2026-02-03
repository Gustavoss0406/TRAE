
import "dotenv/config";
import { getDb } from "../server/db";
import { fixtures, teams, players } from "../drizzle/schema";
import { eq, and, like, sql } from "drizzle-orm";

async function debugDB() {
    const db = await getDb();
    if (!db) return;

    // Check Fixtures
    const fixturesCount = await db.select({ count: sql<number>`count(*)` }).from(fixtures).where(eq(fixtures.leagueId, 1));
    console.log("Fixtures for League 1:", fixturesCount[0]);

    const sampleFixture = await db.query.fixtures.findFirst({ where: eq(fixtures.leagueId, 1) });
    console.log("Sample Fixture:", sampleFixture);

    // Check Teams
    const sampleTeam = await db.query.teams.findFirst({ where: like(teams.name, "%City%") });
    console.log("Sample Team (City):", sampleTeam);

    // Check Teams for Aliases
    const teamsList = await db.query.teams.findMany();
    console.log("All Teams:", teamsList.map(t => `${t.name} (ID: ${t.id})`).join(", "));

    process.exit(0);
}

debugDB();
