/**
 * Mock Data Seed Script
 * 
 * Populates the database with synthetic data for system validation.
 * This script creates a complete dataset including:
 * - Leagues and seasons
 * - Teams and venues
 * - Fixtures (past, live, future)
 * - Standings
 * - Players and statistics
 * - Events, lineups, and match statistics
 */

import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import * as schema from "../drizzle/schema.js";

const db = drizzle(process.env.DATABASE_URL);

console.log("[seed-mock] Starting mock data population...");

// Helper to create dates
const daysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const daysFromNow = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

try {
  // ============================================================================
  // 1. LEAGUES AND SEASONS
  // ============================================================================
  
  console.log("[seed-mock] Creating leagues and seasons...");
  
  const leagueData = [
    { id: 39, name: "Premier League", type: "League", logo: "https://media.api-sports.io/football/leagues/39.png" },
    { id: 140, name: "La Liga", type: "League", logo: "https://media.api-sports.io/football/leagues/140.png" },
    { id: 78, name: "Bundesliga", type: "League", logo: "https://media.api-sports.io/football/leagues/78.png" },
  ];
  
  for (const league of leagueData) {
    await db.insert(schema.leagues).values({
      id: league.id,
      name: league.name,
      type: league.type,
      logo: league.logo,
      countryId: 1, // England (already seeded)
    }).onDuplicateKeyUpdate({ set: { name: league.name } });
    
    // Create current season
    await db.insert(schema.seasons).values({
      leagueId: league.id,
      year: 2024,
      start: new Date("2024-08-01"),
      end: new Date("2025-05-31"),
      current: true,
    }).onDuplicateKeyUpdate({ set: { current: true } });
  }
  
  console.log(`[seed-mock] Created ${leagueData.length} leagues with seasons`);
  
  // ============================================================================
  // 2. TEAMS AND VENUES
  // ============================================================================
  
  console.log("[seed-mock] Creating teams and venues...");
  
  const teamsData = [
    { id: 33, name: "Manchester United", code: "MUN", logo: "https://media.api-sports.io/football/teams/33.png", venue: "Old Trafford" },
    { id: 34, name: "Newcastle", code: "NEW", logo: "https://media.api-sports.io/football/teams/34.png", venue: "St. James Park" },
    { id: 40, name: "Liverpool", code: "LIV", logo: "https://media.api-sports.io/football/teams/40.png", venue: "Anfield" },
    { id: 42, name: "Arsenal", code: "ARS", logo: "https://media.api-sports.io/football/teams/42.png", venue: "Emirates Stadium" },
    { id: 47, name: "Tottenham", code: "TOT", logo: "https://media.api-sports.io/football/teams/47.png", venue: "Tottenham Hotspur Stadium" },
    { id: 50, name: "Manchester City", code: "MCI", logo: "https://media.api-sports.io/football/teams/50.png", venue: "Etihad Stadium" },
  ];
  
  for (const team of teamsData) {
    // Create venue first
    const venueResult = await db.insert(schema.venues).values({
      name: team.venue,
      address: "Mock Address",
      city: "Mock City",
      capacity: 50000,
      surface: "grass",
      image: null,
    }).onDuplicateKeyUpdate({ set: { name: team.venue } });
    
    const venueId = venueResult[0]?.insertId || 1;
    
    // Create team
    await db.insert(schema.teams).values({
      id: team.id,
      name: team.name,
      code: team.code,
      country: "England",
      founded: 1900,
      national: false,
      logo: team.logo,
      venueId: venueId,
      countryId: 1,
    }).onDuplicateKeyUpdate({ set: { name: team.name } });
  }
  
  console.log(`[seed-mock] Created ${teamsData.length} teams with venues`);
  
  // ============================================================================
  // 3. FIXTURES (PAST, LIVE, FUTURE)
  // ============================================================================
  
  console.log("[seed-mock] Creating fixtures...");
  
  // Get season ID
  const seasons = await db.select().from(schema.seasons).where(eq(schema.seasons.year, 2024)).limit(1);
  const seasonId = seasons[0]?.id || 1;
  
  const fixturesData = [
    // Past fixtures
    { id: 1001, homeTeamId: 33, awayTeamId: 40, date: daysAgo(7), status: "FT", homeGoals: 2, awayGoals: 1 },
    { id: 1002, homeTeamId: 42, awayTeamId: 50, date: daysAgo(5), status: "FT", homeGoals: 1, awayGoals: 3 },
    { id: 1003, homeTeamId: 34, awayTeamId: 47, date: daysAgo(3), status: "FT", homeGoals: 0, awayGoals: 0 },
    
    // Live fixture
    { id: 1004, homeTeamId: 40, awayTeamId: 42, date: new Date(), status: "2H", homeGoals: 2, awayGoals: 2 },
    
    // Future fixtures
    { id: 1005, homeTeamId: 50, awayTeamId: 33, date: daysFromNow(2), status: "NS", homeGoals: null, awayGoals: null },
    { id: 1006, homeTeamId: 47, awayTeamId: 34, date: daysFromNow(5), status: "NS", homeGoals: null, awayGoals: null },
  ];
  
  for (const fixture of fixturesData) {
    await db.insert(schema.fixtures).values({
      id: fixture.id,
      referee: "Mock Referee",
      timezone: "UTC",
      date: fixture.date,
      timestamp: Math.floor(fixture.date.getTime() / 1000),
      venueId: 1,
      statusLong: fixture.status === "FT" ? "Match Finished" : fixture.status === "NS" ? "Not Started" : "Second Half",
      statusShort: fixture.status,
      statusElapsed: fixture.status === "2H" ? 65 : null,
      leagueId: 39,
      seasonId: seasonId,
      round: "Regular Season - 1",
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      goalsHome: fixture.homeGoals,
      goalsAway: fixture.awayGoals,
      scoreHalftimeHome: fixture.homeGoals !== null ? Math.floor(fixture.homeGoals / 2) : null,
      scoreHalftimeAway: fixture.awayGoals !== null ? Math.floor(fixture.awayGoals / 2) : null,
      scoreFulltimeHome: fixture.homeGoals,
      scoreFulltimeAway: fixture.awayGoals,
    }).onDuplicateKeyUpdate({ set: { statusShort: fixture.status } });
  }
  
  console.log(`[seed-mock] Created ${fixturesData.length} fixtures`);
  
  // ============================================================================
  // 4. STANDINGS
  // ============================================================================
  
  console.log("[seed-mock] Creating standings...");
  
  const standingsData = [
    { rank: 1, teamId: 50, points: 28, played: 12, win: 9, draw: 1, lose: 2, goalsFor: 30, goalsAgainst: 10 },
    { rank: 2, teamId: 40, points: 26, played: 12, win: 8, draw: 2, lose: 2, goalsFor: 28, goalsAgainst: 12 },
    { rank: 3, teamId: 42, points: 24, played: 12, win: 7, draw: 3, lose: 2, goalsFor: 25, goalsAgainst: 15 },
    { rank: 4, teamId: 33, points: 22, played: 12, win: 7, draw: 1, lose: 4, goalsFor: 22, goalsAgainst: 18 },
    { rank: 5, teamId: 47, points: 20, played: 12, win: 6, draw: 2, lose: 4, goalsFor: 20, goalsAgainst: 16 },
    { rank: 6, teamId: 34, points: 18, played: 12, win: 5, draw: 3, lose: 4, goalsFor: 18, goalsAgainst: 20 },
  ];
  
  for (const standing of standingsData) {
    await db.insert(schema.standings).values({
      leagueId: 39,
      seasonId: seasonId,
      teamId: standing.teamId,
      rank: standing.rank,
      points: standing.points,
      goalsDiff: standing.goalsFor - standing.goalsAgainst,
      group: "Premier League",
      form: "WWDWL",
      status: null,
      description: null,
      allPlayed: standing.played,
      allWin: standing.win,
      allDraw: standing.draw,
      allLose: standing.lose,
      allGoalsFor: standing.goalsFor,
      allGoalsAgainst: standing.goalsAgainst,
      homePlayed: Math.floor(standing.played / 2),
      homeWin: Math.floor(standing.win / 2),
      homeDraw: Math.floor(standing.draw / 2),
      homeLose: Math.floor(standing.lose / 2),
      homeGoalsFor: Math.floor(standing.goalsFor / 2),
      homeGoalsAgainst: Math.floor(standing.goalsAgainst / 2),
      awayPlayed: Math.ceil(standing.played / 2),
      awayWin: Math.ceil(standing.win / 2),
      awayDraw: Math.ceil(standing.draw / 2),
      awayLose: Math.ceil(standing.lose / 2),
      awayGoalsFor: Math.ceil(standing.goalsFor / 2),
      awayGoalsAgainst: Math.ceil(standing.goalsAgainst / 2),
    }).onDuplicateKeyUpdate({ set: { points: standing.points } });
  }
  
  console.log(`[seed-mock] Created ${standingsData.length} standings`);
  
  // ============================================================================
  // 5. PLAYERS
  // ============================================================================
  
  console.log("[seed-mock] Creating players...");
  
  const playersData = [
    { id: 2935, name: "Bruno Fernandes", firstname: "Bruno", lastname: "Fernandes", age: 29, nationality: "Portugal", height: "179 cm", weight: "69 kg", photo: "https://media.api-sports.io/football/players/2935.png" },
    { id: 306, name: "Mohamed Salah", firstname: "Mohamed", lastname: "Salah", age: 31, nationality: "Egypt", height: "175 cm", weight: "71 kg", photo: "https://media.api-sports.io/football/players/306.png" },
    { id: 635, name: "Kevin De Bruyne", firstname: "Kevin", lastname: "De Bruyne", age: 32, nationality: "Belgium", height: "181 cm", weight: "70 kg", photo: "https://media.api-sports.io/football/players/635.png" },
    { id: 19182, name: "Bukayo Saka", firstname: "Bukayo", lastname: "Saka", age: 22, nationality: "England", height: "178 cm", weight: "70 kg", photo: "https://media.api-sports.io/football/players/19182.png" },
  ];
  
  for (const player of playersData) {
    await db.insert(schema.players).values({
      id: player.id,
      name: player.name,
      firstname: player.firstname,
      lastname: player.lastname,
      age: player.age,
      birthDate: new Date("1995-01-01"),
      birthPlace: "Mock City",
      birthCountry: player.nationality,
      nationality: player.nationality,
      height: player.height,
      weight: player.weight,
      injured: false,
      photo: player.photo,
    }).onDuplicateKeyUpdate({ set: { name: player.name } });
    
    // Create player statistics
    await db.insert(schema.playerStatistics).values({
      playerId: player.id,
      teamId: player.id === 2935 ? 33 : player.id === 306 ? 40 : player.id === 635 ? 50 : 42,
      leagueId: 39,
      seasonId: seasonId,
      season: 2024,
      position: "Midfielder",
      rating: "7.5",
      captain: false,
      statistics: JSON.stringify({
        games: { appearances: 12, lineups: 12, minutes: 1080 },
        goals: { total: 5, assists: 3 },
        passes: { total: 450, accuracy: 85 },
      }),
    }).onDuplicateKeyUpdate({ set: { rating: "7.5" } });
  }
  
  console.log(`[seed-mock] Created ${playersData.length} players with statistics`);
  
  // ============================================================================
  // 6. FIXTURE DETAILS (EVENTS, LINEUPS, STATISTICS)
  // ============================================================================
  
  console.log("[seed-mock] Creating fixture details...");
  
  // Events for finished fixture 1001 (MUN 2-1 LIV)
  await db.insert(schema.fixtureEvents).values([
    {
      fixtureId: 1001,
      teamId: 33,
      playerId: 2935,
      assistPlayerId: null,
      timeElapsed: 15,
      timeExtra: null,
      type: "Goal",
      detail: "Normal Goal",
      comments: null,
    },
    {
      fixtureId: 1001,
      teamId: 40,
      playerId: 306,
      assistPlayerId: null,
      timeElapsed: 30,
      timeExtra: null,
      type: "Goal",
      detail: "Normal Goal",
      comments: null,
    },
    {
      fixtureId: 1001,
      teamId: 33,
      playerId: 2935,
      assistPlayerId: null,
      timeElapsed: 75,
      timeExtra: null,
      type: "Goal",
      detail: "Normal Goal",
      comments: null,
    },
  ]).onDuplicateKeyUpdate({ set: { type: "Goal" } });
  
  // Lineups for fixture 1001
  await db.insert(schema.fixtureLineups).values([
    {
      fixtureId: 1001,
      teamId: 33,
      formation: "4-3-3",
      startXI: JSON.stringify([
        { player: { id: 2935, name: "Bruno Fernandes", number: 8, pos: "M" } },
      ]),
      substitutes: JSON.stringify([]),
      coach: JSON.stringify({ id: 1, name: "Mock Coach", photo: null }),
    },
    {
      fixtureId: 1001,
      teamId: 40,
      formation: "4-3-3",
      startXI: JSON.stringify([
        { player: { id: 306, name: "Mohamed Salah", number: 11, pos: "F" } },
      ]),
      substitutes: JSON.stringify([]),
      coach: JSON.stringify({ id: 2, name: "Mock Coach", photo: null }),
    },
  ]).onDuplicateKeyUpdate({ set: { formation: "4-3-3" } });
  
  // Statistics for fixture 1001
  await db.insert(schema.fixtureStatistics).values([
    {
      fixtureId: 1001,
      teamId: 33,
      statistics: JSON.stringify([
        { type: "Shots on Goal", value: 6 },
        { type: "Shots off Goal", value: 4 },
        { type: "Total Shots", value: 10 },
        { type: "Ball Possession", value: "55%" },
        { type: "Passes accurate", value: 450 },
      ]),
    },
    {
      fixtureId: 1001,
      teamId: 40,
      statistics: JSON.stringify([
        { type: "Shots on Goal", value: 4 },
        { type: "Shots off Goal", value: 3 },
        { type: "Total Shots", value: 7 },
        { type: "Ball Possession", value: "45%" },
        { type: "Passes accurate", value: 380 },
      ]),
    },
  ]).onDuplicateKeyUpdate({ set: { teamId: 33 } });
  
  console.log("[seed-mock] Created fixture details (events, lineups, statistics)");
  
  // ============================================================================
  // SUMMARY
  // ============================================================================
  
  console.log("\n[seed-mock] ✅ Mock data population complete!");
  console.log("[seed-mock] Summary:");
  console.log(`  - ${leagueData.length} leagues with seasons`);
  console.log(`  - ${teamsData.length} teams with venues`);
  console.log(`  - ${fixturesData.length} fixtures (past, live, future)`);
  console.log(`  - ${standingsData.length} standings entries`);
  console.log(`  - ${playersData.length} players with statistics`);
  console.log(`  - Fixture details for completed matches`);
  
  process.exit(0);
} catch (error) {
  console.error("[seed-mock] ❌ Error:", error);
  process.exit(1);
}
