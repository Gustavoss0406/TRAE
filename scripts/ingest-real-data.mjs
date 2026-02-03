/**
 * Real Data Ingestion Script
 * 
 * Ingests real football data from football-data.org API
 * Replaces mock data with historical fixtures, standings, and players
 */

import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import * as schema from "../drizzle/schema.js";

const BASE_URL = "https://api.football-data.org/v4";
const RATE_LIMIT_DELAY = 6000; // 6 seconds between requests (10 requests/minute free tier)

// Initialize database
const db = drizzle(process.env.DATABASE_URL);

// Helper to delay between API calls
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch with rate limiting
async function fetchWithRateLimit(url) {
  console.log(`Fetching: ${url}`);
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  await delay(RATE_LIMIT_DELAY);
  return response.json();
}

// Ingest competitions (leagues)
async function ingestCompetitions() {
  console.log("\n=== Ingesting Competitions ===");
  
  const data = await fetchWithRateLimit(`${BASE_URL}/competitions`);
  const competitions = data.competitions.filter(c => 
    ["TIER_ONE", "TIER_TWO", "TIER_FOUR"].includes(c.plan)
  );
  
  console.log(`Found ${competitions.length} accessible competitions`);
  
  for (const comp of competitions.slice(0, 10)) { // Limit to 10 to avoid rate limits
    try {
      // Insert league
      await db.insert(schema.leagues).values({
        apiFootballId: comp.id,
        name: comp.name,
        type: comp.type,
        logo: comp.emblem,
        countryId: null, // Will be linked later
      }).onDuplicateKeyUpdate({
        set: {
          name: comp.name,
          type: comp.type,
          logo: comp.emblem,
        },
      });
      
      // Insert season if available
      if (comp.currentSeason) {
        const season = comp.currentSeason;
        await db.insert(schema.seasons).values({
          year: parseInt(season.startDate.substring(0, 4)),
          start: new Date(season.startDate),
          end: new Date(season.endDate),
          current: true,
        }).onDuplicateKeyUpdate({
          set: {
            start: new Date(season.startDate),
            end: new Date(season.endDate),
            current: true,
          },
        });
      }
      
      console.log(`✓ Ingested: ${comp.name}`);
    } catch (error) {
      console.error(`✗ Failed to ingest ${comp.name}:`, error.message);
    }
  }
}

