/**
 * Odds and Predictions Router
 * 
 * Implements /odds and /predictions endpoints with schema identical to API-Football.
 * Uses Poisson regression for fair odds and ELO ratings for match predictions.
 */

import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import { seasons } from "../drizzle/schema";
import { publicProcedure, router } from "./_core/trpc";
import { getOdds, getPredictions, getFixtures, getEloRating, upsertEloRating, getTeamStats } from "./football-db";
import { generateMatchOdds } from "./models/poisson-odds";
import { generatePrediction, getOrInitializeRating, calculateKFactor } from "./models/elo-predictions";
import { createApiResponse } from "./_core/normalizers";

/**
 * Odds endpoint - GET /odds
 * Returns betting odds for fixtures (fair odds calculated via Poisson regression)
 */
export const oddsProcedure = publicProcedure
  .meta({ openapi: { method: 'GET', path: '/odds', tags: ['Odds'] } })
  .input(
    z.object({
      fixture: z.number().optional(),
      league: z.number().optional(),
      season: z.number().optional(),
      bookmaker: z.string().optional(),
      bet: z.string().optional(),
    })
  )
  .query(async ({ input = {} }) => {
    try {
      // If fixture is provided, generate odds on-the-fly using Poisson model
      if (input.fixture) {
        const fixtures = await getFixtures({ id: input.fixture });
        
        if (fixtures.length === 0) {
          return createApiResponse([]);
        }
        
        const fixtureData = fixtures[0];
        
        // Get team stats for both teams
        let homeStats = await getTeamStats(
          fixtureData.fixture.homeTeamId,
          fixtureData.fixture.seasonId,
          true
        );
        let awayStats = await getTeamStats(
          fixtureData.fixture.awayTeamId,
          fixtureData.fixture.seasonId,
          false
        );
        
        // Fallback: If insufficient data (e.g., start of season or generated fixtures), try previous season
        if ((!homeStats || !homeStats.matchesPlayed || homeStats.matchesPlayed < 5) && fixtureData.league?.id && fixtureData.season?.year) {
           const db = await getDb();
           if (db) {
             const prevSeason = await db.select().from(seasons)
               .where(and(eq(seasons.leagueId, fixtureData.league.id), eq(seasons.year, fixtureData.season.year - 1)))
               .limit(1);
             
             if (prevSeason.length > 0) {
                const prevHomeStats = await getTeamStats(fixtureData.fixture.homeTeamId, prevSeason[0].id, true);
                if (prevHomeStats && prevHomeStats.matchesPlayed > 0) {
                    homeStats = prevHomeStats;
                }
                
                const prevAwayStats = await getTeamStats(fixtureData.fixture.awayTeamId, prevSeason[0].id, false);
                if (prevAwayStats && prevAwayStats.matchesPlayed > 0) {
                    awayStats = prevAwayStats;
                }
             }
           }
        }
        
        if (!homeStats || !awayStats) {
          // Insufficient data - return empty
          return createApiResponse([]);
        }
        
        // Generate odds using Poisson model
        const oddsData = generateMatchOdds(
          {
            goalsScored: homeStats.goalsScored || 0,
            goalsConceded: homeStats.goalsConceded || 0,
            matchesPlayed: homeStats.matchesPlayed || 0,
          },
          {
            goalsScored: awayStats.goalsScored || 0,
            goalsConceded: awayStats.goalsConceded || 0,
            matchesPlayed: awayStats.matchesPlayed || 0,
          }
        );
        
        // Format response to match API-Football schema
        const response = [
          {
            league: {
              id: fixtureData.league?.id || 0,
              name: fixtureData.league?.name || "",
              country: fixtureData.country?.name || "",
              logo: fixtureData.league?.logo || null,
              flag: fixtureData.country?.flag || null,
              season: fixtureData.season?.year || 0,
            },
            fixture: {
              id: fixtureData.fixture.id,
              timezone: "UTC",
              date: fixtureData.fixture.date.toISOString(),
              timestamp: Math.floor(fixtureData.fixture.date.getTime() / 1000),
            },
            update: new Date().toISOString(),
            bookmakers: [
              {
                id: 0,
                name: "Internal Model (Poisson)",
                bets: [
                  {
                    id: 1,
                    name: "Match Winner",
                    values: [
                      {
                        value: "Home",
                        odd: oddsData.match_winner.home.toFixed(2),
                      },
                      {
                        value: "Draw",
                        odd: oddsData.match_winner.draw.toFixed(2),
                      },
                      {
                        value: "Away",
                        odd: oddsData.match_winner.away.toFixed(2),
                      },
                    ],
                  },
                  {
                    id: 5,
                    name: "Goals Over/Under",
                    values: [
                      {
                        value: "Over 0.5",
                        odd: oddsData.goals_over_under.over_0_5.toFixed(2),
                      },
                      {
                        value: "Over 1.5",
                        odd: oddsData.goals_over_under.over_1_5.toFixed(2),
                      },
                      {
                        value: "Over 2.5",
                        odd: oddsData.goals_over_under.over_2_5.toFixed(2),
                      },
                      {
                        value: "Over 3.5",
                        odd: oddsData.goals_over_under.over_3_5.toFixed(2),
                      },
                      {
                        value: "Over 4.5",
                        odd: oddsData.goals_over_under.over_4_5.toFixed(2),
                      },
                      {
                        value: "Over 5.5",
                        odd: oddsData.goals_over_under.over_5_5.toFixed(2),
                      },
                      {
                        value: "Under 0.5",
                        odd: oddsData.goals_over_under.under_0_5.toFixed(2),
                      },
                      {
                        value: "Under 1.5",
                        odd: oddsData.goals_over_under.under_1_5.toFixed(2),
                      },
                      {
                        value: "Under 2.5",
                        odd: oddsData.goals_over_under.under_2_5.toFixed(2),
                      },
                      {
                        value: "Under 3.5",
                        odd: oddsData.goals_over_under.under_3_5.toFixed(2),
                      },
                      {
                        value: "Under 4.5",
                        odd: oddsData.goals_over_under.under_4_5.toFixed(2),
                      },
                      {
                        value: "Under 5.5",
                        odd: oddsData.goals_over_under.under_5_5.toFixed(2),
                      },
                    ],
                  },
                  {
                    id: 8,
                    name: "Both Teams Score",
                    values: [
                      {
                        value: "Yes",
                        odd: oddsData.both_teams_score.yes.toFixed(2),
                      },
                      {
                        value: "No",
                        odd: oddsData.both_teams_score.no.toFixed(2),
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ];
        
        return createApiResponse(response);
      }
      
      // Otherwise, fetch stored odds from database
      const oddsData = await getOdds({
        fixtureId: input.fixture,
        leagueId: input.league,
        season: input.season,
        bookmaker: input.bookmaker,
        bet: input.bet,
      });
      
      // Group odds by fixture and bookmaker
      const groupedOdds = new Map<number, any>();
      
      oddsData.forEach((row: any) => {
        const fixtureId = row.odds.fixtureId;
        
        if (!groupedOdds.has(fixtureId)) {
          groupedOdds.set(fixtureId, {
            league: {
              id: row.league?.id || 0,
              name: row.league?.name || "",
              country: "", // Would need country join
              logo: row.league?.logo || null,
              flag: null,
              season: row.season?.year || 0,
            },
            fixture: {
              id: row.fixture?.id || 0,
              timezone: "UTC",
              date: row.fixture?.date?.toISOString() || "",
              timestamp: row.fixture?.date ? Math.floor(row.fixture.date.getTime() / 1000) : 0,
            },
            update: row.odds.updatedAt.toISOString(),
            bookmakers: [],
          });
        }
        
        const fixtureOdds = groupedOdds.get(fixtureId);
        
        // Find or create bookmaker
        let bookmaker = fixtureOdds.bookmakers.find((b: any) => b.name === row.odds.bookmaker);
        if (!bookmaker) {
          bookmaker = {
            id: fixtureOdds.bookmakers.length,
            name: row.odds.bookmaker || "Unknown",
            bets: [],
          };
          fixtureOdds.bookmakers.push(bookmaker);
        }
        
        // Add bet
        bookmaker.bets.push({
          id: bookmaker.bets.length + 1,
          name: row.odds.bet,
          values: row.odds.values,
        });
      });
      
      return createApiResponse(Array.from(groupedOdds.values()));
    } catch (error: any) {
      return createApiResponse([], error.message);
    }
  });

/**
 * Predictions endpoint - GET /predictions
 * Returns match predictions based on ELO ratings
 */
export const predictionsProcedure = publicProcedure
  .meta({ openapi: { method: 'GET', path: '/predictions', tags: ['Predictions'] } })
  .input(
    z.object({
      fixture: z.number().optional(),
      league: z.number().optional(),
      season: z.number().optional(),
    })
  )
  .query(async ({ input = {} }) => {
    try {
      // If fixture is provided, generate prediction on-the-fly using ELO model
      if (input.fixture) {
        const fixtures = await getFixtures({ id: input.fixture });
        
        if (fixtures.length === 0) {
          return createApiResponse([]);
        }
        
        const fixtureData = fixtures[0];
        
        // Get or initialize ELO ratings for both teams
        let homeRatingData = await getEloRating(
          fixtureData.fixture.homeTeamId,
          fixtureData.fixture.seasonId
        );
        let awayRatingData = await getEloRating(
          fixtureData.fixture.awayTeamId,
          fixtureData.fixture.seasonId
        );
        
        // Fallback to previous season if rating not found
        if ((!homeRatingData || !awayRatingData) && fixtureData.league?.id && fixtureData.season?.year) {
           const db = await getDb();
           if (db) {
             const prevSeason = await db.select().from(seasons)
               .where(and(eq(seasons.leagueId, fixtureData.league.id), eq(seasons.year, fixtureData.season.year - 1)))
               .limit(1);
             
             if (prevSeason.length > 0) {
                 if (!homeRatingData) {
                     homeRatingData = await getEloRating(fixtureData.fixture.homeTeamId, prevSeason[0].id);
                 }
                 if (!awayRatingData) {
                     awayRatingData = await getEloRating(fixtureData.fixture.awayTeamId, prevSeason[0].id);
                 }
             }
           }
        }
        
        const homeRating = homeRatingData 
          ? { ...homeRatingData, rating: parseFloat(homeRatingData.rating) }
          : getOrInitializeRating(undefined, fixtureData.fixture.homeTeamId);
        const awayRating = awayRatingData
          ? { ...awayRatingData, rating: parseFloat(awayRatingData.rating) }
          : getOrInitializeRating(undefined, fixtureData.fixture.awayTeamId);
        
        // Generate prediction using ELO model
        const prediction = generatePrediction(
          fixtureData.fixture.homeTeamId,
          "Home Team", // Would need team name join
          homeRating.rating,
          fixtureData.fixture.awayTeamId,
          "Away Team",
          awayRating.rating
        );
        
        // Format response to match API-Football schema
        const response = [
          {
            predictions: {
              winner: prediction.winner,
              win_or_draw: prediction.win_or_draw,
              under_over: prediction.under_over,
              goals: prediction.goals,
              advice: prediction.advice,
              percent: prediction.percent,
            },
            league: {
              id: fixtureData.league?.id || 0,
              name: fixtureData.league?.name || "",
              country: fixtureData.country?.name || "",
              logo: fixtureData.league?.logo || null,
              flag: fixtureData.country?.flag || null,
              season: fixtureData.season?.year || 0,
            },
            teams: {
              home: {
                id: fixtureData.fixture.homeTeamId,
                name: "Home Team",
                logo: null,
              },
              away: {
                id: fixtureData.fixture.awayTeamId,
                name: "Away Team",
                logo: null,
              },
            },
            comparison: {
              form: {
                home: `${homeRating.matchesPlayed} matches`,
                away: `${awayRating.matchesPlayed} matches`,
              },
              att: {
                home: `${homeRating.rating.toFixed(0)}`,
                away: `${awayRating.rating.toFixed(0)}`,
              },
              def: {
                home: `${homeRating.rating.toFixed(0)}`,
                away: `${awayRating.rating.toFixed(0)}`,
              },
              poisson_distribution: {
                home: prediction.percent.home,
                draw: prediction.percent.draw,
                away: prediction.percent.away,
              },
              h2h: {
                home: "50%",
                draw: "0%",
                away: "50%",
              },
              goals: {
                home: prediction.goals.home,
                away: prediction.goals.away,
              },
              total: {
                home: prediction.percent.home,
                away: prediction.percent.away,
              },
            },
          },
        ];
        
        return createApiResponse(response);
      }
      
      // Otherwise, fetch stored predictions from database
      const predictionsData = await getPredictions({
        fixtureId: input.fixture,
        leagueId: input.league,
        season: input.season,
      });
      
      const formatted = predictionsData.map((row: any) => ({
        predictions: {
          winner: {
            id: null,
            name: row.prediction.winnerName || "Draw",
            comment: row.prediction.winnerComment || "",
          },
          win_or_draw: row.prediction.winOrDraw || false,
          under_over: row.prediction.underOver || null,
          goals: {
            home: row.prediction.goalsHome?.toString() || "0.0",
            away: row.prediction.goalsAway?.toString() || "0.0",
          },
          advice: row.prediction.advice || "",
          percent: {
            home: row.prediction.percentHome?.toString() + "%" || "0%",
            draw: row.prediction.percentDraw?.toString() + "%" || "0%",
            away: row.prediction.percentAway?.toString() + "%" || "0%",
          },
        },
        league: {
          id: row.league?.id || 0,
          name: row.league?.name || "",
          country: "",
          logo: row.league?.logo || null,
          flag: null,
          season: row.season?.year || 0,
        },
        teams: {
          home: {
            id: row.fixture?.homeTeamId || 0,
            name: "Home Team",
            logo: null,
          },
          away: {
            id: row.fixture?.awayTeamId || 0,
            name: "Away Team",
            logo: null,
          },
        },
        comparison: {
          form: { home: "", away: "" },
          att: { home: "", away: "" },
          def: { home: "", away: "" },
          poisson_distribution: {
            home: row.prediction.percentHome?.toString() + "%" || "0%",
            draw: row.prediction.percentDraw?.toString() + "%" || "0%",
            away: row.prediction.percentAway?.toString() + "%" || "0%",
          },
          h2h: { home: "50%", draw: "0%", away: "50%" },
          goals: {
            home: row.prediction.goalsHome?.toString() || "0.0",
            away: row.prediction.goalsAway?.toString() || "0.0",
          },
          total: {
            home: row.prediction.percentHome?.toString() + "%" || "0%",
            away: row.prediction.percentAway?.toString() + "%" || "0%",
          },
        },
      }));
      
      return createApiResponse(formatted);
    } catch (error: any) {
      return createApiResponse([], error.message);
    }
  });

/**
 * Odds and Predictions Router
 */
export const oddsAndPredictionsRouter = router({
  odds: oddsProcedure,
  predictions: predictionsProcedure,
});
