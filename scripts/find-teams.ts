
import "dotenv/config";
import { getDb } from "../server/db";
import { teams } from "../drizzle/schema";
import { like, or } from "drizzle-orm";

async function findTeams() {
    const db = await getDb();
    if (!db) return;

    const results = await db.select().from(teams).where(
        or(
            like(teams.name, "%Paris%"),
            like(teams.name, "%Angers%"),
            like(teams.name, "%Auxerre%"),
            like(teams.name, "%Monaco%"),
            like(teams.name, "%Marseille%"),
            like(teams.name, "%Lyon%"),
            like(teams.name, "%Lille%"),
            like(teams.name, "%Nice%"),
            like(teams.name, "%Rennes%"),
            like(teams.name, "%Lens%")
        )
    );

    console.log("Found Teams:");
    results.forEach(t => console.log(`${t.name} (ID: ${t.id}, API ID: ${t.apiFootballId})`));

    process.exit(0);
}

findTeams();
