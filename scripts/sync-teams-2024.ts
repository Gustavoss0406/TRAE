
import "dotenv/config";
import { getDb } from "../server/db";
import { footballDataV4Client } from "../server/ingestion/sources/football-data-v4";
import { teams, venues, countries, leagues } from "../drizzle/schema";
import { eq, ilike } from "drizzle-orm";

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
  console.log("Starting Teams Sync for 2024 (Source: Football-Data.org)...");
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  for (const reqLeague of REQUESTED_LEAGUES) {
    try {
        console.log(`\nFetching teams for ${reqLeague.name} (API ID: ${reqLeague.id})...`);
        
        // Use 2023 season as it's more likely to be available and complete for free tier
        // Or 2024 if available. 
        let response = await footballDataV4Client.getTeams(reqLeague.id, 2023);
        
        if (!response) {
             console.log("Retrying with season 2022...");
             response = await footballDataV4Client.getTeams(reqLeague.id, 2022);
        }

        if (!response || !response.teams || response.teams.length === 0) {
            console.log(`No teams found for ${reqLeague.name}. Skipping.`);
            continue;
        }

        await processTeams(db, response.teams, reqLeague.id);

    } catch (error: any) {
        console.error(`Failed to fetch teams for ${reqLeague.name}:`, error.message);
    }
  }

  console.log("\nTeams Sync Complete.");
}

async function processTeams(db: any, teamsData: any[], leagueId: number) {
    console.log(`Processing ${teamsData.length} teams...`);

    // Get league country to fallback
    const leagueRec = await db.select().from(leagues).where(eq(leagues.apiFootballId, leagueId)).limit(1);
    const leagueCountryId = leagueRec[0]?.countryId;

    for (const teamInfo of teamsData) {
        // teamInfo is from Football-Data.org
        // { id, name, shortName, tla, crest, address, website, founded, clubColors, venue, ... }

        // 1. Sync Venue
        let venueId = null;
        if (teamInfo.venue) {
            // Find by name
            const existingVenue = await db.select().from(venues).where(ilike(venues.name, teamInfo.venue)).limit(1);
            if (existingVenue.length > 0) {
                venueId = existingVenue[0].id;
            } else {
                const [newVenue] = await db.insert(venues).values({
                    name: teamInfo.venue,
                    address: teamInfo.address, // Use team address as proxy or null
                    city: null, // Not provided directly
                    capacity: null,
                }).returning({ id: venues.id });
                venueId = newVenue.id;
            }
        }

        // 2. Sync Country
        // Football-Data.org teams have `area` { id, name, code, flag } usually
        let countryId = leagueCountryId;
        if (teamInfo.area && teamInfo.area.name) {
             const countryRec = await db.select().from(countries).where(ilike(countries.name, teamInfo.area.name)).limit(1);
             if (countryRec.length > 0) {
                 countryId = countryRec[0].id;
             } else {
                 // Insert country?
                 const [newCountry] = await db.insert(countries).values({
                     name: teamInfo.area.name,
                     code: teamInfo.area.code,
                     flag: teamInfo.area.flag
                 }).returning({ id: countries.id });
                 countryId = newCountry.id;
             }
        }

        // 3. Sync Team
        // Try to match by Name first (most reliable across providers)
        // Normalizing names can be tricky (e.g. "Man City" vs "Manchester City")
        // We use ilike.
        
        let existingTeam = await db.select().from(teams).where(ilike(teams.name, teamInfo.name)).limit(1);
        
        if (existingTeam.length === 0 && teamInfo.shortName) {
             existingTeam = await db.select().from(teams).where(ilike(teams.name, teamInfo.shortName)).limit(1);
        }

        if (existingTeam.length === 0) {
            // Check if ID exists (unlikely collision but check)
            // We store FD ID in apiFootballId for now, but handle conflict
            const checkId = await db.select().from(teams).where(eq(teams.apiFootballId, teamInfo.id)).limit(1);
            
            if (checkId.length > 0) {
                // ID collision! This team exists but name didn't match.
                // It means we already have this team from FD before?
                // Just update it.
                await db.update(teams).set({
                    name: teamInfo.name,
                    code: teamInfo.tla,
                    countryId: countryId,
                    founded: teamInfo.founded,
                    logo: teamInfo.crest,
                    venueId: venueId,
                    updatedAt: new Date()
                }).where(eq(teams.id, checkId[0].id));
            } else {
                // Insert new team
                await db.insert(teams).values({
                    apiFootballId: teamInfo.id, // Using FD ID
                    name: teamInfo.name,
                    code: teamInfo.tla,
                    countryId: countryId,
                    founded: teamInfo.founded,
                    national: false, // Default
                    logo: teamInfo.crest,
                    venueId: venueId
                });
            }
        } else {
            // Update existing team
             await db.update(teams).set({
                // Don't overwrite apiFootballId if it differs, as it might be real API-Football ID
                // But update other fields
                code: teamInfo.tla || existingTeam[0].code,
                countryId: countryId || existingTeam[0].countryId,
                founded: teamInfo.founded || existingTeam[0].founded,
                logo: teamInfo.crest || existingTeam[0].logo,
                venueId: venueId || existingTeam[0].venueId,
                updatedAt: new Date()
            }).where(eq(teams.id, existingTeam[0].id));
        }
    }
}

run();
