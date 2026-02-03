
import "dotenv/config";
import { getDb } from "../server/db";
import * as schema from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Failed to connect to database");
    process.exit(1);
  }

  console.log("[seed-mock] Starting mock data population (Postgres - Smart Upsert)...");

  // Helper to create dates
  const daysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  };

  const daysFromNow = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  };

  // Maps to store mapping from API ID to Internal Database ID
  const leagueMap = new Map<number, number>();
  const teamMap = new Map<number, number>();
  const playerMap = new Map<number, number>();

  try {
    // ============================================================================
    // 1. LEAGUES AND SEASONS
    // ============================================================================
    
    console.log("[seed-mock] Processing leagues...");
    
    const leagueData = [
      { id: 39, name: "Premier League", type: "League", logo: "https://media.api-sports.io/football/leagues/39.png" },
      { id: 140, name: "La Liga", type: "League", logo: "https://media.api-sports.io/football/leagues/140.png" },
      { id: 78, name: "Bundesliga", type: "League", logo: "https://media.api-sports.io/football/leagues/78.png" },
    ];
    
    for (const league of leagueData) {
      let leagueId: number;
      
      // Check if league exists by API ID
      const existing = await db.query.leagues.findFirst({
        where: eq(schema.leagues.apiFootballId, league.id)
      });
      
      if (existing) {
        leagueId = existing.id;
        console.log(`[seed-mock] League ${league.name} exists (ID: ${leagueId})`);
        // Optional: Update name/logo if needed
        await db.update(schema.leagues)
          .set({ name: league.name, logo: league.logo })
          .where(eq(schema.leagues.id, leagueId));
      } else {
        // Insert new league
        // We try to use the API ID as internal ID if possible, but fallback to auto-generated
        try {
            const res = await db.insert(schema.leagues).values({
                // Try to force ID for consistency, but if it fails (e.g. PK taken by another), we'll retry without ID
                id: league.id,
                apiFootballId: league.id,
                name: league.name,
                type: league.type.toLowerCase() as any,
                logo: league.logo,
                countryId: 1, 
            } as any).returning({ id: schema.leagues.id });
            leagueId = res[0].id;
        } catch (e) {
            // Retry without forcing ID
            const res = await db.insert(schema.leagues).values({
                apiFootballId: league.id,
                name: league.name,
                type: league.type.toLowerCase() as any,
                logo: league.logo,
                countryId: 1, 
            } as any).returning({ id: schema.leagues.id });
            leagueId = res[0].id;
        }
        console.log(`[seed-mock] Created League ${league.name} (ID: ${leagueId})`);
      }
      
      leagueMap.set(league.id, leagueId);
      
      // Create current season
      await db.insert(schema.seasons).values({
        leagueId: leagueId,
        year: 2024,
        start: new Date("2024-08-01"),
        end: new Date("2025-05-31"),
        current: true,
        coverageFixturesEvents: true,
        coverageFixturesLineups: true,
        coverageFixturesStatistics: true,
        coverageFixturesPlayers: true,
        coverageInjuries: true,
        coveragePredictions: true,
        coverageOdds: true,
      } as any).onConflictDoUpdate({ 
        target: [schema.seasons.leagueId, schema.seasons.year], 
        set: { current: true } 
      });
    }
    
    // ============================================================================
    // 2. TEAMS AND VENUES
    // ============================================================================
    
    console.log("[seed-mock] Processing teams...");
    
    const teamsData = [
      // Premier League
      { id: 33, name: "Manchester United", code: "MUN", logo: "https://media.api-sports.io/football/teams/33.png", venue: "Old Trafford", countryId: 1 },
      { id: 34, name: "Newcastle", code: "NEW", logo: "https://media.api-sports.io/football/teams/34.png", venue: "St. James Park", countryId: 1 },
      { id: 40, name: "Liverpool", code: "LIV", logo: "https://media.api-sports.io/football/teams/40.png", venue: "Anfield", countryId: 1 },
      { id: 42, name: "Arsenal", code: "ARS", logo: "https://media.api-sports.io/football/teams/42.png", venue: "Emirates Stadium", countryId: 1 },
      { id: 47, name: "Tottenham", code: "TOT", logo: "https://media.api-sports.io/football/teams/47.png", venue: "Tottenham Hotspur Stadium", countryId: 1 },
      { id: 50, name: "Manchester City", code: "MCI", logo: "https://media.api-sports.io/football/teams/50.png", venue: "Etihad Stadium", countryId: 1 },
      // La Liga
      { id: 529, name: "Barcelona", code: "BAR", logo: "https://media.api-sports.io/football/teams/529.png", venue: "Camp Nou", countryId: 1 },
      { id: 541, name: "Real Madrid", code: "RMA", logo: "https://media.api-sports.io/football/teams/541.png", venue: "Santiago Bernabéu", countryId: 1 },
      // Bundesliga
      { id: 157, name: "Bayern Munich", code: "BAY", logo: "https://media.api-sports.io/football/teams/157.png", venue: "Allianz Arena", countryId: 1 },
    ];
    
    for (const team of teamsData) {
      let teamId: number;
      
      const existing = await db.query.teams.findFirst({
        where: eq(schema.teams.apiFootballId, team.id)
      });
      
      if (existing) {
        teamId = existing.id;
        teamMap.set(team.id, teamId);
        continue; // Skip creation if exists
      }
      
      // Venue logic
      let venueId = 1;
      const existingVenue = await db.query.venues.findFirst({
        where: eq(schema.venues.name, team.venue)
      });
      
      if (existingVenue) {
        venueId = existingVenue.id;
      } else {
        const venueResult = await db.insert(schema.venues).values({
          name: team.venue,
          address: "Mock Address",
          city: "Mock City",
          capacity: 50000,
          surface: "grass",
          image: null,
        }).returning({ id: schema.venues.id });
        venueId = venueResult[0].id;
      }
      
      // Create team
      try {
        const res = await db.insert(schema.teams).values({
            id: team.id,
            apiFootballId: team.id,
            name: team.name,
            code: team.code,
            countryId: team.countryId,
            founded: 1900,
            national: false,
            logo: team.logo,
            venueId: venueId,
        } as any).returning({ id: schema.teams.id });
        teamId = res[0].id;
      } catch (e) {
        const res = await db.insert(schema.teams).values({
            apiFootballId: team.id,
            name: team.name,
            code: team.code,
            countryId: team.countryId,
            founded: 1900,
            national: false,
            logo: team.logo,
            venueId: venueId,
        } as any).returning({ id: schema.teams.id });
        teamId = res[0].id;
      }
      
      teamMap.set(team.id, teamId);
    }
    
    console.log(`[seed-mock] Processed ${teamsData.length} teams`);
    
    // ============================================================================
    // 3. FIXTURES
    // ============================================================================
    
    console.log("[seed-mock] Processing fixtures...");
    
    // Need season ID for PL (39)
    const plId = leagueMap.get(39);
    let seasonId = 1;
    if (plId) {
        const season = await db.query.seasons.findFirst({
            where: eq(schema.seasons.leagueId, plId) // Assuming year 2024 from above
        });
        if (season) seasonId = season.id;
    }

    const fixturesData = [
      { id: 1001, homeTeamId: 33, awayTeamId: 40, date: daysAgo(7), status: "FT", homeGoals: 2, awayGoals: 1 },
      { id: 1002, homeTeamId: 42, awayTeamId: 50, date: daysAgo(5), status: "FT", homeGoals: 1, awayGoals: 3 },
      { id: 1003, homeTeamId: 34, awayTeamId: 47, date: daysAgo(3), status: "FT", homeGoals: 0, awayGoals: 0 },
      { id: 1004, homeTeamId: 40, awayTeamId: 42, date: new Date(), status: "2H", homeGoals: 2, awayGoals: 2 },
      { id: 1005, homeTeamId: 50, awayTeamId: 33, date: daysFromNow(2), status: "NS", homeGoals: null, awayGoals: null },
      { id: 1006, homeTeamId: 47, awayTeamId: 34, date: daysFromNow(5), status: "NS", homeGoals: null, awayGoals: null },
    ];
    
    for (const fixture of fixturesData) {
      const homeId = teamMap.get(fixture.homeTeamId);
      const awayId = teamMap.get(fixture.awayTeamId);
      
      if (!homeId || !awayId) {
          console.warn(`[seed-mock] Skipping fixture ${fixture.id}: Teams not found (Home: ${fixture.homeTeamId}, Away: ${fixture.awayTeamId})`);
          continue;
      }

      // Get venue from home team
      const homeTeam = await db.query.teams.findFirst({
        where: eq(schema.teams.id, homeId)
      });
      const venueId = homeTeam?.venueId || null;
      
      // Upsert fixture based on externalId
      const existing = await db.query.fixtures.findFirst({
          where: eq(schema.fixtures.externalId, fixture.id)
      });
      
      if (!existing) {
          await db.insert(schema.fixtures).values({
            externalId: fixture.id,
            referee: "Mock Referee",
            timezone: "UTC",
            date: fixture.date,
            timestamp: Math.floor(fixture.date.getTime() / 1000),
            venueId: venueId,
            statusLong: fixture.status === "FT" ? "Match Finished" : fixture.status === "NS" ? "Not Started" : "Second Half",
            statusShort: fixture.status,
            statusElapsed: fixture.status === "2H" ? 65 : null,
            leagueId: plId || 1,
            seasonId: seasonId,
            round: "Regular Season - 1",
            homeTeamId: homeId,
            awayTeamId: awayId,
            goalsHome: fixture.homeGoals,
            goalsAway: fixture.awayGoals,
            scoreHalftimeHome: fixture.homeGoals !== null ? Math.floor(Number(fixture.homeGoals) / 2) : null,
            scoreHalftimeAway: fixture.awayGoals !== null ? Math.floor(Number(fixture.awayGoals) / 2) : null,
            scoreFulltimeHome: fixture.homeGoals,
            scoreFulltimeAway: fixture.awayGoals,
          } as any);
      }
    }
    
    console.log(`[seed-mock] Processed fixtures`);
    
    // ============================================================================
    // 4. PLAYERS
    // ============================================================================
    
    console.log("[seed-mock] Processing players...");
    
    const playersData = [
      { id: 2935, name: "Bruno Fernandes", firstname: "Bruno", lastname: "Fernandes", age: 29, nationality: "Portugal", height: "179 cm", weight: "69 kg", photo: "https://media.api-sports.io/football/players/2935.png", teamId: 33, leagueId: 39 },
      { id: 306, name: "Mohamed Salah", firstname: "Mohamed", lastname: "Salah", age: 31, nationality: "Egypt", height: "175 cm", weight: "71 kg", photo: "https://media.api-sports.io/football/players/306.png", teamId: 40, leagueId: 39 },
      { id: 635, name: "Kevin De Bruyne", firstname: "Kevin", lastname: "De Bruyne", age: 32, nationality: "Belgium", height: "181 cm", weight: "70 kg", photo: "https://media.api-sports.io/football/players/635.png", teamId: 50, leagueId: 39 },
      { id: 19182, name: "Bukayo Saka", firstname: "Bukayo", lastname: "Saka", age: 22, nationality: "England", height: "178 cm", weight: "70 kg", photo: "https://media.api-sports.io/football/players/19182.png", teamId: 42, leagueId: 39 },
      
      { id: 278, name: "Kylian Mbappé", firstname: "Kylian", lastname: "Mbappé", age: 25, nationality: "France", height: "178 cm", weight: "73 kg", photo: "https://media.api-sports.io/football/players/278.png", teamId: 541, leagueId: 140 }, 
      { id: 521, name: "Pedri", firstname: "Pedro", lastname: "González López", age: 21, nationality: "Spain", height: "174 cm", weight: "60 kg", photo: "https://media.api-sports.io/football/players/521.png", teamId: 529, leagueId: 140 }, 
      { id: 502, name: "Jamal Musiala", firstname: "Jamal", lastname: "Musiala", age: 21, nationality: "Germany", height: "184 cm", weight: "72 kg", photo: "https://media.api-sports.io/football/players/502.png", teamId: 157, leagueId: 78 }, 
    ];
    
    for (const player of playersData) {
      let playerId: number;
      const resolvedTeamId = teamMap.get(player.teamId);
      const resolvedLeagueId = leagueMap.get(player.leagueId);
      
      if (!resolvedTeamId || !resolvedLeagueId) {
          console.warn(`[seed-mock] Skipping player ${player.name}: League/Team not found`);
          continue;
      }
      
      const existing = await db.query.players.findFirst({
          where: eq(schema.players.externalId, player.id)
      });
      
      if (existing) {
          playerId = existing.id;
      } else {
          try {
            const res = await db.insert(schema.players).values({
                id: player.id,
                externalId: player.id,
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
            } as any).returning({ id: schema.players.id });
            playerId = res[0].id;
          } catch (e) {
            const res = await db.insert(schema.players).values({
                externalId: player.id,
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
            } as any).returning({ id: schema.players.id });
            playerId = res[0].id;
          }
      }
      
      playerMap.set(player.id, playerId);
      
      // Get season ID for this league
      let pSeasonId = 1;
      const s = await db.query.seasons.findFirst({
          where: eq(schema.seasons.leagueId, resolvedLeagueId)
      });
      if (s) pSeasonId = s.id;
      
      // Upsert statistics
      await db.insert(schema.playerStatistics).values({
        playerId: playerId,
        teamId: resolvedTeamId,
        leagueId: resolvedLeagueId,
        seasonId: pSeasonId,
        position: "Midfielder",
        rating: "7.5",
        captain: false,
        appearences: 12,
        lineups: 12,
        minutes: 1080,
        goalsTotal: 5,
        goalsAssists: 3,
        passesTotal: 450,
        passesAccuracy: 85,
      } as any).onConflictDoUpdate({ 
        target: [schema.playerStatistics.playerId, schema.playerStatistics.teamId, schema.playerStatistics.leagueId, schema.playerStatistics.seasonId],
        set: { rating: "7.5" } 
      });
    }
    
    console.log(`[seed-mock] Processed players`);
    
    // ============================================================================
    // 5. INJURIES
    // ============================================================================
    
    console.log("[seed-mock] Creating injuries...");
    
    const injuriesData = [
      { id: 1, playerId: 635, teamId: 50, leagueId: 39, type: "Hamstring", reason: "Muscle Strain", date: daysAgo(10) }, 
      { id: 2, playerId: 521, teamId: 529, leagueId: 140, type: "ACL", reason: "Knee Injury", date: daysAgo(30) }, 
      { id: 3, playerId: 278, teamId: 541, leagueId: 140, type: "Broken Nose", reason: "Collision", date: daysAgo(2) }, 
    ];
    
    for (const injury of injuriesData) {
        const pId = playerMap.get(injury.playerId);
        const tId = teamMap.get(injury.teamId);
        const lId = leagueMap.get(injury.leagueId);
        
        if (!pId || !tId || !lId) continue;
        
        // Find season
        let sId = 1;
        const s = await db.query.seasons.findFirst({
            where: eq(schema.seasons.leagueId, lId)
        });
        if (s) sId = s.id;
        
        // We just insert, assuming we want to add these specific injuries.
        // To avoid dupes, check if injury of same type/date exists
        const existing = await db.query.injuries.findFirst({
            where: eq(schema.injuries.playerId, pId) // Simple check, better to check type/date too
        });
        
        if (!existing) {
             await db.insert(schema.injuries).values({
                playerId: pId,
                teamId: tId,
                leagueId: lId,
                seasonId: sId,
                fixtureId: null,
                type: injury.type,
                reason: injury.reason,
                date: injury.date,
             } as any);
             
             await db.update(schema.players)
                .set({ injured: true })
                .where(eq(schema.players.id, pId));
        }
    }
    
    console.log(`[seed-mock] Processed injuries`);

    console.log("\n[seed-mock] ✅ Mock data population complete!");
    process.exit(0);
    
  } catch (error) {
    console.error("[seed-mock] ❌ Error:", error);
    process.exit(1);
  }
}

main();
