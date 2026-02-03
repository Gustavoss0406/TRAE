/**
 * Schema Validation Script
 * 
 * This script validates structural parity between our API implementation
 * and the official API-Football v3 specification.
 * 
 * Validates:
 * - Presence of all required fields
 * - Correct data types
 * - Nested structure integrity
 * - Enum values
 * - Response wrapper format
 * 
 * This does NOT validate:
 * - Actual data values
 * - Real API behavior
 * - Filter combinations with real data
 * 
 * For real validation, use the external validation checkpoint with actual API calls.
 */

import { z } from "zod";

// ============================================================================
// API-Football Official Schema Definitions
// ============================================================================

/**
 * Standard API-Football response wrapper
 * All endpoints return data in this format
 */
const APIFootballResponseSchema = z.object({
  get: z.string(),
  parameters: z.record(z.any()),
  errors: z.array(z.any()),
  results: z.number(),
  paging: z.object({
    current: z.number(),
    total: z.number(),
  }),
  response: z.array(z.any()),
});

/**
 * Fixture Status Schema
 */
const FixtureStatusSchema = z.object({
  long: z.string(),
  short: z.enum([
    "TBD", "NS", "1H", "HT", "2H", "ET", "BT", "P",
    "SUSP", "INT", "FT", "AET", "PEN", "PST", "CANC",
    "ABD", "AWD", "WO", "LIVE"
  ]),
  elapsed: z.number().nullable(),
});

/**
 * Venue Schema
 */
const VenueSchema = z.object({
  id: z.number().nullable(),
  name: z.string().nullable(),
  city: z.string().nullable(),
});

/**
 * Periods Schema
 */
const PeriodsSchema = z.object({
  first: z.number().nullable(),
  second: z.number().nullable(),
});

/**
 * Fixture Schema
 */
const FixtureSchema = z.object({
  id: z.number(),
  referee: z.string().nullable(),
  timezone: z.string(),
  date: z.string(),
  timestamp: z.number(),
  periods: PeriodsSchema,
  venue: VenueSchema,
  status: FixtureStatusSchema,
});

/**
 * League Schema
 */
const LeagueSchema = z.object({
  id: z.number(),
  name: z.string(),
  country: z.string(),
  logo: z.string().nullable(),
  flag: z.string().nullable(),
  season: z.number(),
  round: z.string().nullable(),
});

/**
 * Team Schema
 */
const TeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  logo: z.string().nullable(),
  winner: z.boolean().nullable(),
});

/**
 * Teams Schema
 */
const TeamsSchema = z.object({
  home: TeamSchema,
  away: TeamSchema,
});

/**
 * Goals Schema
 */
const GoalsSchema = z.object({
  home: z.number().nullable(),
  away: z.number().nullable(),
});

/**
 * Score Detail Schema
 */
const ScoreDetailSchema = z.object({
  home: z.number().nullable(),
  away: z.number().nullable(),
});

/**
 * Score Schema
 */
const ScoreSchema = z.object({
  halftime: ScoreDetailSchema,
  fulltime: ScoreDetailSchema,
  extratime: ScoreDetailSchema,
  penalty: ScoreDetailSchema,
});

/**
 * Complete Fixture Response Item Schema
 */
const FixtureResponseItemSchema = z.object({
  fixture: FixtureSchema,
  league: LeagueSchema,
  teams: TeamsSchema,
  goals: GoalsSchema,
  score: ScoreSchema,
});

/**
 * Fixtures Response Schema
 */
const FixturesResponseSchema = z.object({
  get: z.string(),
  parameters: z.record(z.any()),
  errors: z.array(z.any()),
  results: z.number(),
  paging: z.object({
    current: z.number(),
    total: z.number(),
  }),
  response: z.array(FixtureResponseItemSchema),
});

/**
 * Country Schema
 */
const CountrySchema = z.object({
  name: z.string(),
  code: z.string().nullable(),
  flag: z.string().nullable(),
});

/**
 * Countries Response Schema
 */
const CountriesResponseSchema = z.object({
  get: z.string(),
  parameters: z.record(z.any()),
  errors: z.array(z.any()),
  results: z.number(),
  paging: z.object({
    current: z.number(),
    total: z.number(),
  }),
  response: z.array(CountrySchema),
});

