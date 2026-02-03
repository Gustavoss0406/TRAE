/**
 * Minimal seed data for external validation
 * Populates just enough data to test API endpoints
 */

import { drizzle } from "drizzle-orm/mysql2";
import {
  countries,
  leagues,
  seasons,
  teams,
  venues,
  fixtures,
  standings,
  players,
} from "../drizzle/schema.js";

const db = drizzle(process.env.DATABASE_URL);

async function seedMinimalData() {
  console.log("Seeding minimal data for external validation...\n");

  try {
    // 1. Insert England
    console.log("1. Inserting country (England)...");
    const [country] = await db
      .insert(countries)
      .values({
        name: "England",
        code: "GB",
        flag: "https://media.api-sports.io/flags/gb.svg",
      })
      .onDuplicateKeyUpdate({ set: { flag: "https://media.api-sports.io/flags/gb.svg" } });

    // 2. Insert Premier League
    console.log("2. Inserting league (Premier League)...");
    const [league] = await db
      .insert(leagues)
      .values({
        apiId: 39,
        name: "Premier League",
        type: "League",
        logo: "https://media.api-sports.io/football/leagues/39.png",
        countryName: "England",
      })
      .onDuplicateKeyUpdate({ set: { name: "England" } });

    // 3. Insert 2024 season
    console.log("3. Inserting season (2024)...");
    const [season] = await db
      .insert(seasons)
      .values({
        leagueApiId: 39,
        year: 2024,
        start: new Date("2024-08-16"),
        end: new Date("2025-05-25"),
        current: true,
      })
      .onDuplicateKeyUpdate({ set: { current: true } });

    // 4. Insert venues
    console.log("4. Inserting venues...");
    await db
      .insert(venues)
      .values([
        {
          apiId: 508,
          name: "Anfield",
          address: "Anfield Road",
          city: "Liverpool",
          capacity: 54074,
          surface: "grass",
          image: "https://media.api-sports.io/football/venues/508.png",
        },
        {
          apiId: 555,
          name: "Etihad Stadium",
          address: "Ashton New Road",
          city: "Manchester",
          capacity: 55097,
          surface: "grass",
          image: "https://media.api-sports.io/football/venues/555.png",
        },
      ])
      .onDuplicateKeyUpdate({ set: { name: "England" } });

    // 5. Insert teams
    console.log("5. Inserting teams...");
    await db
      .insert(teams)
      .values([
        {
          apiId: 40,
          name: "Liverpool",
          code: "LIV",
          country: "England",
          founded: 1892,
          national: false,
          logo: "https://media.api-sports.io/football/teams/40.png",
          venueApiId: 508,
        },
        {
          apiId: 50,
          name: "Manchester City",
          code: "MCI",
          country: "England",
          founded: 1880,
          national: false,
          logo: "https://media.api-sports.io/football/teams/50.png",
          venueApiId: 555,
        },
        {
          apiId: 33,
          name: "Manchester United",
          code: "MUN",
          country: "England",
          founded: 1878,
          national: false,
          logo: "https://media.api-sports.io/football/teams/33.png",
          venueApiId: null,
        },
      ])
      .onDuplicateKeyUpdate({ set: { name: "England" } });

    // 6. Insert a fixture
    console.log("6. Inserting fixture...");
    await db
      .insert(fixtures)
      .values({
        apiId: 1035131,
        referee: "Michael Oliver",
        timezone: "UTC",
        date: "2024-11-30T16:30:00Z",
        timestamp: 1733159400,
        periodsFirst: 1733159400,
        periodsSecond: 1733163000,
        venueApiId: 508,
        statusLong: "Match Finished",
        statusShort: "FT",
        statusElapsed: 90,
        leagueApiId: 39,
        leagueName: "Premier League",
        leagueCountry: "England",
        leagueLogo: "https://media.api-sports.io/football/leagues/39.png",
        leagueFlag: "https://media.api-sports.io/flags/gb.svg",
        leagueSeason: 2024,
        leagueRound: "Regular Season - 13",
        homeTeamApiId: 40,
        awayTeamApiId: 50,
        goalsHome: 2,
        goalsAway: 0,
        scoreHalftimeHome: 1,
        scoreHalftimeAway: 0,
        scoreFulltimeHome: 2,
        scoreFulltimeAway: 0,
        scoreExtratimeHome: null,
        scoreExtratimeAway: null,
        scorePenaltyHome: null,
        scorePenaltyAway: null,
      })
      .onDuplicateKeyUpdate({ set: { name: "England" } });

    // 7. Insert standings
    console.log("7. Inserting standings...");
    await db
      .insert(standings)
      .values([
        {
          leagueApiId: 39,
          season: 2024,
          teamApiId: 40,
          rank: 1,
          points: 35,
          goalsDiff: 15,
          group: null,
          form: "WWDWW",
          status: null,
          description: null,
          allPlayed: 13,
          allWin: 11,
          allDraw: 2,
          allLose: 0,
          allGoalsFor: 29,
          allGoalsAgainst: 14,
          homePlayed: 7,
          homeWin: 6,
          homeDraw: 1,
          homeLose: 0,
          homeGoalsFor: 17,
          homeGoalsAgainst: 7,
          awayPlayed: 6,
          awayWin: 5,
          awayDraw: 1,
          awayLose: 0,
          awayGoalsFor: 12,
          awayGoalsAgainst: 7,
          update: "2024-12-01T00:00:00Z",
        },
        {
          leagueApiId: 39,
          season: 2024,
          teamApiId: 50,
          rank: 2,
          points: 32,
          goalsDiff: 12,
          group: null,
          form: "WWLWW",
          status: null,
          description: null,
          allPlayed: 13,
          allWin: 10,
          allDraw: 2,
          allLose: 1,
          allGoalsFor: 28,
          allGoalsAgainst: 16,
          homePlayed: 7,
          homeWin: 5,
          homeDraw: 2,
          homeLose: 0,
          homeGoalsFor: 15,
          homeGoalsAgainst: 8,
          awayPlayed: 6,
          awayWin: 5,
          awayDraw: 0,
          awayLose: 1,
          awayGoalsFor: 13,
          awayGoalsAgainst: 8,
          update: "2024-12-01T00:00:00Z",
        },
      ])
      .onDuplicateKeyUpdate({ set: { name: "England" } });

    // 8. Insert a player
    console.log("8. Inserting player...");
    await db
      .insert(players)
      .values({
        apiId: 306,
        name: "Mohamed Salah",
        firstname: "Mohamed",
        lastname: "Salah",
        age: 32,
        birthDate: "1992-06-15",
        birthPlace: "Nagrig",
        birthCountry: "Egypt",
        nationality: "Egypt",
        height: "175 cm",
        weight: "71 kg",
        injured: false,
        photo: "https://media.api-sports.io/football/players/306.png",
      })
      .onDuplicateKeyUpdate({ set: { name: "England" } });

    console.log("\n✅ Minimal data seeded successfully!");
    console.log("\nSeeded:");
    console.log("  - 1 country (England)");
    console.log("  - 1 league (Premier League)");
    console.log("  - 1 season (2024)");
    console.log("  - 2 venues (Anfield, Etihad)");
    console.log("  - 3 teams (Liverpool, Man City, Man United)");
    console.log("  - 1 fixture (Liverpool vs Man City)");
    console.log("  - 2 standings (Liverpool, Man City)");
    console.log("  - 1 player (Mohamed Salah)");
  } catch (error) {
    console.error("\n❌ Error seeding data:", error);
    process.exit(1);
  }

  process.exit(0);
}

seedMinimalData();