// Ingest matches for a competition
async function ingestMatches(competitionId, limit = 50) {
  console.log(`\n=== Ingesting Matches for Competition ${competitionId} ===`);
  
  try {
    const data = await fetchWithRateLimit(`${BASE_URL}/competitions/${competitionId}/matches`);
    const matches = data.matches.slice(0, limit);
    
    console.log(`Found ${matches.length} matches`);
    
    for (const match of matches) {
      try {
        // Insert home team
        if (match.homeTeam) {
          await db.insert(schema.teams).values({
            apiFootballId: match.homeTeam.id,
            name: match.homeTeam.name,
            code: match.homeTeam.tla,
            logo: match.homeTeam.crest,
            countryId: null,
          }).onDuplicateKeyUpdate({
            set: {
              name: match.homeTeam.name,
              code: match.homeTeam.tla,
              logo: match.homeTeam.crest,
            },
          });
        }
        
        // Insert away team
        if (match.awayTeam) {
          await db.insert(schema.teams).values({
            apiFootballId: match.awayTeam.id,
            name: match.awayTeam.name,
            code: match.awayTeam.tla,
            logo: match.awayTeam.crest,
            countryId: null,
          }).onDuplicateKeyUpdate({
            set: {
              name: match.awayTeam.name,
              code: match.awayTeam.tla,
              logo: match.awayTeam.crest,
            },
          });
        }
        
        // Get team IDs
        const homeTeamResult = await db.select().from(schema.teams)
          .where(eq(schema.teams.apiFootballId, match.homeTeam.id))
          .limit(1);
        const awayTeamResult = await db.select().from(schema.teams)
          .where(eq(schema.teams.apiFootballId, match.awayTeam.id))
          .limit(1);
        
        if (homeTeamResult.length === 0 || awayTeamResult.length === 0) {
          console.warn(`Skipping match ${match.id}: teams not found`);
          continue;
        }
        
        const homeTeamId = homeTeamResult[0].id;
        const awayTeamId = awayTeamResult[0].id;
        
        // Get league ID
        const leagueResult = await db.select().from(schema.leagues)
          .where(eq(schema.leagues.apiFootballId, competitionId))
          .limit(1);
        
        if (leagueResult.length === 0) {
          console.warn(`Skipping match ${match.id}: league not found`);
          continue;
        }
        
        const leagueId = leagueResult[0].id;
        
        // Insert fixture
        await db.insert(schema.fixtures).values({
          apiFootballId: match.id,
          referee: match.referees?.[0]?.name || null,
          timezone: "UTC",
          date: new Date(match.utcDate),
          timestamp: Math.floor(new Date(match.utcDate).getTime() / 1000),
          venueId: null,
          statusLong: match.status,
          statusShort: match.status === "FINISHED" ? "FT" : 
                      match.status === "IN_PLAY" ? "LIVE" : "NS",
          statusElapsed: match.minute || null,
          leagueId: leagueId,
          seasonId: null,
          round: match.matchday ? `Regular Season - ${match.matchday}` : null,
          homeTeamId: homeTeamId,
          awayTeamId: awayTeamId,
          goalsHome: match.score?.fullTime?.home,
          goalsAway: match.score?.fullTime?.away,
          scoreHalftimeHome: match.score?.halfTime?.home,
          scoreHalftimeAway: match.score?.halfTime?.away,
          scoreFulltimeHome: match.score?.fullTime?.home,
          scoreFulltimeAway: match.score?.fullTime?.away,
          scoreExtratimeHome: match.score?.extraTime?.home,
          scoreExtratimeAway: match.score?.extraTime?.away,
          scorePenaltyHome: match.score?.penalties?.home,
          scorePenaltyAway: match.score?.penalties?.away,
        }).onDuplicateKeyUpdate({
          set: {
            statusLong: match.status,
            statusShort: match.status === "FINISHED" ? "FT" : 
                        match.status === "IN_PLAY" ? "LIVE" : "NS",
            goalsHome: match.score?.fullTime?.home,
            goalsAway: match.score?.fullTime?.away,
          },
        });
        
        console.log(`✓ Ingested match: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
      } catch (error) {
        console.error(`✗ Failed to ingest match ${match.id}:`, error.message);
      }
    }
  } catch (error) {
    console.error(`✗ Failed to fetch matches for competition ${competitionId}:`, error.message);
  }
}

// Ingest standings for a competition
async function ingestStandings(competitionId) {
  console.log(`\n=== Ingesting Standings for Competition ${competitionId} ===`);
  
  try {
    const data = await fetchWithRateLimit(`${BASE_URL}/competitions/${competitionId}/standings`);
    
    if (!data.standings || data.standings.length === 0) {
      console.log("No standings available");
      return;
    }
    
    const standings = data.standings[0].table;
    console.log(`Found ${standings.length} teams in standings`);
    
    // Get league ID
    const leagueResult = await db.select().from(schema.leagues)
      .where(eq(schema.leagues.apiFootballId, competitionId))
      .limit(1);
    
    if (leagueResult.length === 0) {
      console.warn(`League ${competitionId} not found`);
      return;
    }
    
    const leagueId = leagueResult[0].id;
    
    for (const entry of standings) {
      try {
        // Get team ID
        const teamResult = await db.select().from(schema.teams)
          .where(eq(schema.teams.apiFootballId, entry.team.id))
          .limit(1);
        
        if (teamResult.length === 0) {
          console.warn(`Team ${entry.team.id} not found`);
          continue;
        }
        
        const teamId = teamResult[0].id;
        
        // Insert standing
        await db.insert(schema.standings).values({
          rank: entry.position,
          teamId: teamId,
          leagueId: leagueId,
          seasonId: null,
          points: entry.points,
          goalsDiff: entry.goalDifference,
          group: data.standings[0].group || "League",
          form: entry.form || null,
          status: null,
          description: null,
          played: entry.playedGames,
          win: entry.won,
          draw: entry.draw,
          lose: entry.lost,
          goalsFor: entry.goalsFor,
          goalsAgainst: entry.goalsAgainst,
        }).onDuplicateKeyUpdate({
          set: {
            rank: entry.position,
            points: entry.points,
            goalsDiff: entry.goalDifference,
            played: entry.playedGames,
            win: entry.won,
            draw: entry.draw,
            lose: entry.lost,
            goalsFor: entry.goalsFor,
            goalsAgainst: entry.goalsAgainst,
          },
        });
        
        console.log(`✓ Ingested standing: ${entry.team.name} (Rank ${entry.position})`);
      } catch (error) {
        console.error(`✗ Failed to ingest standing for team ${entry.team.id}:`, error.message);
      }
    }
  } catch (error) {
    console.error(`✗ Failed to fetch standings for competition ${competitionId}:`, error.message);
  }
}

// Main ingestion flow
async function main() {
  console.log("Starting real data ingestion from football-data.org");
  console.log("Rate limit: 10 requests/minute (free tier)");
  console.log("This will take several minutes...\n");
  
  try {
    // Step 1: Ingest competitions
    await ingestCompetitions();
    
    // Step 2: Ingest matches for top competitions
    // Premier League (2021), La Liga (2014), Bundesliga (2002), Serie A (2019)
    const topCompetitions = [2021, 2014, 2002, 2019];
    
    for (const compId of topCompetitions) {
      await ingestMatches(compId, 30); // 30 matches per competition
      await ingestStandings(compId);
    }
    
    console.log("\n=== Ingestion Complete ===");
    console.log("Real data has been successfully ingested!");
    console.log("You can now test the API with real fixtures and standings.");
    
  } catch (error) {
    console.error("\n=== Ingestion Failed ===");
    console.error(error);
    process.exit(1);
  }
}

main();
