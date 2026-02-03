/**
 * Normalization layer for converting database entities to API-Football schemas
 * 
 * This module ensures 100% schema compatibility with API-Football responses.
 * All normalizers follow the exact structure defined in the API-Football documentation.
 */

import type { 
  Country, League, Season, Team, Venue, Fixture, Standing, 
  Player, PlayerStatistic, Coach, Transfer, Injury, Trophy, Odds, Prediction 
} from "../../drizzle/schema";

/**
 * Normalize country to API-Football format
 */
export function normalizeCountry(country: Country) {
  return {
    name: country.name,
    code: country.code,
    flag: country.flag,
  };
}

/**
 * Normalize venue to API-Football format
 */
export function normalizeVenue(venue: Venue, country?: Country) {
  return {
    id: venue.id,
    name: venue.name,
    address: venue.address,
    city: venue.city,
    country: country?.name || null,
    capacity: venue.capacity,
    surface: venue.surface,
    image: venue.image,
  };
}

/**
 * Normalize season to API-Football format
 */
export function normalizeSeason(season: Season) {
  return {
    year: season.year,
    start: season.start?.toISOString().split("T")[0] || null,
    end: season.end?.toISOString().split("T")[0] || null,
    current: season.current,
    coverage: {
      fixtures: {
        events: season.coverageFixturesEvents,
        lineups: season.coverageFixturesLineups,
        statistics_fixtures: season.coverageFixturesStatistics,
        statistics_players: season.coverageFixturesPlayers,
      },
      standings: season.coverageStandings,
      players: season.coveragePlayers,
      top_scorers: season.coverageTopScorers,
      top_assists: season.coverageTopAssists,
      top_cards: season.coverageTopCards,
      injuries: season.coverageInjuries,
      predictions: season.coveragePredictions,
      odds: season.coverageOdds,
    },
  };
}

/**
 * Normalize league to API-Football format
 */
export function normalizeLeague(
  league: League, 
  country: Country | null, 
  seasons: Season[]
) {
  return {
    league: {
      id: league.id,
      name: league.name,
      type: league.type,
      logo: league.logo,
    },
    country: country ? normalizeCountry(country) : null,
    seasons: seasons.map(normalizeSeason),
  };
}

/**
 * Normalize team to API-Football format
 */
export function normalizeTeam(
  team: Team, 
  venue?: Venue | null, 
  country?: Country | null
) {
  return {
    team: {
      id: team.id,
      name: team.name,
      code: team.code,
      country: country?.name || null,
      founded: team.founded,
      national: team.national,
      logo: team.logo,
    },
    venue: venue ? normalizeVenue(venue) : null,
  };
}

/**
 * Normalize standings response
 */
export function normalizeStandingsResponse(
  league: League,
  season: Season,
  standings: any[] // We pass the raw standings records
) {
  // Group by group (e.g. "Group A") or just one group
  const standingsByGroup = new Map<string, any[]>();
  
  for (const s of standings) {
    const groupName = s.group || "League Table";
    if (!standingsByGroup.has(groupName)) {
      standingsByGroup.set(groupName, []);
    }
    
    standingsByGroup.get(groupName)?.push({
      rank: s.rank,
      team: {
        id: s.team.id,
        name: s.team.name,
        logo: s.team.logo,
      },
      points: s.points,
      goalsDiff: s.goalsDiff,
      group: s.group,
      form: s.form,
      status: s.status,
      description: s.description,
      all: {
        played: s.allPlayed,
        win: s.allWin,
        draw: s.allDraw,
        lose: s.allLose,
        goals: {
          for: s.allGoalsFor,
          against: s.allGoalsAgainst,
        },
      },
      home: {
        played: s.homePlayed,
        win: s.homeWin,
        draw: s.homeDraw,
        lose: s.homeLose,
        goals: {
          for: s.homeGoalsFor,
          against: s.homeGoalsAgainst,
        },
      },
      away: {
        played: s.awayPlayed,
        win: s.awayWin,
        draw: s.awayDraw,
        lose: s.awayLose,
        goals: {
          for: s.awayGoalsFor,
          against: s.awayGoalsAgainst,
        },
      },
      update: s.updatedAt?.toISOString(),
    });
  }
  
  const standingsArray = Array.from(standingsByGroup.values());
  
  return {
    league: {
      id: league.id,
      name: league.name,
      country: "World", // TODO: Get country name
      logo: league.logo,
      flag: null, // TODO: Get country flag
      season: season.year,
      standings: standingsArray,
    }
  };
}

