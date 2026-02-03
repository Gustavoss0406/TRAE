
import "dotenv/config";
import { getDb } from "../server/db";
import { footballDataV4Client } from "../server/ingestion/sources/football-data-v4";
import { teams, leagues, seasons, standings } from "../drizzle/schema";
import { eq, and, ilike } from "drizzle-orm";

const REQUESTED_LEAGUES = [
  { code: "WC", name: "World Cup", id: 1 },
  { code: "CL", name: "UEFA Champions League", id: 2 },
  { code: "BL1", name: "Bundesliga", id: 78 },
  { code: "DED", name: "Eredivisie", id: 88 },
  { code: "BSA", name: "Serie A (BRA)", id: 71 },
  { code: "PD", name: "Primera Division", id: 140 }, // La Liga
  { code: "FL1", name: "Ligue 1", id: 61 },
  { code: "ELC", name: "Championship", id: 40 },
  { code: "PPL", name: "Primeira Liga", id: 94 },
  { code: "EC", name: "Euro Championship", id: 4 },
  { code: "SA", name: "Serie A", id: 135 },
  { code: "PL", name: "Premier League", id: 39 },
  { code: "FCWC", name: "FIFA Club World Cup", id: 15 }
];

async function run() {
  console.log("Starting Standings Sync for 2023 (Source: Football-Data.org)...");
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  for (const reqLeague of REQUESTED_LEAGUES) {
    try {
        console.log(`\nFetching standings for ${reqLeague.name} (API ID: ${reqLeague.id})...`);
        
        // Use 2023 season
        const seasonYear = 2023;
        let response = await footballDataV4Client.getStandings(reqLeague.id, seasonYear);
        
        if (!response) {
            console.log("Retrying with season 2022...");
            response = await footballDataV4Client.getStandings(reqLeague.id, 2022);
        }

        if (!response || !response.standings || response.standings.length === 0) {
            console.log(`No standings found for ${reqLeague.name}. Skipping.`);
            continue;
        }

        // Get League internal ID
        const leagueRec = await db.select().from(leagues).where(eq(leagues.apiFootballId, reqLeague.id)).limit(1);
        if (leagueRec.length === 0) {
            console.error(`League ${reqLeague.name} not found in DB.`);
            continue;
        }
        const leagueId = leagueRec[0].id;

        // Get or Create Season
        let seasonRec = await db.select().from(seasons).where(and(eq(seasons.leagueId, leagueId), eq(seasons.year, seasonYear))).limit(1);
        let seasonId;
        if (seasonRec.length === 0) {
             const [newSeason] = await db.insert(seasons).values({
                 leagueId: leagueId,
                 year: seasonYear,
                 start: new Date(`${seasonYear}-08-01`), // Approx
                 end: new Date(`${seasonYear + 1}-05-31`), // Approx
                 current: false,
                 coverageStandings: true
             }).returning({ id: seasons.id });
             seasonId = newSeason.id;
        } else {
            seasonId = seasonRec[0].id;
        }

        // Process Standings
        const totalStanding = response.standings.find((s: any) => s.type === "TOTAL") || response.standings[0];
        const homeStanding = response.standings.find((s: any) => s.type === "HOME");
        const awayStanding = response.standings.find((s: any) => s.type === "AWAY");

        if (!totalStanding || !totalStanding.table) continue;

        console.log(`Processing ${totalStanding.table.length} standings entries...`);

        for (const entry of totalStanding.table) {
            // entry: { position, team: { id, name, ... }, playedGames, won, draw, lost, points, goalsFor, goalsAgainst, goalDifference }
            
            // Find Team
            let teamId = null;
            // Try by ID (apiFootballId)
            const teamById = await db.select().from(teams).where(eq(teams.apiFootballId, entry.team.id)).limit(1);
            if (teamById.length > 0) {
                teamId = teamById[0].id;
            } else {
                // Try by Name
                const teamByName = await db.select().from(teams).where(ilike(teams.name, entry.team.name)).limit(1);
                if (teamByName.length > 0) {
                    teamId = teamByName[0].id;
                }
            }

            if (!teamId) {
                console.warn(`Team ${entry.team.name} not found in DB. Skipping standing.`);
                continue;
            }

            // Find corresponding home/away entries
            const homeEntry = homeStanding?.table.find((h: any) => h.team.id === entry.team.id);
            const awayEntry = awayStanding?.table.find((a: any) => a.team.id === entry.team.id);

            // Insert/Update Standing
            const existingStanding = await db.select().from(standings).where(
                and(
                    eq(standings.leagueId, leagueId),
                    eq(standings.seasonId, seasonId),
                    eq(standings.teamId, teamId)
                )
            ).limit(1);

            if (existingStanding.length === 0) {
                await db.insert(standings).values({
                    leagueId,
                    seasonId,
                    teamId,
                    rank: entry.position,
                    points: entry.points,
                    goalsDiff: entry.goalDifference,
                    group: totalStanding.group || null,
                    form: entry.form || null,
                    status: "same", // default
                    description: null,
                    allPlayed: entry.playedGames,
                    allWin: entry.won,
                    allDraw: entry.draw,
                    allLose: entry.lost,
                    allGoalsFor: entry.goalsFor,
                    allGoalsAgainst: entry.goalsAgainst,
                    
                    homePlayed: homeEntry?.playedGames || 0,
                    homeWin: homeEntry?.won || 0,
                    homeDraw: homeEntry?.draw || 0,
                    homeLose: homeEntry?.lost || 0,
                    homeGoalsFor: homeEntry?.goalsFor || 0,
                    homeGoalsAgainst: homeEntry?.goalsAgainst || 0,

                    awayPlayed: awayEntry?.playedGames || 0,
                    awayWin: awayEntry?.won || 0,
                    awayDraw: awayEntry?.draw || 0,
                    awayLose: awayEntry?.lost || 0,
                    awayGoalsFor: awayEntry?.goalsFor || 0,
                    awayGoalsAgainst: awayEntry?.goalsAgainst || 0,

                    updatedAt: new Date()
                });
            }
        }

    } catch (error: any) {
        console.error(`Failed to fetch standings for ${reqLeague.name}:`, error.message);
    }
  }

  console.log("\nStandings Sync Complete.");
}

run();
