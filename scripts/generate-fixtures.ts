
import "dotenv/config";
import axios from "axios";
import { getDb } from "../server/db";
import { fixtures, teams, odds, leagues, seasons } from "../drizzle/schema";
import { eq, and, like, sql } from "drizzle-orm";

const LEAGUE_MAPPING: Record<string, string> = {
  "Premier League": "E0",
  "La Liga": "SP1",
  "Serie A": "I1",
  "Bundesliga": "D1",
  "Ligue 1": "F1"
};

const TARGET_LEAGUES = ["La Liga", "Serie A", "Bundesliga", "Ligue 1"]; // Skipping PL as it's done

async function fetchCsv(division: string): Promise<any[]> {
    const url = `https://www.football-data.co.uk/mmz4281/2425/${division}.csv`;
    console.log(`Fetching CSV from: ${url}`);
    try {
        const response = await axios.get(url, { responseType: 'text' });
        return parseCsv(response.data);
    } catch (error) {
        console.error(`Failed to fetch CSV from ${url}`, (error as Error).message);
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

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function generateFixtures() {
    const db = await getDb();
    if (!db) return;

    for (const leagueName of TARGET_LEAGUES) {
        console.log(`\nProcessing ${leagueName}...`);
        
        const league = await db.query.leagues.findFirst({
            where: eq(leagues.name, leagueName)
        });

        if (!league) {
            console.warn(`League ${leagueName} not found in DB`);
            continue;
        }

        const season = await db.query.seasons.findFirst({
            where: and(eq(seasons.leagueId, league.id), eq(seasons.year, 2024))
        });

        if (!season) {
            console.warn(`Season 2024 for ${leagueName} not found`);
            continue;
        }

        const division = LEAGUE_MAPPING[leagueName];
        if (!division) {
            console.warn(`No division code for ${leagueName}`);
            continue;
        }

        const records = await fetchCsv(division);
        if (records.length === 0) continue;

        console.log(`Fetched ${records.length} records for ${leagueName}`);

        // Get existing teams in this league's country (approximation)
        // Or all teams to be safe
        const allTeams = await db.select().from(teams);
        const teamMap = new Map<string, number>();
        
        for (const t of allTeams) {
            teamMap.set(normalizeName(t.name), t.id);
        }

        // Helper to find or create team
        const getTeamId = async (csvName: string): Promise<number> => {
            const normalized = normalizeName(csvName);
            
            // 1. Exact match on normalized name
            if (teamMap.has(normalized)) return teamMap.get(normalized)!;

            // 2. Try partial match (if safe? maybe risky)
            // Let's stick to strict first, then aliases.
            
            // Common Aliases
            const aliases: Record<string, string> = {
                "manunited": "manchesterunited",
                "mancity": "manchestercity",
                "spurs": "tottenham",
                "wolves": "wolverhampton",
                "nottmforest": "nottingham",
                "sheffutd": "sheffieldunited",
                "utd": "united",
                "realmadrid": "realmadridcf",
                "barcelona": "fcbarcelona",
                "atleticomadrid": "atleticomadrid",
                "betis": "realbetis",
                "sociedad": "realsociedad",
                "bilbao": "athleticclub",
                "valencia": "valenciacf",
                "villarreal": "villarrealcf",
                "sevilla": "sevillafc",
                "mallorca": "rcdmallorca",
                "osasuna": "caosasuna",
                "alaves": "deportivoalaves",
                "palmas": "udlaspalmas",
                "rayovallecano": "rayovallecano",
                "celta": "rccelta",
                "getafe": "getafecf",
                "girona": "gironafc",
                "leganes": "cdleganes",
                "espanyol": "rcdespanyol",
                "valladolid": "realvalladolidcf",
                
                "bayernmunich": "fcbayernmunchen",
                "dortmund": "borussiadortmund",
                "leverkusen": "bayer04leverkusen",
                "leipzig": "rbleipzig",
                "stuttgart": "vfbstuttgart",
                "frankfurt": "eintrachtfrankfurt",
                "hoffenheim": "tsg1899hoffenheim",
                "heidenheim": "1fcheidenheim1846",
                "werderbremen": "svwerderbremen",
                "freiburg": "scfreiburg",
                "augsburg": "fcaugsburg",
                "wolfsburg": "vflwolfsburg",
                "mainz": "1fsvmainz05",
                "gladbach": "borussiamonchengladbach",
                "unionberlin": "1fcunionberlin",
                "bochum": "vflbochum1848",
                "stpauli": "fcstpauli",
                "holsteinkiel": "holsteinkiel",
                
                "inter": "intermilan",
                "milan": "acmilan",
                "juventus": "juventusfc",
                "atalanta": "atalantabc",
                "bologna": "bolognafc1909",
                "roma": "asroma",
                "lazio": "sslazio",
                "fiorentina": "acffiorentina",
                "torino": "torinofc",
                "napoli": "sscnapoli",
                "genoa": "genoacfc",
                "monza": "acmonza",
                "verona": "hellasveronafc",
                "lecce": "uslecce",
                "udinese": "udinesecalcio",
                "cagliari": "cagliaricalcio",
                "empoli": "empolifc",
                "parma": "parmacalcio1913",
                "como": "como1907",
                "venezia": "veneziafc",
                
                "parissg": "parissaintgermain",
                "monaco": "asmonaco",
                "brest": "stadebrestois29",
                "lille": "lilleosc",
                "nice": "ogcnice",
                "lyon": "olympiquelyonnais",
                "lens": "racingclubdelens",
                "marseille": "olympiquedemarseille",
                "reims": "stadedereims",
                "rennes": "staderennais",
                "toulouse": "toulousefc",
                "montpellier": "montpellierhsc",
                "strasbourg": "rcstrasbourgalsace",
                "nantes": "fcnantes",
                "lehavre": "lehavreac",
                "auxerre": "ajauxerre",
                "angers": "angerssco",
                "stetienne": "assaintetienne"
            };

            // Check aliases
            if (aliases[normalized]) {
                const aliasTarget = aliases[normalized];
                // Check if alias target exists in map (it should match a normalized DB name)
                // But DB names might be normalized differently (e.g. "fcbarcelona" vs "barcelona")
                // Let's iterate map to find partial match or assume alias is exact normalized DB name?
                // The map keys are normalized DB names.
                if (teamMap.has(aliasTarget)) return teamMap.get(aliasTarget)!;
                
                // If not exact match, try find value that includes alias
                 for (const [key, id] of teamMap.entries()) {
                    if (key.includes(aliasTarget) || aliasTarget.includes(key)) {
                        return id;
                    }
                }
            }

            // 3. Fallback: Create Team
            console.log(`Creating missing team: ${csvName} (normalized: ${normalized})`);
            const [newTeam] = await db.insert(teams).values({
                name: csvName, // Use original CSV name
                countryId: league.countryId,
                national: false,
                logo: "https://placehold.co/100"
            }).returning();
            
            teamMap.set(normalized, newTeam.id);
            return newTeam.id;
        };

        // Delete existing fixtures?
        // Let's assume we want to clear and rebuild to ensure consistency with CSV
        console.log(`Deleting existing fixtures for ${leagueName}...`);
        await db.delete(fixtures).where(and(eq(fixtures.leagueId, league.id), eq(fixtures.seasonId, season.id)));

        let insertedCount = 0;

        for (const record of records) {
            const dateStr = record.Date;
            if (!dateStr) continue;

            const [day, month, year] = dateStr.split('/');
            const fullYear = year.length === 2 ? `20${year}` : year;
            const date = new Date(`${fullYear}-${month}-${day}`);
            const timestamp = Math.floor(date.getTime() / 1000);

            const homeTeamId = await getTeamId(record.HomeTeam);
            const awayTeamId = await getTeamId(record.AwayTeam);

            const isFinished = record.FTR !== undefined && record.FTR !== "";

            const [fixture] = await db.insert(fixtures).values({
                leagueId: league.id,
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

            // Odds
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
        console.log(`Inserted ${insertedCount} fixtures for ${leagueName}`);
    }
    
    process.exit(0);
}

generateFixtures();
