/**
 * Leagues Sync Worker
 * 
 * Synchronizes leagues and seasons from football-data.org (API-Football) to Postgres database.
 * - Syncs Countries
 * - Syncs Leagues
 * - Syncs Seasons (including current season flag and coverage details)
 * 
 * Runs once a day to keep season definitions up-to-date.
 * Optimized for high volume: uses batch processing and upserts to avoid N+1 queries.
 */

import { footballDataClient } from "../ingestion/sources/football-data-org";
import { syncLogger } from "../ingestion/utils/sync-logger";
import { getDb } from "../db";
import { countries, leagues, seasons } from "../../drizzle/schema";
import { eq, sql } from "drizzle-orm";

export async function syncLeagues() {
  const context = syncLogger.startSync("leagues-sync");
  
  try {
    console.log("[leagues-sync] Starting leagues synchronization...");
    
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }
    
    // Fetch all leagues (1 request, ~1200 items)
    console.log("[leagues-sync] Fetching leagues from API...");
    const response = await footballDataClient.getLeagues();
    
    if (!response || !response.response) {
      throw new Error("Invalid response from API");
    }
    
    const leaguesData = response.response;
    console.log(`[leagues-sync] Received ${leaguesData.length} leagues. Filtering for requested leagues...`);

    // Define requested leagues with flexibility for names/aliases
    const WANTED_LEAGUES_CONFIG = [
        { name: "Premier League", country: "England" },
        { name: "Bundesliga", country: "Germany" },
        { name: "Serie A", country: "Italy" },
        { name: "La Liga", country: "Spain", aliases: ["Primera Division"] },
        { name: "Ligue 1", country: "France" },
        { name: "Liga Portugal", country: "Portugal", aliases: ["Primeira Liga"] },
        { name: "Eredivisie", country: "Netherlands" },
        { name: "Championship", country: "England" },
        { name: "Serie A", country: "Brazil", aliases: ["Brasileirão", "Campeonato Brasileiro Série A"] },
        { name: "UEFA Champions League", country: "World" },
        { name: "World Cup", country: "World", aliases: ["FIFA World Cup"] },
        { name: "Euro Championship", country: "World", aliases: ["UEFA Euro", "European Championship"] },
    ];

    const filteredLeaguesData = leaguesData.filter((item: any) => {
        const leagueName = item.league.name;
        const countryName = item.country.name;

        return WANTED_LEAGUES_CONFIG.some(config => {
            const countryMatch = config.country === countryName;
            if (!countryMatch) return false;

            const nameMatch = leagueName === config.name || 
                              (config.aliases && config.aliases.includes(leagueName));
            return nameMatch;
        });
    });

    console.log(`[leagues-sync] Filtered down to ${filteredLeaguesData.length} leagues.`);
    
    // ---------------------------------------------------------
    // 1. Sync Countries
    // ---------------------------------------------------------
    
    // Fetch existing countries
    const existingCountries = await db.select().from(countries);
    const countryMap = new Map(existingCountries.map(c => [c.name, c.id]));
    
    // Identify new countries
    const newCountriesMap = new Map<string, any>();
    
    for (const item of filteredLeaguesData) {
      const { country } = item;
      if (country && country.name !== "World" && !countryMap.has(country.name)) {
        if (!newCountriesMap.has(country.name)) {
          newCountriesMap.set(country.name, {
            name: country.name,
            code: country.code,
            flag: country.flag
          });
        }
      }
    }
    
    // Bulk Insert New Countries
    if (newCountriesMap.size > 0) {
      console.log(`[leagues-sync] Inserting ${newCountriesMap.size} new countries...`);
      const newCountriesArray = Array.from(newCountriesMap.values());
      
      const insertedCountries = await db.insert(countries)
        .values(newCountriesArray)
        .returning({ id: countries.id, name: countries.name });
        
      // Update map with new IDs
      for (const c of insertedCountries) {
        countryMap.set(c.name, c.id);
      }
      context.recordsInserted += insertedCountries.length;
    }

    // ---------------------------------------------------------
    // 2. Sync Leagues
    // ---------------------------------------------------------
    
    // Prepare league records for upsert
    const leaguesToUpsert: any[] = [];
    
    for (const item of filteredLeaguesData) {
      const { league, country } = item;
      let countryId: number | null = null;
      
      if (country && country.name !== "World") {
        countryId = countryMap.get(country.name) || null;
      }
      
      leaguesToUpsert.push({
        apiFootballId: league.id,
        name: league.name,
        type: league.type === "Cup" ? "cup" : "league",
        logo: league.logo,
        countryId: countryId,
        updatedAt: new Date() // Will be updated on conflict
      });
    }
    
    // Bulk Upsert Leagues
    // Postgres supports ON CONFLICT on unique columns (apiFootballId)
    if (leaguesToUpsert.length > 0) {
      console.log(`[leagues-sync] Upserting ${leaguesToUpsert.length} leagues...`);
      
      // Perform upsert and return IDs
      const upsertedLeagues = await db.insert(leagues)
        .values(leaguesToUpsert)
        .onConflictDoUpdate({
          target: leagues.apiFootballId,
          set: {
            name: sql`excluded.name`,
            type: sql`excluded.type`,
            logo: sql`excluded.logo`,
            countryId: sql`excluded."countryId"`,
            updatedAt: new Date()
          }
        })
        .returning({ id: leagues.id, apiFootballId: leagues.apiFootballId });
        
      context.recordsUpdated += upsertedLeagues.length; // Approximate, counts both inserts and updates
      
      // Create Map for League IDs
      const leagueMap = new Map(upsertedLeagues.map(l => [l.apiFootballId, l.id]));
      
      // ---------------------------------------------------------
      // 3. Sync Seasons
      // ---------------------------------------------------------
      
      const seasonsToUpsert: any[] = [];
      
      for (const item of leaguesData) {
        const leagueId = leagueMap.get(item.league.id);
        if (!leagueId) continue; // Should not happen
        
        for (const season of item.seasons) {
          seasonsToUpsert.push({
            leagueId,
            year: season.year,
            start: new Date(season.start),
            end: new Date(season.end),
            current: season.current,
            coverageFixturesEvents: season.coverage.fixtures.events,
            coverageFixturesLineups: season.coverage.fixtures.lineups,
            coverageFixturesStatistics: season.coverage.fixtures.statistics_fixtures,
            coverageFixturesPlayers: season.coverage.fixtures.statistics_players,
            coverageStandings: season.coverage.standings,
            coveragePlayers: season.coverage.players,
            coverageTopScorers: season.coverage.top_scorers,
            coverageTopAssists: season.coverage.top_assists,
            coverageTopCards: season.coverage.top_cards,
            coverageInjuries: season.coverage.injuries,
            coveragePredictions: season.coverage.predictions,
            coverageOdds: season.coverage.odds,
            updatedAt: new Date()
          });
        }
      }
      
      // Bulk Upsert Seasons
      // Constraint: seasons_league_year_unique (leagueId, year)
      if (seasonsToUpsert.length > 0) {
        console.log(`[leagues-sync] Upserting ${seasonsToUpsert.length} seasons...`);
        
        // Process in chunks if too large (Postgres parameter limit is 65535)
        // Each row has ~18 params. 65000 / 18 ~= 3600 rows per chunk.
        // Let's use 2000 as a safe chunk size.
        const chunkSize = 2000;
        
        for (let i = 0; i < seasonsToUpsert.length; i += chunkSize) {
          const chunk = seasonsToUpsert.slice(i, i + chunkSize);
          
          await db.insert(seasons)
            .values(chunk)
            .onConflictDoUpdate({
              target: [seasons.leagueId, seasons.year], // Composite unique key
              set: {
                start: sql`excluded.start`,
                end: sql`excluded.end`,
                current: sql`excluded.current`,
                coverageFixturesEvents: sql`excluded."coverageFixturesEvents"`,
                coverageFixturesLineups: sql`excluded."coverageFixturesLineups"`,
                coverageFixturesStatistics: sql`excluded."coverageFixturesStatistics"`,
                coverageFixturesPlayers: sql`excluded."coverageFixturesPlayers"`,
                coverageStandings: sql`excluded."coverageStandings"`,
                coveragePlayers: sql`excluded."coveragePlayers"`,
                coverageTopScorers: sql`excluded."coverageTopScorers"`,
                coverageTopAssists: sql`excluded."coverageTopAssists"`,
                coverageTopCards: sql`excluded."coverageTopCards"`,
                coverageInjuries: sql`excluded."coverageInjuries"`,
                coveragePredictions: sql`excluded."coveragePredictions"`,
                coverageOdds: sql`excluded."coverageOdds"`,
                updatedAt: new Date()
              }
            });
            
          context.recordsUpdated += chunk.length;
        }
      }
    }
    
    console.log("[leagues-sync] Synchronization completed successfully.");
    const log = syncLogger.endSync(context, "football-data.org");
    return { success: true, log };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    context.errors.push(`Fatal error: ${errorMsg}`);
    console.error("[leagues-sync] Fatal error:", error);
    const log = syncLogger.endSync(context, "football-data.org");
    return { success: false, log, error: errorMsg };
  }
}