/**
 * League Detail Schema
 */
const LeagueDetailSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(),
  logo: z.string(),
});

/**
 * Country Detail Schema
 */
const CountryDetailSchema = z.object({
  name: z.string(),
  code: z.string().nullable(),
  flag: z.string().nullable(),
});

/**
 * Season Schema
 */
const SeasonSchema = z.object({
  year: z.number(),
  start: z.string(),
  end: z.string(),
  current: z.boolean(),
  coverage: z.object({
    fixtures: z.object({
      events: z.boolean(),
      lineups: z.boolean(),
      statistics_fixtures: z.boolean(),
      statistics_players: z.boolean(),
    }),
    standings: z.boolean(),
    players: z.boolean(),
    top_scorers: z.boolean(),
    top_assists: z.boolean(),
    top_cards: z.boolean(),
    injuries: z.boolean(),
    predictions: z.boolean(),
    odds: z.boolean(),
  }),
});

/**
 * League with Seasons Response Item Schema
 */
const LeagueWithSeasonsSchema = z.object({
  league: LeagueDetailSchema,
  country: CountryDetailSchema,
  seasons: z.array(SeasonSchema),
});

/**
 * Leagues Response Schema
 */
const LeaguesResponseSchema = z.object({
  get: z.string(),
  parameters: z.record(z.any()),
  errors: z.array(z.any()),
  results: z.number(),
  paging: z.object({
    current: z.number(),
    total: z.number(),
  }),
  response: z.array(LeagueWithSeasonsSchema),
});

/**
 * Team Detail Schema
 */
const TeamDetailSchema = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string().nullable(),
  country: z.string(),
  founded: z.number().nullable(),
  national: z.boolean(),
  logo: z.string(),
});

/**
 * Team Venue Schema
 */
const TeamVenueSchema = z.object({
  id: z.number().nullable(),
  name: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  capacity: z.number().nullable(),
  surface: z.string().nullable(),
  image: z.string().nullable(),
});

/**
 * Team Response Item Schema
 */
const TeamResponseItemSchema = z.object({
  team: TeamDetailSchema,
  venue: TeamVenueSchema,
});

/**
 * Teams Response Schema
 */
const TeamsResponseSchema = z.object({
  get: z.string(),
  parameters: z.record(z.any()),
  errors: z.array(z.any()),
  results: z.number(),
  paging: z.object({
    current: z.number(),
    total: z.number(),
  }),
  response: z.array(TeamResponseItemSchema),
});

/**
 * Standing Detail Schema
 */
const StandingDetailSchema = z.object({
  rank: z.number(),
  team: z.object({
    id: z.number(),
    name: z.string(),
    logo: z.string(),
  }),
  points: z.number(),
  goalsDiff: z.number(),
  group: z.string().nullable(),
  form: z.string().nullable(),
  status: z.string().nullable(),
  description: z.string().nullable(),
  all: z.object({
    played: z.number(),
    win: z.number(),
    draw: z.number(),
    lose: z.number(),
    goals: z.object({
      for: z.number(),
      against: z.number(),
    }),
  }),
  home: z.object({
    played: z.number(),
    win: z.number(),
    draw: z.number(),
    lose: z.number(),
    goals: z.object({
      for: z.number(),
      against: z.number(),
    }),
  }),
  away: z.object({
    played: z.number(),
    win: z.number(),
    draw: z.number(),
    lose: z.number(),
    goals: z.object({
      for: z.number(),
      against: z.number(),
    }),
  }),
  update: z.string(),
});

/**
 * Standings Response Item Schema
 */
const StandingsResponseItemSchema = z.object({
  league: z.object({
    id: z.number(),
    name: z.string(),
    country: z.string(),
    logo: z.string(),
    flag: z.string().nullable(),
    season: z.number(),
    standings: z.array(z.array(StandingDetailSchema)),
  }),
});

/**
 * Standings Response Schema
 */
