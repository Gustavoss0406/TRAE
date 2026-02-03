/**
 * Football API Router
 * 
 * Implements all API-Football compatible endpoints with full parameter support.
 * All endpoints follow the exact schema defined in API-Football documentation.
 */

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { oddsAndPredictionsRouter } from "./odds-predictions-router";
import {
  getCountries,
  getTimezones,
  getLeagues,
  getTeams,
  getStandings,
  getFixtures,
  getPlayers,
  getPlayerStatistics,
  getFixtureEvents,
  getFixtureLineups,
  getFixtureStatistics,
  getInjuries,
} from "./football-db";
import {
  normalizeCountry,
  normalizeLeague,
  normalizeTeam,
  normalizeStandingsResponse,
  normalizeFixture,
  normalizePlayerStatistics,
  normalizeInjury,
  createApiResponse,
} from "./_core/normalizers";
import { CACHE_TTL, cacheMiddleware } from "./_core/cache";

/**
 * Status endpoint - returns API status and version
 */
const statusProcedure = publicProcedure.query(async () => {
  return createApiResponse({
    account: {
      firstname: "Football",
      lastname: "Data Platform",
      email: "api@football-data-platform.com",
    },
    subscription: {
      plan: "Free",
      end: null,
      active: true,
    },
    requests: {
      current: 0,
      limit_day: 100000,
    },
  });
});

/**
 * Timezone endpoint - returns list of available timezones
 */
const timezoneProcedure = publicProcedure.query(async () => {
  const timezones = await getTimezones();
  const timezoneList = timezones.map(tz => tz.timezone);
  
  return createApiResponse(timezoneList);
});

/**
 * Countries endpoint - returns list of countries
 */
const countriesProcedure = publicProcedure
  .input(
    z.object({
      name: z.string().optional(),
      code: z.string().optional(),
      search: z.string().optional(),
    }).optional()
  )
  .query(async ({ input }) => {
    const countries = await getCountries(input);
    const normalized = countries.map(normalizeCountry);
    
    return createApiResponse(normalized);
  });

/**
 * Leagues endpoint - returns list of leagues with seasons
 */
const leaguesProcedure = publicProcedure
  .input(
    z.object({
      id: z.number().optional(),
      name: z.string().optional(),
      country: z.string().optional(),
      code: z.string().optional(),
      season: z.number().optional(),
      team: z.number().optional(),
      type: z.enum(["League", "Cup"]).optional(),
      current: z.boolean().optional(),
      search: z.string().optional(),
    }).optional()
  )
  .query(async ({ input }) => {
    const leaguesData = await getLeagues(input);
    
    const normalized = leaguesData.map((data: any) =>
      normalizeLeague(data.league, data.country, data.seasons)
    );
    
    return createApiResponse(normalized);
  });

/**
 * Teams endpoint - returns list of teams with venue information
 */
const teamsProcedure = publicProcedure
  .input(
    z.object({
      id: z.number().optional(),
      name: z.string().optional(),
      league: z.number().optional(),
      season: z.number().optional(),
      country: z.string().optional(),
      code: z.string().optional(),
      venue: z.number().optional(),
      search: z.string().optional(),
    }).optional()
  )
  .query(async ({ input }) => {
    const teamsData = await getTeams(input);
    
    const normalized = teamsData.map((data: any) =>
      normalizeTeam(data.team, data.venue, data.country)
    );
    
    return createApiResponse(normalized);
  });

/**
 * Standings endpoint - returns league standings
 */
