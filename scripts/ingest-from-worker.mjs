/**
 * Real Data Ingestion from User's Worker
 * 
 * Uses https://late-salad-0f98.gustavoss0406.workers.dev/ as upstream
 * to fetch real fixtures from top leagues with authentication
 */

import mysql from "mysql2/promise";

const WORKER_URL = "https://late-salad-0f98.gustavoss0406.workers.dev/";
const RATE_LIMIT_DELAY = 2000; // 2 seconds between requests

// Initialize database
const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Helper to delay between API calls
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch matches for a specific date
async function fetchMatchesForDate(date) {
  const url = `${WORKER_URL}?date=${date}`;
  console.log(`Fetching: ${url}`);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  await delay(RATE_LIMIT_DELAY);
  return response.json();
}

// Get date range for last N days
function getDateRange(days) {
  const dates = [];
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  
  return dates;
}

// Ingest a single match
async function ingestMatch(match) {
  try {
    // Insert home team
    if (match.homeTeam) {
      await connection.execute(
        `INSERT INTO teams (apiFootballId, name, code, logo, countryId) 
         VALUES (?, ?, ?, ?, NULL)
         ON DUPLICATE KEY UPDATE 
           name = VALUES(name),
           code = VALUES(code),
           logo = VALUES(logo)`,
        [
          match.homeTeam.id,
          match.homeTeam.name,
          match.homeTeam.tla || match.homeTeam.shortName?.substring(0, 3) || null,
          match.homeTeam.crest || null,
        ]
      );
    }
    
    // Insert away team
    if (match.awayTeam) {
      await connection.execute(
        `INSERT INTO teams (apiFootballId, name, code, logo, countryId) 
         VALUES (?, ?, ?, ?, NULL)
         ON DUPLICATE KEY UPDATE 
           name = VALUES(name),
           code = VALUES(code),
           logo = VALUES(logo)`,
        [
          match.awayTeam.id,
          match.awayTeam.name,
          match.awayTeam.tla || match.awayTeam.shortName?.substring(0, 3) || null,
          match.awayTeam.crest || null,
        ]
      );
    }
    
    // Get team IDs
    const [homeTeamRows] = await connection.execute(
      `SELECT id FROM teams WHERE apiFootballId = ? LIMIT 1`,
      [match.homeTeam.id]
    );
    const [awayTeamRows] = await connection.execute(
      `SELECT id FROM teams WHERE apiFootballId = ? LIMIT 1`,
      [match.awayTeam.id]
    );
    
    if (homeTeamRows.length === 0 || awayTeamRows.length === 0) {
      console.warn(`Skipping match ${match.id}: teams not found`);
      return false;
    }
    
    const homeTeamId = homeTeamRows[0].id;
    const awayTeamId = awayTeamRows[0].id;
    
    // Insert or get league
    if (match.competition) {
      // Map competition type to enum values (League or Cup)
      const leagueType = match.competition.type === "CUP" ? "Cup" : "League";
      
      await connection.execute(
        `INSERT INTO leagues (apiFootballId, name, type, logo, countryId) 
         VALUES (?, ?, ?, ?, NULL)
         ON DUPLICATE KEY UPDATE 
           name = VALUES(name),
           type = VALUES(type),
           logo = VALUES(logo)`,
        [
          match.competition.id,
          match.competition.name,
          leagueType,
          match.competition.emblem || null,
        ]
      );
    }
    
    // Get league ID
    const [leagueRows] = await connection.execute(
      `SELECT id FROM leagues WHERE apiFootballId = ? LIMIT 1`,
      [match.competition.id]
    );
    
    if (leagueRows.length === 0) {
      console.warn(`Skipping match ${match.id}: league not found`);
      return false;
    }
    
    const leagueId = leagueRows[0].id;
    
    // Map status
    const statusMap = {
      "FINISHED": "FT",
      "IN_PLAY": "LIVE",
      "PAUSED": "HT",
      "SCHEDULED": "NS",
      "TIMED": "NS",
      "POSTPONED": "PST",
      "CANCELLED": "CANC",
      "SUSPENDED": "SUSP",
    };
    
    const statusShort = statusMap[match.status] || "NS";
    const matchDate = new Date(match.utcDate);
    const timestamp = Math.floor(matchDate.getTime() / 1000);
    
    // Insert fixture
    await connection.execute(
      `INSERT INTO fixtures (
        apiFootballId, referee, timezone, date, timestamp, venueId,
        statusLong, statusShort, statusElapsed,
        leagueId, seasonId, round,
        homeTeamId, awayTeamId,
        goalsHome, goalsAway,
        scoreHalftimeHome, scoreHalftimeAway,
        scoreFulltimeHome, scoreFulltimeAway,
        scoreExtratimeHome, scoreExtratimeAway,
        scorePenaltyHome, scorePenaltyAway
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        statusLong = VALUES(statusLong),
        statusShort = VALUES(statusShort),
        statusElapsed = VALUES(statusElapsed),
        goalsHome = VALUES(goalsHome),
        goalsAway = VALUES(goalsAway),
        scoreHalftimeHome = VALUES(scoreHalftimeHome),
        scoreHalftimeAway = VALUES(scoreHalftimeAway),
        scoreFulltimeHome = VALUES(scoreFulltimeHome),
        scoreFulltimeAway = VALUES(scoreFulltimeAway)`,
      [
        match.id,
        match.referees?.[0]?.name || null,
        "UTC",
        matchDate,
        timestamp,
        null, // venueId
        match.status,
        statusShort,
        match.minute || null,
        leagueId,
        null, // seasonId
        match.matchday ? `Regular Season - ${match.matchday}` : match.stage || null,
        homeTeamId,
        awayTeamId,
        match.score?.fullTime?.home || null,
        match.score?.fullTime?.away || null,
        match.score?.halfTime?.home || null,
        match.score?.halfTime?.away || null,
        match.score?.fullTime?.home || null,
        match.score?.fullTime?.away || null,
        match.score?.extraTime?.home || null,
        match.score?.extraTime?.away || null,
        match.score?.penalties?.home || null,
        match.score?.penalties?.away || null,
      ]
    );
    
    return true;
  } catch (error) {
    console.error(`✗ Failed to ingest match ${match.id}:`, error.message);
    return false;
  }
}