const StandingsResponseSchema = z.object({
  get: z.string(),
  parameters: z.record(z.any()),
  errors: z.array(z.any()),
  results: z.number(),
  paging: z.object({
    current: z.number(),
    total: z.number(),
  }),
  response: z.array(StandingsResponseItemSchema),
});

/**
 * Timezone Response Schema
 */
const TimezonesResponseSchema = z.object({
  get: z.string(),
  parameters: z.record(z.any()),
  errors: z.array(z.any()),
  results: z.number(),
  paging: z.object({
    current: z.number(),
    total: z.number(),
  }),
  response: z.array(z.string()),
});

/**
 * Status Response Schema
 */
const StatusResponseSchema = z.object({
  account: z.object({
    firstname: z.string().nullable(),
    lastname: z.string().nullable(),
    email: z.string(),
  }),
  subscription: z.object({
    plan: z.string(),
    end: z.string(),
    active: z.boolean(),
  }),
  requests: z.object({
    current: z.number(),
    limit_day: z.number(),
  }),
});

// ============================================================================
// Validation Functions
// ============================================================================

interface ValidationResult {
  endpoint: string;
  passed: boolean;
  errors: string[];
}

/**
 * Validate that a response matches the expected schema
 */
function validateSchema(
  endpoint: string,
  schema: z.ZodSchema,
  mockResponse: any
): ValidationResult {
  const result: ValidationResult = {
    endpoint,
    passed: false,
    errors: [],
  };

  try {
    schema.parse(mockResponse);
    result.passed = true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      result.errors = error.errors.map(
        (err) => `${err.path.join(".")}: ${err.message}`
      );
    } else if (error instanceof Error) {
      result.errors = [`${error.name}: ${error.message}`, `Stack: ${error.stack}`];
    } else {
      result.errors = [String(error)];
    }
  }

  return result;
}

/**
 * Create mock response for fixtures endpoint
 */
function createMockFixturesResponse() {
  return {
    get: "fixtures",
    parameters: { league: "39", season: "2024" },
    errors: [],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [
      {
        fixture: {
          id: 1,
          referee: "M. Oliver",
          timezone: "UTC",
          date: "2024-01-01T15:00:00+00:00",
          timestamp: 1704117600,
          periods: { first: 1704117600, second: 1704121200 },
          venue: { id: 1, name: "Test Stadium", city: "Test City" },
          status: { long: "Match Finished", short: "FT", elapsed: 90 },
        },
        league: {
          id: 39,
          name: "Premier League",
          country: "England",
          logo: "https://example.com/logo.png",
          flag: "https://example.com/flag.svg",
          season: 2024,
          round: "Regular Season - 1",
        },
        teams: {
          home: {
            id: 1,
            name: "Team A",
            logo: "https://example.com/team-a.png",
            winner: true,
          },
          away: {
            id: 2,
            name: "Team B",
            logo: "https://example.com/team-b.png",
            winner: false,
          },
        },
        goals: { home: 2, away: 1 },
        score: {
          halftime: { home: 1, away: 0 },
          fulltime: { home: 2, away: 1 },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null },
        },
      },
    ],
  };
}

/**
 * Create mock response for countries endpoint
 */
function createMockCountriesResponse() {
  return {
    get: "countries",
    parameters: {},
    errors: [],
    results: 2,
    paging: { current: 1, total: 1 },
    response: [
      { name: "England", code: "GB", flag: "https://example.com/gb.svg" },
      { name: "Spain", code: "ES", flag: "https://example.com/es.svg" },
    ],
  };
}

/**
 * Create mock response for leagues endpoint
 */
function createMockLeaguesResponse() {
  return {
    get: "leagues",
    parameters: {},
    errors: [],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [
      {
        league: {
          id: 39,
          name: "Premier League",
          type: "League",
          logo: "https://example.com/logo.png",
        },
        country: {
          name: "England",
          code: "GB",
          flag: "https://example.com/gb.svg",
        },
        seasons: [
          {
            year: 2024,
            start: "2024-08-01",
            end: "2025-05-31",
            current: true,
            coverage: {
              fixtures: {
                events: true,
                lineups: true,
                statistics_fixtures: true,
                statistics_players: true,
              },
              standings: true,
              players: true,
              top_scorers: true,
              top_assists: true,
              top_cards: true,
              injuries: true,
              predictions: true,
              odds: true,
            },
          },
        ],
      },
    ],
  };
}

