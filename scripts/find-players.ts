
import "dotenv/config";
import { getDb } from "../server/db";
import { teams, players, playerStatistics } from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";

async function findPlayers() {
    const db = await getDb();
    if (!db) return;

    // Get IDs for some teams
    const targetTeams = await db.query.teams.findMany({
        where: inArray(teams.name, ["Manchester City", "Arsenal", "Liverpool", "Chelsea", "Manchester United"])
    });

    console.log("Teams found:", targetTeams.map(t => t.name));

    for (const team of targetTeams) {
        console.log(`\n--- ${team.name} Players ---`);
        // Find players for this team via stats
        const stats = await db.select({
            playerName: players.name,
            playerId: players.id
        })
        .from(playerStatistics)
        .innerJoin(players, eq(playerStatistics.playerId, players.id))
        .where(eq(playerStatistics.teamId, team.id))
        .limit(10); // Just get 10 to see format

        stats.forEach(p => console.log(`${p.playerName} (ID: ${p.playerId})`));
    }

    process.exit(0);
}

findPlayers();