// Main ingestion flow
async function main() {
  console.log("Starting real data ingestion from user's worker");
  console.log(`Worker URL: ${WORKER_URL}`);
  console.log("Fetching last 30 days of fixtures...\n");
  
  const dates = getDateRange(30);
  let totalMatches = 0;
  let ingestedMatches = 0;
  
  try {
    for (const date of dates) {
      console.log(`\n=== Processing date: ${date} ===`);
      
      try {
        const data = await fetchMatchesForDate(date);
        
        if (!data.matches || data.matches.length === 0) {
          console.log("No matches found for this date");
          continue;
        }
        
        console.log(`Found ${data.matches.length} matches`);
        totalMatches += data.matches.length;
        
        for (const match of data.matches) {
          const success = await ingestMatch(match);
          if (success) {
            ingestedMatches++;
            console.log(`✓ ${match.homeTeam.name} vs ${match.awayTeam.name} (${match.competition.name})`);
          }
        }
      } catch (error) {
        console.error(`✗ Failed to process date ${date}:`, error.message);
      }
    }
    
    console.log("\n=== Ingestion Complete ===");
    console.log(`Total matches found: ${totalMatches}`);
    console.log(`Successfully ingested: ${ingestedMatches}`);
    console.log(`Success rate: ${((ingestedMatches / totalMatches) * 100).toFixed(1)}%`);
    
    // Close connection
    await connection.end();
    
  } catch (error) {
    console.error("\n=== Ingestion Failed ===");
    console.error(error);
    await connection.end();
    process.exit(1);
  }
}

main();
