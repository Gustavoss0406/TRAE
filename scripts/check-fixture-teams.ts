
import "dotenv/config";
import { getDb } from "../server/db";
import { fixtures, teams, seasons } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

async function checkFixtureTeams() {
    const db = await getDb();
    if (!db) return;

    // Assuming League 1 is PL and Season 2024 exists
    // We need to find the Season ID for League 1, Year 2024
    const season = await db.query.seasons.findFirst({
        where: and(eq(seasons.leagueId, 1), eq(seasons.year, 2024))
    });

    if (!season) {
        console.log("Season 2024 not found for League 1");
        return;
    }

    const fixtureList = await db.select({
        homeTeamName: teams.name,
        homeTeamId: fixtures.homeTeamId
    })
    .from(fixtures)
    .innerJoin(teams, eq(fixtures.homeTeamId, teams.id))
    .where(and(eq(fixtures.leagueId, 1), eq(fixtures.seasonId, season.id)));

    const distinctTeams = new Set<string>();
    fixtureList.forEach(f => distinctTeams.add(`${f.homeTeamName} (ID: ${f.homeTeamId})`));

    console.log(`Distinct Home Teams in Fixtures (${distinctTeams.size}):`);
    [...distinctTeams].sort().forEach(t => console.log(t));

    process.exit(0);
}

checkFixtureTeams();
