/**
 * Database query helpers for Football Data Platform
 * 
 * This module provides typed query functions for all football entities.
 * All functions return raw Drizzle results for use in tRPC procedures.
 */

import { eq, and, or, gte, lte, ilike, desc, asc, sql, inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  countries, leagues, seasons, teams, venues, fixtures, standings,
  players, playerStatistics, coaches, transfers, injuries, trophies,
  odds, predictions, timezones,
  fixtureEvents, fixtureLineups, fixtureStatistics,
  type Country, type League, type Season, type Team, type Venue,
  type Fixture, type Standing, type Player, type PlayerStatistic
} from "../drizzle/schema";

// ============================================================================
// CORE ENTITIES
// ============================================================================

/**
 * Get all countries with optional filters
 */
export async function getCountries(filters?: {
  name?: string;
  code?: string;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(countries);

  if (filters?.name) {
    query = query.where(eq(countries.name, filters.name)) as any;
  } else if (filters?.code) {
    query = query.where(eq(countries.code, filters.code)) as any;
  } else if (filters?.search) {
    query = query.where(ilike(countries.name, `%${filters.search}%`)) as any;
  }

  return await query;
}

/**
 * Get country by ID
 */
export async function getCountryById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(countries).where(eq(countries.id, id)).limit(1);
  return result[0] || null;
}

/**
 * Get all timezones
 */
export async function getTimezones() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(timezones);
}

/**
 * Get leagues with optional filters
 */