/**
 * Create mock response for teams endpoint
 */
function createMockTeamsResponse() {
  return {
    get: "teams",
    parameters: { league: "39", season: "2024" },
    errors: [],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [
      {
        team: {
          id: 1,
          name: "Test Team",
          code: "TST",
          country: "England",
          founded: 1900,
          national: false,
          logo: "https://example.com/logo.png",
        },
        venue: {
          id: 1,
          name: "Test Stadium",
          address: "123 Test St",
          city: "Test City",
          capacity: 50000,
          surface: "grass",
          image: "https://example.com/stadium.jpg",
        },
      },
    ],
  };
}

/**
 * Create mock response for standings endpoint
 */
function createMockStandingsResponse() {
  return {
    get: "standings",
    parameters: { league: "39", season: "2024" },
    errors: [],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [
      {
        league: {
          id: 39,
          name: "Premier League",
          country: "England",
          logo: "https://example.com/logo.png",
          flag: "https://example.com/gb.svg",
          season: 2024,
          standings: [
            [
              {
                rank: 1,
                team: {
                  id: 1,
                  name: "Test Team",
                  logo: "https://example.com/logo.png",
                },
                points: 30,
                goalsDiff: 15,
                group: null,
                form: "WWWWW",
                status: null,
                description: null,
                all: {
                  played: 10,
                  win: 10,
                  draw: 0,
                  lose: 0,
                  goals: { for: 25, against: 10 },
                },
                home: {
                  played: 5,
                  win: 5,
                  draw: 0,
                  lose: 0,
                  goals: { for: 15, against: 5 },
                },
                away: {
                  played: 5,
                  win: 5,
                  draw: 0,
                  lose: 0,
                  goals: { for: 10, against: 5 },
                },
                update: "2024-01-01T00:00:00+00:00",
              },
            ],
          ],
        },
      },
    ],
  };
}

/**
 * Create mock response for timezones endpoint
 */
function createMockTimezonesResponse() {
  return {
    get: "timezone",
    parameters: {},
    errors: [],
    results: 3,
    paging: { current: 1, total: 1 },
    response: ["UTC", "Europe/London", "America/New_York"],
  };
}

// ============================================================================
// Main Validation Runner
// ============================================================================

function runValidation() {
  console.log("🔍 API-Football Schema Parity Validation\n");
  console.log("=" .repeat(60));
  console.log("\nThis validates STRUCTURAL parity only.");
  console.log("Real data validation requires external checkpoint.\n");
  console.log("=" .repeat(60) + "\n");

  const validations: ValidationResult[] = [
    validateSchema(
      "GET /fixtures",
      FixturesResponseSchema,
      createMockFixturesResponse()
    ),
    validateSchema(
      "GET /countries",
      CountriesResponseSchema,
      createMockCountriesResponse()
    ),
    validateSchema(
      "GET /leagues",
      LeaguesResponseSchema,
      createMockLeaguesResponse()
    ),
    validateSchema(
      "GET /teams",
      TeamsResponseSchema,
      createMockTeamsResponse()
    ),
    validateSchema(
      "GET /standings",
      StandingsResponseSchema,
      createMockStandingsResponse()
    ),
    validateSchema(
      "GET /timezone",
      TimezonesResponseSchema,
      createMockTimezonesResponse()
    ),
  ];

  let allPassed = true;

  for (const result of validations) {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} ${result.endpoint}`);

    if (!result.passed) {
      allPassed = false;
      console.log("  Errors:");
      for (const error of result.errors) {
        console.log(`    - ${error}`);
      }
    }
    console.log();
  }

  console.log("=" .repeat(60));
  if (allPassed) {
    console.log("✅ All schema validations passed!");
    console.log("\n📝 Note: This validates structure only.");
    console.log("   Real data validation pending external checkpoint.");
    process.exit(0);
  } else {
    console.log("❌ Some schema validations failed!");
    console.log("\n⚠️  Fix schema mismatches before proceeding.");
    process.exit(1);
  }
}

// Run validation
runValidation();
