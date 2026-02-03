
import "dotenv/config";
import { getDb } from "../server/db";
import { teams, seasons, standings, fixtures, leagues } from "../drizzle/schema";
import { eq, and, count } from "drizzle-orm";

async function checkPLTeams() {
  const db = await getDb();
  if (!db) {
    console.error("Failed to connect to DB");
    return;
  }

  const allLeagues = await db.select().from(leagues);
  console.log("Available Leagues:");
  allLeagues.forEach(l => console.log(`- ${l.name} (ID: ${l.id}, API ID: ${l.apiFootballId})`));

  // Find PL by name if ID lookup failed
  const league = allLeagues.find(l => l.name === 'Premier League' || l.name === 'Premier League (England)');
  
  if (!league) {
    console.error(`Premier League not found in DB`);
    return;
  }
  console.log(`Premier League Internal ID: ${league.id}`);

  // 2. Find PL Season 2026
  const plSeason = await db.query.seasons.findFirst({
    where: and(eq(seasons.leagueId, league.id), eq(seasons.year, 2026))
  });

  if (!plSeason) {
    console.log("PL Season 2026 not found");
    return;
  }

  console.log(`PL Season 2026 ID: ${plSeason.id}`);

  // 3. Check Standings
  const plStandings = await db.select().from(standings).where(eq(standings.leagueId, league.id));
  
  console.log(`Teams in PL Standings (All time): ${plStandings.length}`);
  const teamIdsInStandings = new Set(plStandings.map(s => s.teamId));
  
  // Get all teams
  const allTeams = await db.select().from(teams);

  const teamsInStandings = allTeams.filter(t => teamIdsInStandings.has(t.id));
  console.log("Teams in Standings:");
  teamsInStandings.forEach(t => console.log(`- ${t.name} (${t.code})`));

  // 4. Check generated fixtures for PL 2026
  const plFixtures = await db.select().from(fixtures).where(eq(fixtures.seasonId, plSeason.id));
  
  const teamIdsInFixtures = new Set<number>();
  plFixtures.forEach(f => {
    if (f.homeTeamId) teamIdsInFixtures.add(f.homeTeamId);
    if (f.awayTeamId) teamIdsInFixtures.add(f.awayTeamId);
  });

  console.log(`\nUnique teams in 2026 Fixtures: ${teamIdsInFixtures.size}`);
  const teamsInFixtures = allTeams.filter(t => teamIdsInFixtures.has(t.id));
  teamsInFixtures.forEach(t => console.log(`- ${t.name}`));
}

checkPLTeams().catch(console.error);