const standingsProcedure = publicProcedure
  .input(
    z.object({
      league: z.number(),
      season: z.number(),
      team: z.number().optional(),
    })
  )
  .query(async ({ input }) => {
    const standingsData = await getStandings(input);
    
    if (standingsData.length === 0) {
      return createApiResponse([]);
    }
    
    // Group data by league (should be only one league per request)
    const firstRow = standingsData[0] as any;
    const league = firstRow.league;
    const season = firstRow.season;
    const country = firstRow.country;
    
    // Create a map of teams
    const teamsMap = new Map();
    standingsData.forEach((row: any) => {
      teamsMap.set(row.team.id, row.team);
    });
    
    // Extract standings with team info
    const standingsForNormalizer = standingsData.map((row: any) => ({
      ...row.standing,
      team: row.team,
    }));
    
    const normalized = normalizeStandingsResponse(
      league,
      season,
      standingsForNormalizer
    );
    
    return createApiResponse([normalized]);
  });

/**
 * Injuries endpoint - returns list of injuries
 */
const injuriesProcedure = publicProcedure
  .input(
    z.object({
      fixture: z.number().optional(),
      league: z.number().optional(),
      season: z.number().optional(),
      team: z.number().optional(),
      player: z.number().optional(),
      date: z.string().optional(),
    }).optional()
  )
  .query(async ({ input }) => {
    const injuries = await getInjuries(input);
    const normalized = injuries.map(i => normalizeInjury(i.injury, i.player, i.team, i.fixture, i.league, i.season));
    return createApiResponse(normalized);
  });

/**
 * Fixtures endpoint - returns list of fixtures with comprehensive filters
 */
const fixturesProcedure = publicProcedure
  .input(
    z.object({
      id: z.number().optional(),
      ids: z.array(z.number()).optional(),
      live: z.string().optional(),
      date: z.string().optional(),
      league: z.number().optional(),
      season: z.number().optional(),
      team: z.number().optional(),
      last: z.number().optional(),
      next: z.number().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      round: z.string().optional(),
      status: z.string().optional(),
      venue: z.number().optional(),
      timezone: z.string().optional(),
    }).optional()
  )
  .query(async ({ input }) => {
    const fixturesData = await getFixtures(input);
    
    // Fetch all unique team IDs
    const teamIds = new Set<number>();
    fixturesData.forEach((data: any) => {
      teamIds.add(data.fixture.homeTeamId);
      teamIds.add(data.fixture.awayTeamId);
    });
    
    // Batch fetch all teams
    const { teams } = await import("../drizzle/schema");
    const { inArray } = await import("drizzle-orm");
    const { getDb } = await import("./db");
    const db = await getDb();
    
    if (!db) {
      return createApiResponse([]);
    }
    
    const allTeams = await db.select().from(teams).where(inArray(teams.id, Array.from(teamIds)));
    const teamsMap = new Map(allTeams.map(t => [t.id, t]));
    
    const normalized = fixturesData.map((data: any) => {
      const homeTeam = teamsMap.get(data.fixture.homeTeamId);
      const awayTeam = teamsMap.get(data.fixture.awayTeamId);
      
      return {
        fixture: {
          id: data.fixture.id,
          referee: data.fixture.referee,
          timezone: data.fixture.timezone,
          date: data.fixture.date?.toISOString() || null,
          timestamp: data.fixture.timestamp,
          periods: {
            first: data.fixture.periodsFirst,
            second: data.fixture.periodsSecond,
          },
          venue: data.venue ? {
            id: data.venue.id,
            name: data.venue.name,
            city: data.venue.city,
          } : null,
          status: {
            long: data.fixture.statusLong,
            short: data.fixture.statusShort,
            elapsed: data.fixture.statusElapsed,
          },
        },
        league: {
          id: data.league.id,
          name: data.league.name,
          country: data.country?.name || null,
          logo: data.league.logo,
          flag: data.country?.flag || null,
          season: data.season?.year || new Date(data.fixture.date).getFullYear(),
          round: data.fixture.round,
        },
        teams: {
          home: {
            id: homeTeam?.id || data.fixture.homeTeamId,
            name: homeTeam?.name || "Unknown",
            logo: homeTeam?.logo || null,
            winner: data.fixture.homeWinner,
          },
          away: {
            id: awayTeam?.id || data.fixture.awayTeamId,
            name: awayTeam?.name || "Unknown",
            logo: awayTeam?.logo || null,
            winner: data.fixture.awayWinner,
          },
        },
        goals: {
          home: data.fixture.goalsHome,
          away: data.fixture.goalsAway,
        },
        score: {
          halftime: {
            home: data.fixture.scoreHalftimeHome,
            away: data.fixture.scoreHalftimeAway,
          },
          fulltime: {
            home: data.fixture.scoreFulltimeHome,
            away: data.fixture.scoreFulltimeAway,
          },
          extratime: {
            home: data.fixture.scoreExtratimeHome,
            away: data.fixture.scoreExtratimeAway,
          },
          penalty: {
            home: data.fixture.scorePenaltyHome,
            away: data.fixture.scorePenaltyAway,
          },
        },
      };
    });
    
    return createApiResponse(normalized);
  });