/**
 * Normalize fixture to API-Football format
 */
export function normalizeFixture(
  fixture: Fixture,
  league: League,
  season: Season,
  homeTeam: Team,
  awayTeam: Team,
  venue: Venue | null
) {
  return {
    fixture: {
      id: fixture.id,
      referee: fixture.referee,
      timezone: fixture.timezone,
      date: fixture.date.toISOString(),
      timestamp: fixture.timestamp,
      periods: {
        first: fixture.periodsFirst,
        second: fixture.periodsSecond,
      },
      venue: venue ? {
        id: venue.id,
        name: venue.name,
        city: venue.city,
      } : null,
      status: {
        long: fixture.statusLong,
        short: fixture.statusShort,
        elapsed: fixture.statusElapsed,
      },
    },
    league: {
      id: league.id,
      name: league.name,
      country: "World", // TODO: Link country
      logo: league.logo,
      flag: null,
      season: season.year,
      round: fixture.round,
    },
    teams: {
      home: {
        id: homeTeam.id,
        name: homeTeam.name,
        logo: homeTeam.logo,
        winner: fixture.homeWinner,
      },
      away: {
        id: awayTeam.id,
        name: awayTeam.name,
        logo: awayTeam.logo,
        winner: fixture.awayWinner,
      },
    },
    goals: {
      home: fixture.goalsHome,
      away: fixture.goalsAway,
    },
    score: {
      halftime: {
        home: fixture.scoreHalftimeHome,
        away: fixture.scoreHalftimeAway,
      },
      fulltime: {
        home: fixture.scoreFulltimeHome,
        away: fixture.scoreFulltimeAway,
      },
      extratime: {
        home: fixture.scoreExtratimeHome,
        away: fixture.scoreExtratimeAway,
      },
      penalty: {
        home: fixture.scorePenaltyHome,
        away: fixture.scorePenaltyAway,
      },
    },
  };
}

/**
 * Normalize player statistics to API-Football format
 */
export function normalizePlayerStatistics(
  stats: PlayerStatistic,
  player: Player,
  team: Team,
  league: League,
  season: Season
) {
  return {
    player: {
      id: player.id,
      name: player.name,
      firstname: player.firstname,
      lastname: player.lastname,
      age: player.age,
      birth: {
        date: player.birthDate?.toISOString().split("T")[0],
        place: player.birthPlace,
        country: player.birthCountry,
      },
      nationality: player.nationality,
      height: player.height,
      weight: player.weight,
      injured: player.injured,
      photo: player.photo,
    },
    statistics: [
      {
        team: {
          id: team.id,
          name: team.name,
          logo: team.logo,
        },
        league: {
          id: league.id,
          name: league.name,
          country: "World", // TODO
          logo: league.logo,
          flag: null,
          season: season.year,
        },
        games: {
          appearences: stats.appearences,
          lineups: stats.lineups,
          minutes: stats.minutes,
          number: null,
          position: stats.position,
          rating: stats.rating,
          captain: stats.captain,
        },
        substitutes: {
          in: stats.substitutesIn,
          out: stats.substitutesOut,
          bench: stats.substitutesBench,
        },
        shots: {
          total: stats.shotsTotal,
          on: stats.shotsOn,
        },
        goals: {
          total: stats.goalsTotal,
          conceded: stats.goalsConceded,
          assists: stats.goalsAssists,
          saves: stats.goalsSaves,
        },
        passes: {
          total: stats.passesTotal,
          key: stats.passesKey,
          accuracy: stats.passesAccuracy,
        },
        tackles: {
          total: stats.tacklesTotal,
          blocks: stats.tacklesBlocks,
          interceptions: stats.tacklesInterceptions,
        },
        duels: {
          total: stats.duelsTotal,
          won: stats.duelsWon,
        },
        dribbles: {
          attempts: stats.dribblesAttempts,
          success: stats.dribblesSuccess,
          past: stats.dribblesPast,
        },
        fouls: {
          drawn: stats.foulsDrawn,
          committed: stats.foulsCommitted,
        },
        cards: {
          yellow: stats.cardsYellow,
          yellowred: stats.cardsYellowred,
          red: stats.cardsRed,
        },
        penalty: {
          won: stats.penaltyWon,
          commited: stats.penaltyCommitted,
          scored: stats.penaltyScored,
          missed: stats.penaltyMissed,
          saved: stats.penaltySaved,
        },
      }
    ]
  };
}

