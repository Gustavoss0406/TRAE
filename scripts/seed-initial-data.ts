
import { FootballDataOrgClient } from "../server/ingestion/sources/football-data-org";
import { config } from "dotenv";
import { getDb } from "../server/db";
import { countries, leagues, seasons, teams, venues } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

config();

async function main() {
  console.log("Starting initial data seed...");
  
  const client = new FootballDataOrgClient();
  const db = await getDb();
  
  if (!db) {
    console.error("Database connection failed");
    process.exit(1);
  }

  try {
    // 1. Fetch specific country: England
    console.log("Fetching countries...");
    const countriesData = await client.getCountries();
    const england = countriesData.response.find((c: any) => c.name === "England");
    
    if (!england) {
      throw new Error("England not found in API response");
    }

    console.log(`Upserting country: ${england.name}`);
    
    // Check if exists first (since we don't have UPSERT across all DBs easily with Drizzle without specific dialect helpers sometimes)
    // But postgres supports ON CONFLICT
    
    // We need to insert country
    // Since id is serial, we should look up by name or code if we want to avoid dups, or just insert if empty.
    // For this script, let's try to find it first.
    
    let countryId;
    const existingCountry = await db.select().from(countries).where(eq(countries.name, england.name)).limit(1);
    
    if (existingCountry.length > 0) {
      countryId = existingCountry[0].id;
      console.log(`Country ${england.name} already exists (ID: ${countryId})`);
    } else {
      const [inserted] = await db.insert(countries).values({
        name: england.name,
        code: england.code,
        flag: england.flag,
      }).returning();
      countryId = inserted.id;
      console.log(`Inserted country ${england.name} (ID: ${countryId})`);
    }

    // 2. Fetch Premier League (ID 39)
    console.log("Fetching Premier League...");
    const leaguesResponse = await client.getLeagues({ id: 39 });
    const plData = leaguesResponse.response[0]; // League object

    if (!plData) {
      throw new Error("Premier League not found");
    }

    console.log(`Upserting league: ${plData.league.name}`);
    
    let leagueId;
    const existingLeague = await db.select().from(leagues).where(eq(leagues.apiFootballId, plData.league.id)).limit(1);
    
    if (existingLeague.length > 0) {
      leagueId = existingLeague[0].id;
      console.log(`League ${plData.league.name} already exists (ID: ${leagueId})`);
    } else {
      const [inserted] = await db.insert(leagues).values({
        apiFootballId: plData.league.id,
        name: plData.league.name,
        type: plData.league.type.toLowerCase(), // 'League' -> 'league'
        logo: plData.league.logo,
        countryId: countryId,
      }).returning();
      leagueId = inserted.id;
      console.log(`Inserted league ${plData.league.name} (ID: ${leagueId})`);
    }

    // 3. Insert Seasons
    console.log("Upserting seasons...");
    for (const seasonData of plData.seasons) {
        // Only interested in recent seasons to save space/time, e.g. 2023, 2024
        if (seasonData.year < 2023) continue;

        let seasonId;
        // Check uniqueness by leagueId + year
        const existingSeason = await db.select().from(seasons)
            .where(and(eq(seasons.leagueId, leagueId), eq(seasons.year, seasonData.year)))
            .limit(1);
            
        if (existingSeason.length > 0) {
            seasonId = existingSeason[0].id;
            console.log(`Season ${seasonData.year} already exists`);
            // Update current flag
            if (existingSeason[0].current !== seasonData.current) {
                await db.update(seasons).set({ current: seasonData.current }).where(eq(seasons.id, seasonId));
            }
        } else {
            const [inserted] = await db.insert(seasons).values({
                leagueId: leagueId,
                year: seasonData.year,
                start: new Date(seasonData.start),
                end: new Date(seasonData.end),
                current: seasonData.current,
                coverageFixturesEvents: seasonData.coverage.fixtures.events,
                coverageFixturesLineups: seasonData.coverage.fixtures.lineups,
                coverageFixturesStatistics: seasonData.coverage.fixtures.statistics_fixtures,
                coverageFixturesPlayers: seasonData.coverage.fixtures.statistics_players,
                coverageStandings: seasonData.coverage.standings,
                coveragePlayers: seasonData.coverage.players,
                coverageTopScorers: seasonData.coverage.top_scorers,
                coverageTopAssists: seasonData.coverage.top_assists,
                coverageTopCards: seasonData.coverage.top_cards,
                coverageInjuries: seasonData.coverage.injuries,
                coveragePredictions: seasonData.coverage.predictions,
                coverageOdds: seasonData.coverage.odds,
            }).returning();
            seasonId = inserted.id;
            console.log(`Inserted season ${seasonData.year}`);
        }
        
        // Fetch teams for this season
        console.log(`Fetching teams for season ${seasonData.year}...`);
        const teamsResponse = await client.getTeams(plData.league.id, seasonData.year);
        console.log(`Found ${teamsResponse.response?.length || 0} teams.`);
        
        for (const teamItem of teamsResponse.response) {
                const teamData = teamItem.team;
                const venueData = teamItem.venue;
                
                // Upsert Venue
                let venueId = null;
                if (venueData && venueData.id) {
                     const existingVenue = await db.select().from(venues).where(eq(venues.name, venueData.name)).limit(1);
                     if (existingVenue.length > 0) {
                         venueId = existingVenue[0].id;
                         if (!existingVenue[0].apiFootballId) {
                             await db.update(venues).set({ apiFootballId: venueData.id }).where(eq(venues.id, venueId));
                             console.log(`Updated venue ${venueData.name} with apiFootballId: ${venueData.id}`);
                         }
                     } else {
                         const [insertedVenue] = await db.insert(venues).values({
                             apiFootballId: venueData.id,
                             name: venueData.name,
                             address: venueData.address,
                             city: venueData.city,
                             capacity: venueData.capacity,
                             surface: venueData.surface,
                             image: venueData.image,
                             countryId: countryId
                         }).returning();
                         venueId = insertedVenue.id;
                     }
                }
                
                // Upsert Team
                const existingTeam = await db.select().from(teams).where(eq(teams.name, teamData.name)).limit(1);
                if (existingTeam.length === 0) {
                    await db.insert(teams).values({
                        apiFootballId: teamData.id,
                        name: teamData.name,
                        code: teamData.code,
                        countryId: countryId,
                        founded: teamData.founded,
                        national: teamData.national,
                        logo: teamData.logo,
                        venueId: venueId
                    });
                    console.log(`Inserted team: ${teamData.name}`);
                } else {
                     if (!existingTeam[0].apiFootballId) {
                         await db.update(teams).set({ apiFootballId: teamData.id }).where(eq(teams.id, existingTeam[0].id));
                         console.log(`Updated team ${teamData.name} with apiFootballId: ${teamData.id}`);
                     }
                }
        }
    }

    console.log("Seed completed successfully!");
    process.exit(0);

  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

main();