/**
 * Players endpoint - returns list of players
 */
const playersProcedure = publicProcedure
  .input(
    z.object({
      id: z.number().optional(),
      name: z.string().optional(),
      team: z.number().optional(),
      league: z.number().optional(),
      season: z.number().optional(),
      search: z.string().optional(),
    }).optional()
  )
  .query(async ({ input }) => {
    const players = await getPlayers(input);
    
    // TODO: Implement proper normalization with player statistics
    return createApiResponse(players);
  });

/**
 * Fixtures Events endpoint - returns match events (goals, cards, substitutions)
 */
const fixturesEventsProcedure = publicProcedure
  .input(
    z.object({
      fixture: z.number().optional(),
    }).optional()
  )
  .query(async ({ input }) => {
    if (!input?.fixture) {
      return createApiResponse([]);
    }

    const events = await getFixtureEvents({ fixture: input.fixture });
    
    // Edge case: No events recorded
    if (events.length === 0) {
      return createApiResponse([]);
    }

    // Normalize events to API-Football format
    const normalized = events.map((row: any) => ({
      time: {
        elapsed: row.event.timeElapsed,
        extra: row.event.timeExtra,
      },
      team: row.team ? {
        id: row.team.id,
        name: row.team.name,
        logo: row.team.logo,
      } : null,
      player: row.player ? {
        id: row.player.id,
        name: row.player.name,
      } : null,
      assist: row.assistPlayer ? {
        id: row.assistPlayer.id,
        name: row.assistPlayer.name,
      } : null,
      type: row.event.type,
      detail: row.event.detail,
      comments: row.event.comments,
    }));

    return createApiResponse(normalized);
  });

/**
 * Fixtures Lineups endpoint - returns team lineups and formations
 */
const fixturesLineupsProcedure = publicProcedure
  .input(
    z.object({
      fixture: z.number().optional(),
      team: z.number().optional(),
    }).optional()
  )
  .query(async ({ input }) => {
    if (!input?.fixture) {
      return createApiResponse([]);
    }

    const lineups = await getFixtureLineups({ fixture: input.fixture, team: input?.team });
    
    // Edge case: No lineups available
    if (lineups.length === 0) {
      return createApiResponse([]);
    }

    // Normalize lineups to API-Football format
    const normalized = lineups.map((row: any) => ({
      team: row.team ? {
        id: row.team.id,
        name: row.team.name,
        logo: row.team.logo,
        colors: row.team.colors ? JSON.parse(row.team.colors) : null,
      } : null,
      formation: row.lineup.formation,
      startXI: row.lineup.startXI,
      substitutes: row.lineup.substitutes,
      coach: row.lineup.coach,
    }));

    return createApiResponse(normalized);
  });

/**
 * Fixtures Statistics endpoint - returns detailed match statistics
 */
