
import "dotenv/config";
import { getDb } from "../server/db";
import { coaches, teams, leagues, seasons } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

async function main() {
    const db = await getDb();
    if (!db) return;

    const leagueName = "Ligue 1";
    
    const league = await db.query.leagues.findFirst({
        where: eq(leagues.name, leagueName)
    });
    
    if (!league || !league.countryId) {
        console.log("League not found or has no country");
        return;
    }

    const teamList = await db.query.teams.findMany({
        where: eq(teams.countryId, league.countryId)
    });

    console.log(`Found ${teamList.length} teams in ${leagueName} country.`);
    
    let coachesCount = 0;
    for (const team of teamList) {
        const teamCoaches = await db.query.coaches.findMany({
            where: eq(coaches.teamId, team.id)
        });

        if (teamCoaches.length > 0) {
            console.log(`Team: ${team.name}, Coach: ${teamCoaches[0].name} (Source: ${teamCoaches[0].source})`);
            coachesCount++;
        } else {
            console.log(`Team: ${team.name}, Coach: NONE`);
        }
    }
    
    console.log(`Total teams with coaches: ${coachesCount}/${teamList.length}`);
    process.exit(0);
}

main().catch(console.error);
