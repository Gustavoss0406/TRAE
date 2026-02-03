
import "dotenv/config";
import axios from "axios";
import { getDb } from "../server/db";
import { fixtures, teams, odds, leagues, seasons } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Mapping CSV Team Name -> DB ID
const TEAM_MAPPING: Record<string, number> = {
    "Arsenal": 30,
    "Aston Villa": 387,
    "Bournemouth": 26,
    "Brentford": 394,
    "Brighton": 393,
    "Chelsea": 35,
    "Crystal Palace": 38,
    "Everton": 32,
    "Fulham": 388,
    "Ipswich": 46,
    "Leicester": 45,
    "Liverpool": 29,
    "Man City": 36,
    "Man United": 24,
    "Newcastle": 25,
    "Nottm Forest": 391,
    "Southampton": 44,
    "Tottenham": 33, // CSV likely "Spurs" or "Tottenham"
    "Spurs": 33,
    "West Ham": 34,
    "Wolves": 389
};

// Also handle "Wolverhampton" if CSV uses it
TEAM_MAPPING["Wolverhampton"] = 389;
TEAM_MAPPING["Nott'm Forest"] = 391;
TEAM_MAPPING["Nottingham Forest"] = 391;

async function fetchCsv(): Promise<any[]> {
    const url = "https://www.football-data.co.uk/mmz4281/2425/E0.csv";
    console.log(`Fetching CSV from: ${url}`);
    try {
        const response = await axios.get(url, { responseType: 'text' });
        return parseCsv(response.data);
    } catch (error) {
        console.error("Failed to fetch CSV", error);
        return [];
    }
}

function parseCsv(csv: string): any[] {
    const lines = csv.split('\n').filter(line => line.trim().length > 0);
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];
    for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i].split(',');
        if (currentLine.length < headers.length) continue;
        const obj: any = {};
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = currentLine[j]?.trim();
        }
        result.push(obj);
    }
    return result;
}

async function fixFixtures() {
    const db = await getDb();
    if (!db) return;

    // 1. Get League and Season
    // Assuming League 1 is Premier League
    const leagueId = 1;
    const seasonYear = 2024;

    const season = await db.query.seasons.findFirst({
        where: and(eq(seasons.leagueId, leagueId), eq(seasons.year, seasonYear))
    });

    if (!season) {
        console.error("Season 2024 for League 1 not found");
        return;
    }

    // 2. Fetch CSV
    const records = await fetchCsv();
    console.log(`Fetched ${records.length} records`);

    // 3. Delete existing fixtures for this season
    console.log("Deleting existing fixtures...");
    await db.delete(fixtures).where(and(eq(fixtures.leagueId, leagueId), eq(fixtures.seasonId, season.id)));
    console.log("Deleted.");

    // 4. Insert Fixtures and Odds
    let insertedCount = 0;
    
    for (const record of records) {
        const dateStr = record.Date; // DD/MM/YYYY
        if (!dateStr) continue;

        const [day, month, year] = dateStr.split('/');
        const fullYear = year.length === 2 ? `20${year}` : year;
        const date = new Date(`${fullYear}-${month}-${day}`);
        const timestamp = Math.floor(date.getTime() / 1000);

        const homeTeamId = TEAM_MAPPING[record.HomeTeam];
        const awayTeamId = TEAM_MAPPING[record.AwayTeam];

        if (!homeTeamId || !awayTeamId) {
            console.warn(`Unknown team in CSV: ${record.HomeTeam} (${homeTeamId}) or ${record.AwayTeam} (${awayTeamId})`);
            continue;
        }

        const isFinished = record.FTR !== undefined && record.FTR !== "";
        
        // Insert Fixture
        const [fixture] = await db.insert(fixtures).values({
            leagueId: leagueId,
            seasonId: season.id,
            date: date,
            timestamp: timestamp,
            timezone: "UTC",
            statusLong: isFinished ? "Match Finished" : "Not Started",
            statusShort: isFinished ? "FT" : "NS",
            homeTeamId: homeTeamId,
            awayTeamId: awayTeamId,
            goalsHome: isFinished ? parseInt(record.FTHG) : null,
            goalsAway: isFinished ? parseInt(record.FTAG) : null,
            scoreFulltimeHome: isFinished ? parseInt(record.FTHG) : null,
            scoreFulltimeAway: isFinished ? parseInt(record.FTAG) : null,
            source: "historical_dataset",
            isOfficial: true
        }).returning();

        // Insert Odds
        if (record.B365H && record.B365D && record.B365A) {
             const values = [
                { value: "Home", odd: record.B365H },
                { value: "Draw", odd: record.B365D },
                { value: "Away", odd: record.B365A }
            ];
            
            await db.insert(odds).values({
                fixtureId: fixture.id,
                bookmaker: "Bet365 (Historical)",
                bet: "Match Winner",
                values: values,
                source: "historical_dataset",
                isLive: false
            });
        }
        
        insertedCount++;
    }

    console.log(`Successfully inserted ${insertedCount} fixtures with odds.`);
    process.exit(0);
}

fixFixtures();