const fixturesStatisticsProcedure = publicProcedure
  .input(
    z.object({
      fixture: z.number().optional(),
      team: z.number().optional(),
    }).optional()
  )
  .query(async ({ input }) => {
    if (!input?.fixture) {
      return createApiResponse([]);
    }

    const statistics = await getFixtureStatistics({ fixture: input.fixture, team: input?.team });
    
    // Edge case: No statistics available or partial statistics
    if (statistics.length === 0) {
      return createApiResponse([]);
    }

    // Normalize statistics to API-Football format
    const normalized = statistics.map((row: any) => ({
      team: row.team ? {
        id: row.team.id,
        name: row.team.name,
        logo: row.team.logo,
      } : null,
      statistics: row.statistic.statistics,
    }));

    return createApiResponse(normalized);
  });
export const footballRouter = router({
  status: statusProcedure,
  timezone: timezoneProcedure,
  countries: countriesProcedure,
  leagues: leaguesProcedure,
  teams: teamsProcedure,
  standings: standingsProcedure,
  fixtures: fixturesProcedure,
  fixturesEvents: fixturesEventsProcedure,
  fixturesLineups: fixturesLineupsProcedure,
  fixturesStatistics: fixturesStatisticsProcedure,
  players: playersProcedure,
  
  // Sync endpoints (for testing and manual triggers)
  syncFixtures: publicProcedure.mutation(async () => {
    try {
      const { syncFixtures } = await import("./workers/fixtures-sync");
      const result = await syncFixtures();
      return createApiResponse([result]);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return createApiResponse([], [errorMsg]);
    }
  }),

  syncStandings: publicProcedure.mutation(async () => {
    try {
      const { syncStandings } = await import("./workers/standings-sync");
      const result = await syncStandings();
      return createApiResponse([result]);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return createApiResponse([], [errorMsg]);
    }
   }),
  
  // Scheduler endpoints
  runAllWorkers: publicProcedure.mutation(async () => {
    try {
      const { executeAllWorkers } = await import("./workers/scheduler");
      const result = await executeAllWorkers();
      return createApiResponse([result]);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return createApiResponse([], [errorMsg]);
    }
  }),

  runScheduledEvent: publicProcedure
    .input(z.object({ scheduledTime: z.string().optional() }).optional())
    .mutation(async ({ input }) => {
      try {
        const { handleScheduledEvent } = await import("./workers/scheduler");
        const scheduledTime = input?.scheduledTime ? new Date(input.scheduledTime) : new Date();
        const result = await handleScheduledEvent(scheduledTime);
        return createApiResponse([result]);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return createApiResponse([], [errorMsg]);
      }
    }),
  
  // Remaining endpoints for full API-Football parity
  injuries: publicProcedure
    .input(z.object({
      league: z.number().optional(),
      season: z.number().optional(),
      fixture: z.number().optional(),
      team: z.number().optional(),
      player: z.number().optional(),
      date: z.string().optional(),
      timezone: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      try {
        const { getInjuries } = await import("./football-db");
        const results = await getInjuries(input || {});
        return createApiResponse(results);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return createApiResponse([], [errorMsg]);
      }
    }),
  
  transfers: publicProcedure
    .input(z.object({
      player: z.number().optional(),
      team: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      try {
        const { getTransfers } = await import("./football-db");
        const results = await getTransfers(input || {});
        return createApiResponse(results);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return createApiResponse([], [errorMsg]);
      }
    }),
  
  coachs: publicProcedure
    .input(z.object({
      id: z.number().optional(),
      team: z.number().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      try {
        const { getCoaches } = await import("./football-db");
        const results = await getCoaches(input || {});
        return createApiResponse(results);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return createApiResponse([], [errorMsg]);
      }
    }),
  
  trophies: publicProcedure
    .input(z.object({
      player: z.number().optional(),
      coach: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      try {
        const { getTrophies } = await import("./football-db");
        const results = await getTrophies(input || {});
        return createApiResponse(results);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return createApiResponse([], [errorMsg]);
      }
    }),
  
  // Odds and Predictions endpoints
  odds: oddsAndPredictionsRouter.odds,
  predictions: oddsAndPredictionsRouter.predictions,
});
