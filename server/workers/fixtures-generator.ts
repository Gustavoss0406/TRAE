
import { getDb } from "../db";
import { fixtures, teams, seasons, leagues, venues } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

// Berger Table implementation for Round-Robin
function generateRoundRobinPairings(numTeams: number) {
    const rounds = [];
    if (numTeams % 2 !== 0) {
        // Add a dummy team for bye if odd
        numTeams++;
    }

    const teamIndices = Array.from({ length: numTeams }, (_, i) => i);
    const numRounds = numTeams - 1;
    const half = numTeams / 2;

    for (let round = 0; round < numRounds; round++) {
        const roundPairings = [];
        for (let i = 0; i < half; i++) {
            const t1 = teamIndices[i];
            const t2 = teamIndices[numTeams - 1 - i];
            
            // Swap home/away based on round to balance (standard algorithm)
            if (round % 2 === 1) {
                roundPairings.push([t1, t2]);
            } else {
                roundPairings.push([t2, t1]);
            }
        }
        rounds.push(roundPairings);
        
        // Rotate teams (keep index 0 fixed)
        teamIndices.splice(1, 0, teamIndices.pop()!);
    }

    // Generate second half (return matches) by swapping home/away
    const totalRounds: any[] = [];
    rounds.forEach(r => totalRounds.push(r)); // First leg
    rounds.forEach(r => {
        // Second leg: swap home/away
        const swapped = r.map(([h, a]) => [a, h]);
        totalRounds.push(swapped);
    });

    return totalRounds;
}

export async function generateFixturesForLeague(leagueId: number, seasonYear: number, overrideTeamIds?: number[]) {
    const db = await getDb();
    if (!db) throw new Error("Database not initialized");

    // 1. Get League and Season info
    const leagueRecords = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
    const leagueRecord = leagueRecords[0];

    if (!leagueRecord) throw new Error(`League ${leagueId} not found`);

    const seasonRecords = await db.select().from(seasons).where(and(eq(seasons.leagueId, leagueId), eq(seasons.year, seasonYear))).limit(1);
    let seasonRecord = seasonRecords[0];

    if (!seasonRecord) {
        console.log(`[Generator] Season ${seasonYear} for league ${leagueRecord.name} not found. Creating...`);
        const [newSeason] = await db.insert(seasons).values({
            leagueId: leagueId,
            year: seasonYear,
            start: new Date(`${seasonYear}-08-15`), // Default to August for European leagues
            end: new Date(`${seasonYear + 1}-05-25`),
            current: true,
            coverageFixturesEvents: true,
            coverageFixturesLineups: true,
            coverageFixturesStatistics: true,
            coverageFixturesPlayers: true,
            coverageStandings: true,
            coveragePlayers: true,
            coverageTopScorers: true,
            coverageTopAssists: true,
            coverageTopCards: true,
            coverageInjuries: true,
            coveragePredictions: true,
            coverageOdds: true,
        }).returning();
        seasonRecord = newSeason;
    }

    // 2. Get Teams
    let teamList: { id: number, name: string, venueId: number | null }[] = [];

    if (overrideTeamIds && overrideTeamIds.length > 0) {
        teamList = await db.select({ id: teams.id, name: teams.name, venueId: teams.venueId })
            .from(teams)
            .where(sql`id IN ${overrideTeamIds}`);
        
        // Ensure we got all requested teams
        if (teamList.length !== overrideTeamIds.length) {
            console.warn(`[Generator] Requested ${overrideTeamIds.length} teams but found ${teamList.length}. Some IDs might be invalid.`);
        }
    } else {
        // ... existing logic ...
        teamList = await db
            .select({ id: teams.id, name: teams.name, venueId: teams.venueId })
            .from(teams)
            .innerJoin(fixtures, eq(teams.id, fixtures.homeTeamId)) // Filter teams that have played before
            .where(eq(fixtures.leagueId, leagueId))
            .groupBy(teams.id, teams.name, teams.venueId)
            .limit(20); // Force limit to 20 for standard leagues

        // If not enough teams, just grab by country
        if (teamList.length < 10 && leagueRecord.countryId) {
            teamList = await db
                .select({ id: teams.id, name: teams.name, venueId: teams.venueId })
                .from(teams)
                .where(eq(teams.countryId, leagueRecord.countryId))
                .limit(20);
        }
    }

    if (teamList.length < 2) {
        console.warn(`[Generator] Not enough teams found for league ${leagueRecord.name}. Skipping.`);
        return;
    }

    // Ensure even number of teams for algorithm (though function handles it, we want real teams)
    // If odd, one team rests. That's fine.
    
    console.log(`[Generator] Generating fixtures for ${leagueRecord.name} (${seasonYear}) with ${teamList.length} teams.`);

    // 3. Generate Rounds
    const pairings = generateRoundRobinPairings(teamList.length);
    
    // 4. Assign Dates
    // Start date: season start or Jan 11, 2026 (from previous report)
    let currentDate = new Date(seasonRecord.start || `${seasonYear}-01-11`);
    // Ensure it's a weekend (Saturday)
    while (currentDate.getDay() !== 6) {
        currentDate.setDate(currentDate.getDate() + 1);
    }

    const newFixtures = [];
    
    for (let r = 0; r < pairings.length; r++) {
        const roundMatches = pairings[r];
        const roundName = `Regular Season - ${r + 1}`;
        
        for (const [homeIdx, awayIdx] of roundMatches) {
            // Handle bye (if team index >= real teams)
            if (homeIdx >= teamList.length || awayIdx >= teamList.length) continue;

            const homeTeam = teamList[homeIdx];
            const awayTeam = teamList[awayIdx];

            // Spread matches over Sat/Sun
            const matchDate = new Date(currentDate);
            if (Math.random() > 0.7) { // 30% chance of Sunday match
                matchDate.setDate(matchDate.getDate() + 1);
            }
            
            // Set arbitrary time (e.g., 15:00)
            matchDate.setHours(15, 0, 0, 0);

            newFixtures.push({
                leagueId: leagueId,
                seasonId: seasonRecord.id,
                homeTeamId: homeTeam.id,
                awayTeamId: awayTeam.id,
                venueId: homeTeam.venueId, // Use home team's venue
                date: matchDate,
                timestamp: Math.floor(matchDate.getTime() / 1000),
                timezone: "UTC",
                statusLong: "Not Started",
                statusShort: "NS",
                round: roundName,
                source: "generated",
                isOfficial: false,
                externalId: null, // Generated
            });
        }
        
        // Advance week
        currentDate.setDate(currentDate.getDate() + 7);
    }

    // 5. Bulk Insert
    console.log(`[Generator] Saving ${newFixtures.length} fixtures...`);
    
    // Delete existing GENERATED fixtures for this season to avoid dups if re-run
    await db.delete(fixtures).where(
        and(
            eq(fixtures.leagueId, leagueId),
            eq(fixtures.seasonId, seasonRecord.id),
            eq(fixtures.source, "generated")
        )
    );

    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < newFixtures.length; i += batchSize) {
        const batch = newFixtures.slice(i, i + batchSize);
        await db.insert(fixtures).values(batch);
    }
    
    console.log(`[Generator] Success!`);
}
