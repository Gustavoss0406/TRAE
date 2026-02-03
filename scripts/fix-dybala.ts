
import "dotenv/config";
import { getDb } from "../server/db";
import { players, teams, playerStatistics } from "../drizzle/schema";
import { eq, like, and } from "drizzle-orm";

async function fixDybala() {
    const db = await getDb();
    if (!db) return;

    console.log("Fixing Dybala team...");

    // Find Dybala
    const dybala = await db.query.players.findFirst({
        where: like(players.name, "%Paulo Dybala%")
    });

    if (!dybala) {
        console.log("Dybala not found.");
        return;
    }

    // Find AS Roma
    const roma = await db.query.teams.findFirst({
        where: eq(teams.name, "AS Roma")
    });

    if (!roma) {
        console.log("AS Roma not found.");
        return;
    }

    // Find current stats (link)
    const stats = await db.query.playerStatistics.findFirst({
        where: eq(playerStatistics.playerId, dybala.id)
    });

    if (stats) {
        console.log(`Found stats for Dybala linked to team ID: ${stats.teamId}`);
        
        // Update to AS Roma
        await db.update(playerStatistics)
            .set({ teamId: roma.id })
            .where(eq(playerStatistics.id, stats.id));
            
        console.log(`Updated Dybala (${dybala.id}) stats to team ${roma.name} (${roma.id})`);
    } else {
        console.log("No stats found for Dybala.");
        // Insert if needed, but let's assume seed script would handle if missing, 
        // but here we just want to fix existing.
    }

    process.exit(0);
}

fixDybala();