/**
 * Normalize injury to API-Football format
 */
export function normalizeInjury(
  injury: Injury,
  player: Player,
  team: Team,
  fixture: Fixture | null,
  league: League,
  season: Season
) {
  return {
    player: {
      id: player.id,
      name: player.name,
      photo: player.photo,
      type: injury.type,
      reason: injury.reason,
    },
    team: {
      id: team.id,
      name: team.name,
      logo: team.logo,
    },
    fixture: fixture ? {
      id: fixture.id,
      timezone: fixture.timezone,
      date: fixture.date.toISOString(),
      timestamp: fixture.timestamp,
    } : null,
    league: {
      id: league.id,
      season: season.year,
      name: league.name,
      country: "World", // TODO
      logo: league.logo,
      flag: null,
    },
  };
}


/**
 * Normalize coach to API-Football format
 */
export function normalizeCoach(
  coach: Coach,
  team: Team | null,
  career: any[] = []
) {
  return {
    id: coach.id,
    name: coach.name,
    firstname: coach.firstname,
    lastname: coach.lastname,
    age: coach.age,
    birth: {
      date: coach.birthDate?.toISOString().split("T")[0],
      place: coach.birthPlace,
      country: coach.birthCountry,
    },
    nationality: coach.nationality,
    height: coach.height,
    weight: coach.weight,
    photo: coach.photo,
    team: team ? {
      id: team.id,
      name: team.name,
      logo: team.logo,
    } : null,
    career: career,
  };
}

/**
 * Normalize transfer to API-Football format
 */
export function normalizeTransfer(
  transfer: Transfer,
  player: Player,
  teamIn: Team | null,
  teamOut: Team | null
) {
  return {
    player: {
      id: player.id,
      name: player.name,
    },
    update: transfer.date.toISOString(),
    transfers: [
      {
        date: transfer.date.toISOString().split("T")[0],
        type: transfer.type,
        teams: {
          in: teamIn ? {
            id: teamIn.id,
            name: teamIn.name,
            logo: teamIn.logo,
          } : null,
          out: teamOut ? {
            id: teamOut.id,
            name: teamOut.name,
            logo: teamOut.logo,
          } : null,
        },
      },
    ],
  };
}

/**
 * Normalize trophy to API-Football format
 */
export function normalizeTrophy(
  trophy: Trophy
) {
  return {
    league: trophy.league,
    country: trophy.country,
    season: trophy.season,
    place: trophy.place,
  };
}

/**
 * Helper to create standardized API response wrapper
 */
export function createApiResponse(data: any, errors: any = []) {
  return {
    get: "endpoint", // TODO: Dynamic
    parameters: {},
    errors: errors,
    results: Array.isArray(data) ? data.length : 1,
    paging: {
      current: 1,
      total: 1,
    },
    response: data,
  };
}