export async function getLeagues(filters?: {
  id?: number;
  name?: string;
  country?: string;
  code?: string;
  season?: number;
  team?: number;
  type?: "League" | "Cup";
  current?: boolean;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  // Build the query with joins
  let query = db
    .select({
      league: leagues,
      country: countries,
      seasons: seasons,
    })
    .from(leagues)
    .leftJoin(countries, eq(leagues.countryId, countries.id))
    .leftJoin(seasons, eq(seasons.leagueId, leagues.id));

  const conditions: any[] = [];

  if (filters?.id) {
    conditions.push(eq(leagues.id, filters.id));
  }
  if (filters?.name) {
    conditions.push(ilike(leagues.name, `%${filters.name}%`));
  }
  if (filters?.type) {
    conditions.push(eq(leagues.type, filters.type.toLowerCase() as "league" | "cup"));
  }
  if (filters?.country) {
    conditions.push(ilike(countries.name, `%${filters.country}%`));
  }
  if (filters?.search) {
    conditions.push(ilike(leagues.name, `%${filters.search}%`));
  }
  if (filters?.current !== undefined) {
    conditions.push(eq(seasons.current, filters.current));
  }
  if (filters?.season) {
    conditions.push(eq(seasons.year, filters.season));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const results = await query;

  // Group seasons by league
  const leaguesMap = new Map<number, any>();
  
  results.forEach((row: any) => {
    if (!leaguesMap.has(row.league.id)) {
      leaguesMap.set(row.league.id, {
        league: row.league,
        country: row.country,
        seasons: [],
      });
    }
    
    if (row.seasons) {
      const leagueData = leaguesMap.get(row.league.id);
      if (!leagueData.seasons.find((s: any) => s.id === row.seasons.id)) {
        leagueData.seasons.push(row.seasons);
      }
    }
  });

  return Array.from(leaguesMap.values());
}

/**
 * Get teams with optional filters
 */
export async function getTeams(filters?: {
  id?: number;
  name?: string;
  league?: number;
  season?: number;
  country?: string;
  code?: string;
  venue?: number;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select({
      team: teams,
      venue: venues,
      country: countries,
    })
    .from(teams)
    .leftJoin(venues, eq(teams.venueId, venues.id))
    .leftJoin(countries, eq(teams.countryId, countries.id));

  if (filters?.league || filters?.season) {
    query = query
      .innerJoin(standings, eq(teams.id, standings.teamId))
      .innerJoin(seasons, eq(standings.seasonId, seasons.id)) as any;
  }

  const conditions: any[] = [];

  if (filters?.id) {
    conditions.push(eq(teams.id, filters.id));
  }
  if (filters?.name) {
    conditions.push(ilike(teams.name, `%${filters.name}%`));
  }
  if (filters?.code) {
    conditions.push(eq(teams.code, filters.code));
  }
  if (filters?.country) {
    conditions.push(ilike(countries.name, `%${filters.country}%`));
  }
  if (filters?.venue) {
    conditions.push(eq(teams.venueId, filters.venue));
  }
  if (filters?.search) {
    conditions.push(ilike(teams.name, `%${filters.search}%`));
  }
  if (filters?.league) {
    conditions.push(eq(standings.leagueId, filters.league));
  }
  if (filters?.season) {
    conditions.push(eq(seasons.year, filters.season));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return await query;
}

/**
 * Get standings with filters
 */
export async function getStandings(filters: {
  league: number;
  season: number;
  team?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select({
      standing: standings,
      team: teams,
      league: leagues,
      season: seasons,
      country: countries,
    })
    .from(standings)
    .innerJoin(teams, eq(standings.teamId, teams.id))
    .innerJoin(leagues, eq(standings.leagueId, leagues.id))
    .innerJoin(seasons, eq(standings.seasonId, seasons.id))
    .leftJoin(countries, eq(leagues.countryId, countries.id))
    .where(
      and(
        eq(standings.leagueId, filters.league),
        eq(seasons.year, filters.season)
      )
    )
    .orderBy(asc(standings.rank));

  if (filters.team) {
    query = db
      .select({
        standing: standings,
        team: teams,
        league: leagues,
        season: seasons,
        country: countries,
      })
      .from(standings)
      .innerJoin(teams, eq(standings.teamId, teams.id))
      .innerJoin(leagues, eq(standings.leagueId, leagues.id))
      .innerJoin(seasons, eq(standings.seasonId, seasons.id))
      .leftJoin(countries, eq(leagues.countryId, countries.id))
      .where(
        and(
          eq(standings.leagueId, filters.league),
          eq(seasons.year, filters.season),
          eq(standings.teamId, filters.team)
        )
      )
      .orderBy(asc(standings.rank)) as any;
  }

  return await query;
}

// ============================================================================
// FIXTURES
// ============================================================================

/**
 * Get fixtures with comprehensive filters
 */
export async function getFixtures(filters?: {
  id?: number;
  ids?: number[];
  live?: string; // "all" or specific league IDs
  date?: string; // YYYY-MM-DD
  league?: number;
  season?: number;
  team?: number;
  last?: number;
  next?: number;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  round?: string;
  status?: string;
  venue?: number;
  timezone?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  // Query fixtures with league, season, venue, and country data
  // Note: Home and away team data will be fetched separately to avoid alias issues
  let query = db
    .select({
      fixture: fixtures,
      league: leagues,
      season: seasons,
      venue: venues,
      country: countries,
    })
    .from(fixtures)
    .innerJoin(leagues, eq(fixtures.leagueId, leagues.id))
    .leftJoin(seasons, eq(fixtures.seasonId, seasons.id))
    .leftJoin(venues, eq(fixtures.venueId, venues.id))
    .leftJoin(countries, eq(leagues.countryId, countries.id));

  const conditions: any[] = [];

  if (filters?.id) {
    conditions.push(eq(fixtures.id, filters.id));
  }
  if (filters?.ids && filters.ids.length > 0) {
    conditions.push(inArray(fixtures.id, filters.ids));
  }
  if (filters?.live === "all") {
    conditions.push(
      or(
        eq(fixtures.statusShort, "LIVE"),
        eq(fixtures.statusShort, "HT"),
        eq(fixtures.statusShort, "ET"),
        eq(fixtures.statusShort, "P")
      )
    );
  }
  if (filters?.date) {
    const dateStart = new Date(filters.date);
    const dateEnd = new Date(filters.date);
    dateEnd.setDate(dateEnd.getDate() + 1);
    conditions.push(
      and(
        gte(fixtures.date, dateStart),
        lte(fixtures.date, dateEnd)
      )
    );
  }
  if (filters?.league) {
    conditions.push(eq(fixtures.leagueId, filters.league));
  }
  if (filters?.season) {
    conditions.push(eq(seasons.year, filters.season));
  }
  if (filters?.team) {
    conditions.push(
      or(
        eq(fixtures.homeTeamId, filters.team),
        eq(fixtures.awayTeamId, filters.team)
      )
    );
  }
  if (filters?.from && filters?.to) {
    conditions.push(
      and(
        gte(fixtures.date, new Date(filters.from)),
        lte(fixtures.date, new Date(filters.to))
      )
    );
  }
  if (filters?.round) {
    conditions.push(ilike(fixtures.round, `%${filters.round}%`));
  }
  if (filters?.status) {
    conditions.push(eq(fixtures.statusShort, filters.status));
  }
  if (filters?.venue) {
    conditions.push(eq(fixtures.venueId, filters.venue));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  // Handle last/next filters
  if (filters?.last) {
    query = query
      .where(lte(fixtures.date, new Date()))
      .orderBy(desc(fixtures.date))
      .limit(filters.last) as any;
  } else if (filters?.next) {
    query = query
      .where(gte(fixtures.date, new Date()))
      .orderBy(asc(fixtures.date))
      .limit(filters.next) as any;
  } else {
    query = query.orderBy(asc(fixtures.date)) as any;
  }

  return await query;
}

// ============================================================================
// PLAYERS
// ============================================================================

/**
 * Get players with optional filters
 */
export async function getPlayers(filters?: {
  id?: number;
  name?: string;
  team?: number;
  league?: number;
  season?: number;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(players);

  const conditions: any[] = [];

  if (filters?.id) {
    conditions.push(eq(players.id, filters.id));
  }
  if (filters?.name) {
    conditions.push(ilike(players.name, `%${filters.name}%`));
  }
  if (filters?.search) {
    conditions.push(ilike(players.name, `%${filters.search}%`));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return await query;
}

/**
 * Get player statistics
 */
export async function getPlayerStatistics(filters: {
  player?: number;
  team?: number;
  league?: number;
  season?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select({
      statistics: playerStatistics,
      player: players,
      team: teams,
      league: leagues,
      season: seasons,
    })
    .from(playerStatistics)
    .innerJoin(players, eq(playerStatistics.playerId, players.id))
    .innerJoin(teams, eq(playerStatistics.teamId, teams.id))
    .innerJoin(leagues, eq(playerStatistics.leagueId, leagues.id))
    .innerJoin(seasons, eq(playerStatistics.seasonId, seasons.id));

  const conditions: any[] = [];

  if (filters.player) {
    conditions.push(eq(playerStatistics.playerId, filters.player));
  }
  if (filters.team) {
    conditions.push(eq(playerStatistics.teamId, filters.team));
  }
  if (filters.league) {
    conditions.push(eq(playerStatistics.leagueId, filters.league));
  }
  if (filters.season) {
    conditions.push(eq(playerStatistics.seasonId, filters.season));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return await query;
}

// ============================================================================
// FIXTURES ADVANCED
// ============================================================================

/**
 * Get fixture events (goals, cards, substitutions)
 */
export async function getFixtureEvents(params: { fixture?: number }) {
  const db = await getDb();
  if (!db) return [];

  // Import fixtureEvents from schema
  const { fixtureEvents } = await import("../drizzle/schema");

  const conditions = [];
  
  if (params.fixture) {
    conditions.push(eq(fixtureEvents.fixtureId, params.fixture));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const events = await db
    .select({
      event: fixtureEvents,
      team: teams,
      player: players,
    })
    .from(fixtureEvents)
    .leftJoin(teams, eq(fixtureEvents.teamId, teams.id))
    .leftJoin(players, eq(fixtureEvents.playerId, players.id))
    .where(where)
    .orderBy(asc(fixtureEvents.timeElapsed));

  return events;
}

/**
 * Get fixture lineups (starting XI, substitutes, formation)
 */
export async function getFixtureLineups(params: { fixture?: number; team?: number }) {
  const db = await getDb();
  if (!db) return [];

  // Import fixtureLineups from schema
  const { fixtureLineups } = await import("../drizzle/schema");

  const conditions = [];
  
  if (params.fixture) {
    conditions.push(eq(fixtureLineups.fixtureId, params.fixture));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const lineups = await db
    .select({
      lineup: fixtureLineups,
      team: teams,
    })
    .from(fixtureLineups)
    .leftJoin(teams, eq(fixtureLineups.teamId, teams.id))
    .where(where);

  return lineups;
}

/**
 * Get fixture statistics (shots, possession, passes, etc.)
 */
export async function getFixtureStatistics(params: { fixture?: number; team?: number }) {
  const db = await getDb();
  if (!db) return [];

  // Import fixtureStatistics from schema
  const { fixtureStatistics } = await import("../drizzle/schema");

  const conditions = [];
  
  if (params.fixture) {
    conditions.push(eq(fixtureStatistics.fixtureId, params.fixture));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const statistics = await db
    .select({
      statistic: fixtureStatistics,
      team: teams,
    })
    .from(fixtureStatistics)
    .leftJoin(teams, eq(fixtureStatistics.teamId, teams.id))
    .where(where);

  return statistics;
}


// Removed duplicate getInjuries

// ============================================================================
// TRANSFERS
// ============================================================================

export async function getTransfers(filters?: {
  player?: number;
  team?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select({
      transfer: transfers,
      player: players,
    })
    .from(transfers)
    .leftJoin(players, eq(transfers.playerId, players.id));

  const conditions: any[] = [];
  
  if (filters?.player) {
    conditions.push(eq(transfers.playerId, filters.player));
  }
  
  if (filters?.team) {
    conditions.push(
      or(
        eq(transfers.teamInId, filters.team),
        eq(transfers.teamOutId, filters.team)
      )
    );
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return query.limit(100);
}

// ============================================================================
// COACHES
// ============================================================================

export async function getCoaches(filters?: {
  id?: number;
  team?: number;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select({
      coach: coaches,
      team: teams,
    })
    .from(coaches)
    .leftJoin(teams, eq(coaches.teamId, teams.id));

  const conditions: any[] = [];
  
  if (filters?.id) {
    conditions.push(eq(coaches.id, filters.id));
  }
  
  if (filters?.team) {
    conditions.push(eq(coaches.teamId, filters.team));
  }
  
  if (filters?.search) {
    conditions.push(
      or(
        sql`${coaches.name} LIKE ${`%${filters.search}%`}`,
        sql`${coaches.firstname} LIKE ${`%${filters.search}%`}`,
        sql`${coaches.lastname} LIKE ${`%${filters.search}%`}`
      )
    );
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return query.limit(100);
}

// ============================================================================
// INJURIES
// ============================================================================

export async function getInjuries(filters: {
  fixture?: number;
  league?: number;
  season?: number;
  team?: number;
  player?: number;
  date?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select({
      injury: injuries,
      player: players,
      team: teams,
      fixture: fixtures,
      league: leagues,
      season: seasons,
    })
    .from(injuries)
    .innerJoin(players, eq(injuries.playerId, players.id))
    .innerJoin(teams, eq(injuries.teamId, teams.id))
    .innerJoin(leagues, eq(injuries.leagueId, leagues.id))
    .innerJoin(seasons, eq(injuries.seasonId, seasons.id))
    .leftJoin(fixtures, eq(injuries.fixtureId, fixtures.id));

  const conditions: any[] = [];
  
  if (filters.league) {
    conditions.push(eq(injuries.leagueId, filters.league));
  }
  
  if (filters.season) {
    conditions.push(eq(injuries.seasonId, filters.season));
  }
  
  if (filters.team) {
    conditions.push(eq(injuries.teamId, filters.team));
  }
  
  if (filters.player) {
    conditions.push(eq(injuries.playerId, filters.player));
  }
  
  if (filters.fixture) {
    conditions.push(eq(injuries.fixtureId, filters.fixture));
  }
  
  if (filters.date) {
    conditions.push(eq(injuries.date, new Date(filters.date)));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return query.limit(100);
}

// ============================================================================
// TROPHIES
// ============================================================================

export async function getTrophies(filters?: {
  player?: number;
  coach?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select({
      trophy: trophies,
    })
    .from(trophies);

  const conditions: any[] = [];
  
  if (filters?.player) {
    conditions.push(
      and(
        eq(trophies.entityType, "player"),
        eq(trophies.entityId, filters.player)
      )
    );
  }
  
  if (filters?.coach) {
    conditions.push(
      and(
        eq(trophies.entityType, "coach"),
        eq(trophies.entityId, filters.coach)
      )
    );
  }
  
  if (conditions.length > 0) {
    query = query.where(or(...conditions)) as any;
  }

  return query.limit(100);
}


// ============================================================================
// ODDS AND PREDICTIONS
// ============================================================================

export async function getOdds(filters: {
  fixtureId?: number;
  leagueId?: number;
  season?: number;
  bookmaker?: string;
  bet?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  const { eloRatings } = await import("../drizzle/schema");

  let query = db
    .select({
      odds: odds,
      fixture: fixtures,
      league: leagues,
      season: seasons,
    })
    .from(odds)
    .leftJoin(fixtures, eq(odds.fixtureId, fixtures.id))
    .leftJoin(leagues, eq(fixtures.leagueId, leagues.id))
    .leftJoin(seasons, eq(fixtures.seasonId, seasons.id))
    .$dynamic();

  const conditions: any[] = [];

  if (filters.fixtureId) {
    conditions.push(eq(odds.fixtureId, filters.fixtureId));
  }
  if (filters.leagueId) {
    conditions.push(eq(fixtures.leagueId, filters.leagueId));
  }
  if (filters.season) {
    conditions.push(eq(seasons.year, filters.season));
  }
  if (filters.bookmaker) {
    conditions.push(eq(odds.bookmaker, filters.bookmaker));
  }
  if (filters.bet) {
    conditions.push(eq(odds.bet, filters.bet));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  return await query;
}

export async function getPredictions(filters: {
  fixtureId?: number;
  leagueId?: number;
  season?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db
    .select({
      prediction: predictions,
      fixture: fixtures,
      league: leagues,
      season: seasons,
    })
    .from(predictions)
    .leftJoin(fixtures, eq(predictions.fixtureId, fixtures.id))
    .leftJoin(leagues, eq(fixtures.leagueId, leagues.id))
    .leftJoin(seasons, eq(fixtures.seasonId, seasons.id))
    .$dynamic();

  const conditions: any[] = [];

  if (filters.fixtureId) {
    conditions.push(eq(predictions.fixtureId, filters.fixtureId));
  }
  if (filters.leagueId) {
    conditions.push(eq(fixtures.leagueId, filters.leagueId));
  }
  if (filters.season) {
    conditions.push(eq(seasons.year, filters.season));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  return await query;
}

export async function getEloRating(teamId: number, seasonId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const { eloRatings } = await import("../drizzle/schema");

  const result = await db
    .select()
    .from(eloRatings)
    .where(and(eq(eloRatings.teamId, teamId), eq(eloRatings.seasonId, seasonId)))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertEloRating(rating: {
  teamId: number;
  seasonId: number;
  rating: number;
  matchesPlayed: number;
}) {
  const db = await getDb();
  if (!db) return;

  const { eloRatings } = await import("../drizzle/schema");

  await db
    .insert(eloRatings)
    .values({
      teamId: rating.teamId,
      seasonId: rating.seasonId,
      rating: rating.rating.toString(),
      matchesPlayed: rating.matchesPlayed,
      lastUpdated: new Date(),
    })
    .onConflictDoUpdate({
      target: [eloRatings.teamId, eloRatings.seasonId],
      set: {
        rating: rating.rating.toString(),
        matchesPlayed: rating.matchesPlayed,
        lastUpdated: new Date(),
      },
    });
}

export async function getTeamStats(teamId: number, seasonId: number, isHome?: boolean) {
  const db = await getDb();
  if (!db) return null;

  // Build query based on home/away filter
  const conditions = [
    eq(fixtures.seasonId, seasonId),
    or(eq(fixtures.homeTeamId, teamId), eq(fixtures.awayTeamId, teamId)),
    eq(fixtures.statusShort, "FT")
  ];

  if (isHome !== undefined) {
    if (isHome) {
      conditions.push(eq(fixtures.homeTeamId, teamId));
    } else {
      conditions.push(eq(fixtures.awayTeamId, teamId));
    }
  }

  const result = await db
    .select({
      goalsScored: sql<number>`SUM(CASE WHEN ${fixtures.homeTeamId} = ${teamId} THEN ${fixtures.goalsHome} WHEN ${fixtures.awayTeamId} = ${teamId} THEN ${fixtures.goalsAway} ELSE 0 END)`,
      goalsConceded: sql<number>`SUM(CASE WHEN ${fixtures.homeTeamId} = ${teamId} THEN ${fixtures.goalsAway} WHEN ${fixtures.awayTeamId} = ${teamId} THEN ${fixtures.goalsHome} ELSE 0 END)`,
      matchesPlayed: sql<number>`COUNT(*)`,
    })
    .from(fixtures)
    .where(and(...conditions));

  return result.length > 0 ? result[0] : null;
}
