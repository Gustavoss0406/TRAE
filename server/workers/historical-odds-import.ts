
import axios from "axios";
import { getDb } from "../db";
import { fixtures, teams, odds, leagues, seasons } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { format, parse } from "date-fns";

// Mapping: Our League ID -> Football-Data.co.uk Division Code
const LEAGUE_MAPPING: Record<string, string> = {
  "Premier League": "E0",
  "Championship": "E1",
  "Bundesliga": "D1",
  "Serie A": "I1",
  "La Liga": "SP1",
  "Ligue 1": "F1",
  "Eredivisie": "N1",
  "Primeira Liga": "P1"
};

// URL Pattern: https://www.football-data.co.uk/mmz4281/{season}/{division}.csv
// Season format: 2324 for 2023/2024

async function fetchCsv(seasonCode: string, division: string): Promise<string | null> {
  const url = `https://www.football-data.co.uk/mmz4281/${seasonCode}/${division}.csv`;
  console.log(`Fetching CSV from: ${url}`);
  try {
    const response = await axios.get(url, { responseType: 'text' });
    return response.data;
  } catch (error) {
    console.warn(`Failed to fetch ${url}: ${(error as Error).message}`);
    return null;
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

// Simple name normalizer for team matching
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function syncHistoricalOdds(leagueId: number, seasonYear: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");

  // 1. Get League and Season info
  const league = await db.query.leagues.findFirst({
    where: eq(leagues.id, leagueId)
  });
  
  if (!league || !LEAGUE_MAPPING[league.name]) {
    console.log(`League ${leagueId} not supported for historical odds import.`);
    return;
  }

  const divisionCode = LEAGUE_MAPPING[league.name];
  // Calculate season code (e.g., 2024 -> 2425 for API logic, usually previous year start)
  const seasonStartTwoDigit = (seasonYear % 100).toString().padStart(2, '0');
  const seasonEndTwoDigit = ((seasonYear + 1) % 100).toString().padStart(2, '0');
  const seasonCode = `${seasonStartTwoDigit}${seasonEndTwoDigit}`;

  const csvData = await fetchCsv(seasonCode, divisionCode);
  if (!csvData) return;

  const records = parseCsv(csvData);
  console.log(`Parsed ${records.length} records for ${league.name} ${seasonYear}/${seasonYear + 1}`);

  // 2. Fetch fixtures with teams joined
  const season = await db.query.seasons.findFirst({
    where: and(eq(seasons.leagueId, leagueId), eq(seasons.year, seasonYear))
  });
  
  if (!season) return;

  // Use explicit joins to get team names
  const leagueFixtures = await db.select({
      id: fixtures.id,
      date: fixtures.date,
      homeTeamName: teams.name,
      homeTeamId: teams.id,
      awayTeamName: sql<string>`t2.name`,
      awayTeamId: sql<number>`t2.id`
  })
  .from(fixtures)
  .innerJoin(teams, eq(fixtures.homeTeamId, teams.id))
  .innerJoin(sql`teams as t2`, eq(fixtures.awayTeamId, sql`t2.id`))
  .where(and(eq(fixtures.leagueId, leagueId), eq(fixtures.seasonId, season.id)));

  const teamMap = new Map<string, number>(); // Normalized Name -> ID
  // Populate map from existing fixtures
  for (const f of leagueFixtures) {
      teamMap.set(normalizeName(f.homeTeamName), f.homeTeamId);
      teamMap.set(normalizeName(f.awayTeamName), f.awayTeamId as number);
  }
  
  // Add common overrides dynamically
  const findTeamId = (partialName: string) => {
      for (const [name, id] of Array.from(teamMap.entries())) {
          if (name.includes(partialName)) return id;
      }
      return null;
  };

  const addAlias = (alias: string, dbPartialName: string) => {
      const id = findTeamId(dbPartialName);
      if (id) teamMap.set(alias, id);
  };

  addAlias("manunited", "manchesterunited");
  addAlias("mancity", "manchestercity"); 
  addAlias("manutd", "manchesterunited");
  addAlias("spurs", "tottenham");
  addAlias("wolves", "wolverhamptonwanderersfc");
  addAlias("leicester", "leicestercityfc");
  addAlias("newcastle", "newcastle");
  addAlias("westham", "westham");
  addAlias("nottmforest", "nottinghamforestfc");
  addAlias("luton", "lutontownfc");
  addAlias("sheffutd", "sheffieldunited");
  addAlias("burnley", "burnleyfc");
  addAlias("brighton", "brightonhovealbionfc");
  addAlias("crystalpalace", "crystalpalace");
  addAlias("fulham", "fulhamfc");
  addAlias("liverpool", "liverpool");
  addAlias("arsenal", "arsenal");
  addAlias("astonvilla", "astonvillafc");
  addAlias("bournemouth", "bournemouth");
  addAlias("brentford", "brentfordfc");
  addAlias("chelsea", "chelsea");
  addAlias("everton", "everton");
  addAlias("ipswich", "ipswichtownfc"); 
  addAlias("southampton", "southampton");

  // International Aliases
  // La Liga
  addAlias("realmadrid", "realmadrid");
  addAlias("barcelona", "barcelona");
  addAlias("atleticomadrid", "atleticomadrid");
  addAlias("athbilbao", "athleticclub");
  addAlias("betis", "realbetis");
  addAlias("realsociedad", "realsociedad");
  addAlias("sevilla", "sevillafc");
  addAlias("valencia", "valenciacf");
  addAlias("villarreal", "villarrealcf");
  addAlias("girona", "gironafc");
  
  // Bundesliga
  addAlias("bayernmunich", "bayern");
  addAlias("dortmund", "borussiadortmund");
  addAlias("leverkusen", "bayer04leverkusen");
  addAlias("leipzig", "rbleipzig");
  addAlias("stuttgart", "vfbstuttgart");
  addAlias("frankfurt", "eintrachtfrankfurt");
  addAlias("wolfsburg", "vflwolfsburg");
  addAlias("hoffenheim", "tsg1899hoffenheim");
  addAlias("bochum", "vflbochum1848");
  addAlias("freiburg", "scfreiburg");
  addAlias("unionberlin", "1fcunionberlin");
  addAlias("heidenheim", "1fcheidenheim1846");
  addAlias("werderbremen", "svwerderbremen");
  addAlias("augsburg", "fcaugsburg");
  addAlias("mainz", "1fsvmainz05");
  addAlias("holsteinkiel", "holsteinkiel"); // Guessing, but likely normalized matches if DB name is "Holstein Kiel" (found in coach scraper logs as "Holstein Kiel")

  // Serie A
  addAlias("inter", "inter");
  addAlias("milan", "milan");
  addAlias("juventus", "juventus");
  addAlias("napoli", "sscnapoli");
  addAlias("roma", "asroma");
  addAlias("atalanta", "atalantabc");
  addAlias("lazio", "sslazio");
   addAlias("fiorentina", "acffiorentina");
   addAlias("torino", "torinofc");
   addAlias("udinese", "udinesecalcio");
   addAlias("bologna", "bolognafc1909");
   addAlias("monza", "acmonza");
   addAlias("lecce", "uslecce");
   addAlias("verona", "hellasveronafc");
   addAlias("cagliari", "cagliaricalcio");
   addAlias("empoli", "empolifc");
   addAlias("genoa", "genoacfc");
   
   // Ligue 1
  addAlias("parissg", "parissaintgermain");
  addAlias("monaco", "asmonacofc");
  addAlias("marseille", "olympiquedemarseille");
  addAlias("lyon", "olympiquelyonnais");
  addAlias("lille", "lilleosc");
  addAlias("lens", "racingclubdelens");
  addAlias("rennes", "staderennaisfc");
  addAlias("nice", "ogcnice");
  addAlias("lehavre", "lehavreac");
  addAlias("brest", "stadebrestois29");
  addAlias("reims", "stadedereims");
  addAlias("strasbourg", "rcstrasbourgalsace");
  addAlias("toulouse", "toulousefc");
  addAlias("montpellier", "montpellierhsc");
  addAlias("nantes", "fcnantes");
  addAlias("angers", "angerssco");
  addAlias("auxerre", "ajauxerre");
  addAlias("stetienne", "stetienne");

  let insertedCount = 0;

  for (const record of records) {
    const dateStr = record.Date; // DD/MM/YYYY
    if (!dateStr) continue;
    
    // Parse date
    const [day, month, year] = dateStr.split('/');
    // Assumes 20xx
    const fullYear = year.length === 2 ? `20${year}` : year;
    const matchDate = new Date(`${fullYear}-${month}-${day}`); 

    const homeName = normalizeName(record.HomeTeam);
    const awayName = normalizeName(record.AwayTeam);

    // Find matching fixture
    const fixture = leagueFixtures.find(f => {
      const fDate = new Date(f.date);
      const isSameDate = fDate.toISOString().split('T')[0] === matchDate.toISOString().split('T')[0];
      
      const homeMatch = normalizeName(f.homeTeamName) === homeName || teamMap.get(homeName) === f.homeTeamId;
      const awayMatch = normalizeName(f.awayTeamName) === awayName || teamMap.get(awayName) === (f.awayTeamId as number);

      return isSameDate && homeMatch && awayMatch;
    });

    if (!fixture) {
        // Log failures for first few records to debug
        if (insertedCount < 5) {
             console.log(`No fixture found for ${dateStr}: ${homeName} (${teamMap.get(homeName)}) vs ${awayName} (${teamMap.get(awayName)})`);
             // Debug fixture dates
             const closeFixture = leagueFixtures.find(f => {
                  const h = normalizeName(f.homeTeamName) === homeName || teamMap.get(homeName) === f.homeTeamId;
                  return h;
             });
             if (closeFixture) {
                 console.log(`  Found potential match on date: ${new Date(closeFixture.date).toISOString()}`);
             }
        }
    }

    if (fixture) {
      // Check for odds columns (Bet365 usually: B365H, B365D, B365A)
      if (record.B365H && record.B365D && record.B365A) {
        const values = [
            { value: "Home", odd: record.B365H },
            { value: "Draw", odd: record.B365D },
            { value: "Away", odd: record.B365A }
        ];

        // Upsert logic
        const existingOdd = await db.select().from(odds).where(
            and(
                eq(odds.fixtureId, fixture.id),
                eq(odds.bookmaker, "Bet365 (Historical)"),
                eq(odds.source, "historical_dataset")
            )
        ).limit(1);

        if (existingOdd.length === 0) {
            await db.insert(odds).values({
                fixtureId: fixture.id,
                bookmaker: "Bet365 (Historical)",
                bet: "Match Winner",
                values: values,
                source: "historical_dataset",
                isLive: false
            });
            insertedCount++;
        }
      }
    }
  }
  
  console.log(`Imported ${insertedCount} historical odds for ${league.name}`);
}
