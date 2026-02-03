import { pgTable, pgEnum, serial, text, timestamp, varchar, boolean, decimal, json, integer, index, unique } from "drizzle-orm/pg-core";

/**
 * Football Data Platform - Complete Database Schema
 * 
 * This schema supports full API-Football parity with tables for:
 * - Countries, Leagues, Seasons, Teams, Venues
 * - Fixtures, Standings, Statistics
 * - Players, Coaches, Transfers, Injuries, Trophies
 * - Odds and Predictions
 */


// ============================================================================
// ENUMS (must be defined before tables in PostgreSQL)
// ============================================================================

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const leagueTypeEnum = pgEnum("league_type", ["league", "cup"]);
export const entityTypeEnum = pgEnum("entity_type", ["player", "coach"]);
export const ingestionStatusEnum = pgEnum("ingestion_status", ["success", "failure", "partial"]);

// ============================================================================
// AUTH & USERS (from template)
// ============================================================================

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// CORE ENTITIES
// ============================================================================

export const countries = pgTable("countries", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 10 }), // ISO 3166-1 alpha-2/3 or custom
  flag: text("flag"), // URL to flag image
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  nameIdx: index("countries_name_idx").on(table.name),
  codeIdx: index("countries_code_idx").on(table.code),
}));

export const venues = pgTable("venues", {
  id: serial("id").primaryKey(),
  apiFootballId: integer("apiFootballId").unique(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  city: varchar("city", { length: 255 }),
  countryId: integer("countryId").references(() => countries.id),
  capacity: integer("capacity"),
  surface: varchar("surface", { length: 100 }), // grass, artificial, etc.
  image: text("image"), // URL to venue image
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  nameIdx: index("venues_name_idx").on(table.name),
  cityIdx: index("venues_city_idx").on(table.city),
}));

export const leagues = pgTable("leagues", {
  id: serial("id").primaryKey(),
  apiFootballId: integer("apiFootballId").unique(),
  name: varchar("name", { length: 255 }).notNull(),
  type: leagueTypeEnum("type").notNull(),
  logo: text("logo"), // URL to league logo
  countryId: integer("countryId").references(() => countries.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  nameIdx: index("leagues_name_idx").on(table.name),
  countryIdx: index("leagues_country_idx").on(table.countryId),
}));

export const seasons = pgTable("seasons", {
  id: serial("id").primaryKey(),
  leagueId: integer("leagueId").notNull().references(() => leagues.id),
  year: integer("year").notNull(), // e.g., 2023
  start: timestamp("start").notNull(),
  end: timestamp("end").notNull(),
  current: boolean("current").default(false).notNull(),
  // Coverage flags
  coverageFixturesEvents: boolean("coverageFixturesEvents").default(false).notNull(),
  coverageFixturesLineups: boolean("coverageFixturesLineups").default(false).notNull(),
  coverageFixturesStatistics: boolean("coverageFixturesStatistics").default(false).notNull(),
  coverageFixturesPlayers: boolean("coverageFixturesPlayers").default(false).notNull(),
  coverageStandings: boolean("coverageStandings").default(false).notNull(),
  coveragePlayers: boolean("coveragePlayers").default(false).notNull(),
  coverageTopScorers: boolean("coverageTopScorers").default(false).notNull(),
  coverageTopAssists: boolean("coverageTopAssists").default(false).notNull(),
  coverageTopCards: boolean("coverageTopCards").default(false).notNull(),
  coverageInjuries: boolean("coverageInjuries").default(false).notNull(),
  coveragePredictions: boolean("coveragePredictions").default(false).notNull(),
  coverageOdds: boolean("coverageOdds").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  leagueYearIdx: unique("seasons_league_year_unique").on(table.leagueId, table.year),
  currentIdx: index("seasons_current_idx").on(table.current),
}));

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  apiFootballId: integer("apiFootballId").unique(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 10 }), // 3-letter team code
  countryId: integer("countryId").references(() => countries.id),
  founded: integer("founded"), // Year founded
  national: boolean("national").default(false).notNull(),
  logo: text("logo"), // URL to team logo
  venueId: integer("venueId").references(() => venues.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  nameIdx: index("teams_name_idx").on(table.name),
  codeIdx: index("teams_code_idx").on(table.code),
  countryIdx: index("teams_country_idx").on(table.countryId),
}));

// ============================================================================
// FIXTURES & MATCHES
// ============================================================================

export const fixtures = pgTable("fixtures", {
  id: serial("id").primaryKey(),
  externalId: integer("externalId"), // ID from external source
  referee: varchar("referee", { length: 255 }),
  timezone: varchar("timezone", { length: 100 }).default("UTC").notNull(),
  date: timestamp("date").notNull(),
  timestamp: integer("timestamp").notNull(), // Unix timestamp
  periodsFirst: integer("periodsFirst"), // First half start timestamp
  periodsSecond: integer("periodsSecond"), // Second half start timestamp
  venueId: integer("venueId").references(() => venues.id),
  statusLong: varchar("statusLong", { length: 100 }).notNull(), // e.g., "Match Finished"
  statusShort: varchar("statusShort", { length: 10 }).notNull(), // e.g., "FT"
  statusElapsed: integer("statusElapsed"), // Minutes elapsed
  leagueId: integer("leagueId").notNull().references(() => leagues.id),
  seasonId: integer("seasonId").notNull().references(() => seasons.id),
  round: varchar("round", { length: 255 }), // e.g., "Regular Season - 1"
  homeTeamId: integer("homeTeamId").notNull().references(() => teams.id),
  awayTeamId: integer("awayTeamId").notNull().references(() => teams.id),
  goalsHome: integer("goalsHome"),
  goalsAway: integer("goalsAway"),
  scoreHalftimeHome: integer("scoreHalftimeHome"),
  scoreHalftimeAway: integer("scoreHalftimeAway"),
  scoreFulltimeHome: integer("scoreFulltimeHome"),
  scoreFulltimeAway: integer("scoreFulltimeAway"),
  scoreExtratimeHome: integer("scoreExtratimeHome"),
  scoreExtratimeAway: integer("scoreExtratimeAway"),
  scorePenaltyHome: integer("scorePenaltyHome"),
  scorePenaltyAway: integer("scorePenaltyAway"),
  homeWinner: boolean("homeWinner"),
  awayWinner: boolean("awayWinner"),
  // Source tracking
  source: varchar("source", { length: 50 }).default("api").notNull(), // 'api' or 'generated'
  isOfficial: boolean("isOfficial").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  dateIdx: index("fixtures_date_idx").on(table.date),
  leagueSeasonIdx: index("fixtures_league_season_idx").on(table.leagueId, table.seasonId),
  homeTeamIdx: index("fixtures_home_team_idx").on(table.homeTeamId),
  awayTeamIdx: index("fixtures_away_team_idx").on(table.awayTeamId),
  statusIdx: index("fixtures_status_idx").on(table.statusShort),
  externalIdIdx: index("fixtures_external_id_idx").on(table.externalId),
}));

export const fixtureEvents = pgTable("fixture_events", {
  id: serial("id").primaryKey(),
  fixtureId: integer("fixtureId").notNull().references(() => fixtures.id, { onDelete: "cascade" }),
  timeElapsed: integer("timeElapsed").notNull(),
  timeExtra: integer("timeExtra"),
  teamId: integer("teamId").notNull().references(() => teams.id),
  playerId: integer("playerId").references(() => players.id),
  assistPlayerId: integer("assistPlayerId").references(() => players.id),
  type: varchar("type", { length: 50 }).notNull(), // Goal, Card, subst, Var
  detail: varchar("detail", { length: 100 }), // Normal Goal, Yellow Card, etc.
  comments: text("comments"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  fixtureIdx: index("fixture_events_fixture_idx").on(table.fixtureId),
  typeIdx: index("fixture_events_type_idx").on(table.type),
}));

export const fixtureStatistics = pgTable("fixture_statistics", {
  id: serial("id").primaryKey(),
  fixtureId: integer("fixtureId").notNull().references(() => fixtures.id, { onDelete: "cascade" }),
  teamId: integer("teamId").notNull().references(() => teams.id),
  // Statistics as JSON for flexibility (API-Football returns various stat types)
  statistics: json("statistics").notNull(), // { "Shots on Goal": 5, "Shots off Goal": 3, ... }
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  fixtureTeamIdx: unique("fixture_statistics_fixture_team_unique").on(table.fixtureId, table.teamId),
}));

export const fixtureLineups = pgTable("fixture_lineups", {
  id: serial("id").primaryKey(),
  fixtureId: integer("fixtureId").notNull().references(() => fixtures.id, { onDelete: "cascade" }),
  teamId: integer("teamId").notNull().references(() => teams.id),
  formation: varchar("formation", { length: 20 }), // e.g., "4-4-2"
  startXI: json("startXI").notNull(), // Array of player objects
  substitutes: json("substitutes").notNull(), // Array of player objects
  coach: json("coach"), // Coach object
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  fixtureTeamIdx: unique("fixture_lineups_fixture_team_unique").on(table.fixtureId, table.teamId),
}));

export const fixturePlayerStatistics = pgTable("fixture_player_statistics", {
  id: serial("id").primaryKey(),
  fixtureId: integer("fixtureId").notNull().references(() => fixtures.id, { onDelete: "cascade" }),
  teamId: integer("teamId").notNull().references(() => teams.id),
  playerId: integer("playerId").notNull().references(() => players.id),
  statistics: json("statistics").notNull(), // Player match statistics
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  fixturePlayerIdx: unique("fixture_player_statistics_fixture_player_unique").on(table.fixtureId, table.playerId),
}));

// ============================================================================
// STANDINGS
// ============================================================================

export const standings = pgTable("standings", {
  id: serial("id").primaryKey(),
  leagueId: integer("leagueId").notNull().references(() => leagues.id),
  seasonId: integer("seasonId").notNull().references(() => seasons.id),
  teamId: integer("teamId").notNull().references(() => teams.id),
  rank: integer("rank").notNull(),
  points: integer("points").notNull(),
  goalsDiff: integer("goalsDiff").notNull(),
  group: varchar("group", { length: 100 }), // For group stages
  form: varchar("form", { length: 20 }), // e.g., "WWDLL"
  status: varchar("status", { length: 100 }), // e.g., "Promotion - Champions League"
  description: text("description"),
  // All matches
  allPlayed: integer("allPlayed").notNull(),
  allWin: integer("allWin").notNull(),
  allDraw: integer("allDraw").notNull(),
  allLose: integer("allLose").notNull(),
  allGoalsFor: integer("allGoalsFor").notNull(),
  allGoalsAgainst: integer("allGoalsAgainst").notNull(),
  // Home matches
  homePlayed: integer("homePlayed").notNull(),
  homeWin: integer("homeWin").notNull(),
  homeDraw: integer("homeDraw").notNull(),
  homeLose: integer("homeLose").notNull(),
  homeGoalsFor: integer("homeGoalsFor").notNull(),
  homeGoalsAgainst: integer("homeGoalsAgainst").notNull(),
  // Away matches
  awayPlayed: integer("awayPlayed").notNull(),
  awayWin: integer("awayWin").notNull(),
  awayDraw: integer("awayDraw").notNull(),
  awayLose: integer("awayLose").notNull(),
  awayGoalsFor: integer("awayGoalsFor").notNull(),
  awayGoalsAgainst: integer("awayGoalsAgainst").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  leagueSeasonTeamIdx: unique("standings_league_season_team_unique").on(table.leagueId, table.seasonId, table.teamId),
  rankIdx: index("standings_rank_idx").on(table.rank),
}));

// ============================================================================
// PLAYERS & COACHES
// ============================================================================

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  externalId: integer("externalId"), // ID from external source
  name: varchar("name", { length: 255 }).notNull(),
  firstname: varchar("firstname", { length: 255 }),
  lastname: varchar("lastname", { length: 255 }),
  age: integer("age"),
  birthDate: timestamp("birthDate"),
  birthPlace: varchar("birthPlace", { length: 255 }),
  birthCountry: varchar("birthCountry", { length: 255 }),
  nationality: varchar("nationality", { length: 100 }),
  height: varchar("height", { length: 20 }), // e.g., "180 cm"
  weight: varchar("weight", { length: 20 }), // e.g., "75 kg"
  photo: text("photo"), // URL to player photo
  injured: boolean("injured").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  nameIdx: index("players_name_idx").on(table.name),
  externalIdIdx: index("players_external_id_idx").on(table.externalId),
}));

export const playerStatistics = pgTable("player_statistics", {
  id: serial("id").primaryKey(),
  playerId: integer("playerId").notNull().references(() => players.id),
  teamId: integer("teamId").notNull().references(() => teams.id),
  leagueId: integer("leagueId").notNull().references(() => leagues.id),
  seasonId: integer("seasonId").notNull().references(() => seasons.id),
  position: varchar("position", { length: 50 }), // Goalkeeper, Defender, Midfielder, Attacker
  rating: decimal("rating", { precision: 4, scale: 2 }), // Average rating
  captain: boolean("captain").default(false).notNull(),
  // Games
  appearences: integer("appearences").default(0).notNull(),
  lineups: integer("lineups").default(0).notNull(),
  minutes: integer("minutes").default(0).notNull(),
  // Substitutes
  substitutesIn: integer("substitutesIn").default(0).notNull(),
  substitutesOut: integer("substitutesOut").default(0).notNull(),
  substitutesBench: integer("substitutesBench").default(0).notNull(),
  // Shots
  shotsTotal: integer("shotsTotal").default(0).notNull(),
  shotsOn: integer("shotsOn").default(0).notNull(),
  // Goals
  goalsTotal: integer("goalsTotal").default(0).notNull(),
  goalsConceded: integer("goalsConceded").default(0).notNull(),
  goalsAssists: integer("goalsAssists").default(0).notNull(),
  goalsSaves: integer("goalsSaves").default(0).notNull(),
  // Passes
  passesTotal: integer("passesTotal").default(0).notNull(),
  passesKey: integer("passesKey").default(0).notNull(),
  passesAccuracy: integer("passesAccuracy").default(0).notNull(),
  // Tackles
  tacklesTotal: integer("tacklesTotal").default(0).notNull(),
  tacklesBlocks: integer("tacklesBlocks").default(0).notNull(),
  tacklesInterceptions: integer("tacklesInterceptions").default(0).notNull(),
  // Duels
  duelsTotal: integer("duelsTotal").default(0).notNull(),
  duelsWon: integer("duelsWon").default(0).notNull(),
  // Dribbles
  dribblesAttempts: integer("dribblesAttempts").default(0).notNull(),
  dribblesSuccess: integer("dribblesSuccess").default(0).notNull(),
  dribblesPast: integer("dribblesPast").default(0).notNull(),
  // Fouls
  foulsDrawn: integer("foulsDrawn").default(0).notNull(),
  foulsCommitted: integer("foulsCommitted").default(0).notNull(),
  // Cards
  cardsYellow: integer("cardsYellow").default(0).notNull(),
  cardsYellowred: integer("cardsYellowred").default(0).notNull(),
  cardsRed: integer("cardsRed").default(0).notNull(),
  // Penalty
  penaltyWon: integer("penaltyWon").default(0).notNull(),
  penaltyCommitted: integer("penaltyCommitted").default(0).notNull(),
  penaltyScored: integer("penaltyScored").default(0).notNull(),
  penaltyMissed: integer("penaltyMissed").default(0).notNull(),
  penaltySaved: integer("penaltySaved").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  playerSeasonIdx: unique("player_statistics_player_season_unique").on(table.playerId, table.teamId, table.leagueId, table.seasonId),
}));

export const coaches = pgTable("coaches", {
  id: serial("id").primaryKey(),
  externalId: integer("externalId"),
  name: varchar("name", { length: 255 }).notNull(),
  firstname: varchar("firstname", { length: 255 }),
  lastname: varchar("lastname", { length: 255 }),
  age: integer("age"),
  birthDate: timestamp("birthDate"),
  birthPlace: varchar("birthPlace", { length: 255 }),
  birthCountry: varchar("birthCountry", { length: 255 }),
  nationality: varchar("nationality", { length: 100 }),
  height: varchar("height", { length: 20 }),
  weight: varchar("weight", { length: 20 }),
  photo: text("photo"),
  teamId: integer("teamId").references(() => teams.id),
  // Source tracking
  source: varchar("source", { length: 50 }).default("api").notNull(),
  isOfficial: boolean("isOfficial").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  nameIdx: index("coaches_name_idx").on(table.name),
  teamIdx: index("coaches_team_idx").on(table.teamId),
}));

// ============================================================================
// TRANSFERS, INJURIES, TROPHIES
// ============================================================================

export const transfers = pgTable("transfers", {
  id: serial("id").primaryKey(),
  playerId: integer("playerId").notNull().references(() => players.id),
  date: timestamp("date").notNull(),
  type: varchar("type", { length: 50 }), // Loan, Transfer, Free, etc.
  teamInId: integer("teamInId").references(() => teams.id),
  teamOutId: integer("teamOutId").references(() => teams.id),
  // Source tracking
  source: varchar("source", { length: 50 }).default("api").notNull(),
  isOfficial: boolean("isOfficial").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  playerIdx: index("transfers_player_idx").on(table.playerId),
  dateIdx: index("transfers_date_idx").on(table.date),
}));

export const injuries = pgTable("injuries", {
  id: serial("id").primaryKey(),
  playerId: integer("playerId").notNull().references(() => players.id),
  teamId: integer("teamId").notNull().references(() => teams.id),
  leagueId: integer("leagueId").notNull().references(() => leagues.id),
  seasonId: integer("seasonId").notNull().references(() => seasons.id),
  fixtureId: integer("fixtureId").references(() => fixtures.id),
  type: varchar("type", { length: 100 }).notNull(), // Injury type
  reason: text("reason"),
  date: timestamp("date").notNull(),
  // Source tracking
  source: varchar("source", { length: 50 }).default("api").notNull(),
  confidence: varchar("confidence", { length: 20 }).default("high"), // low, medium, high
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  playerIdx: index("injuries_player_idx").on(table.playerId),
  teamIdx: index("injuries_team_idx").on(table.teamId),
  dateIdx: index("injuries_date_idx").on(table.date),
}));

export const trophies = pgTable("trophies", {
  id: serial("id").primaryKey(),
  entityType: entityTypeEnum("entityType").notNull(),
  entityId: integer("entityId").notNull(), // Player or Coach ID
  league: varchar("league", { length: 255 }).notNull(),
  country: varchar("country", { length: 255 }).notNull(),
  season: varchar("season", { length: 50 }).notNull(),
  place: varchar("place", { length: 50 }).notNull(), // Winner, Runner-up, etc.
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  entityIdx: index("trophies_entity_idx").on(table.entityType, table.entityId),
}));

// ============================================================================
// ODDS & PREDICTIONS
// ============================================================================

export const odds = pgTable("odds", {
  id: serial("id").primaryKey(),
  fixtureId: integer("fixtureId").notNull().references(() => fixtures.id, { onDelete: "cascade" }),
  bookmaker: varchar("bookmaker", { length: 100 }), // Bookmaker name or "internal" for modeled
  bet: varchar("bet", { length: 100 }).notNull(), // Match Winner, Goals Over/Under, etc.
  values: json("values").notNull(), // Array of { value: "Home", odd: "1.50" }
  // Source tracking
  source: varchar("source", { length: 50 }).default("api").notNull(),
  isLive: boolean("isLive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  fixtureIdx: index("odds_fixture_idx").on(table.fixtureId),
  bookmakerIdx: index("odds_bookmaker_idx").on(table.bookmaker),
}));

export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  fixtureId: integer("fixtureId").notNull().references(() => fixtures.id, { onDelete: "cascade" }),
  winnerName: varchar("winnerName", { length: 255 }),
  winnerComment: text("winnerComment"),
  winOrDraw: boolean("winOrDraw"),
  underOver: varchar("underOver", { length: 50 }),
  goalsHome: decimal("goalsHome", { precision: 4, scale: 2 }),
  goalsAway: decimal("goalsAway", { precision: 4, scale: 2 }),
  advice: text("advice"),
  percentHome: decimal("percentHome", { precision: 5, scale: 2 }),
  percentDraw: decimal("percentDraw", { precision: 5, scale: 2 }),
  percentAway: decimal("percentAway", { precision: 5, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  fixtureIdx: unique("predictions_fixture_unique").on(table.fixtureId),
}));

// ELO Ratings for predictions
export const eloRatings = pgTable("elo_ratings", {
  id: serial("id").primaryKey(),
  teamId: integer("teamId").notNull().references(() => teams.id, { onDelete: "cascade" }),
  seasonId: integer("seasonId").notNull().references(() => seasons.id, { onDelete: "cascade" }),
  rating: decimal("rating", { precision: 7, scale: 2 }).notNull().default("1500.00"),
  matchesPlayed: integer("matchesPlayed").default(0).notNull(),
  lastUpdated: timestamp("lastUpdated").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  teamSeasonIdx: unique("elo_ratings_team_season_unique").on(table.teamId, table.seasonId),
  ratingIdx: index("elo_ratings_rating_idx").on(table.rating),
}));

// ============================================================================
// METADATA & CACHE
// ============================================================================

export const timezones = pgTable("timezones", {
  id: serial("id").primaryKey(),
  timezone: varchar("timezone", { length: 100 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const dataIngestionLog = pgTable("data_ingestion_log", {
  id: serial("id").primaryKey(),
  source: varchar("source", { length: 100 }).notNull(), // football-data.org, Open Football, etc.
  entityType: varchar("entityType", { length: 100 }).notNull(), // fixtures, teams, players, etc.
  status: ingestionStatusEnum("status").notNull(),
  recordsProcessed: integer("recordsProcessed").default(0).notNull(),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt").notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  sourceIdx: index("data_ingestion_log_source_idx").on(table.source),
  entityTypeIdx: index("data_ingestion_log_entity_type_idx").on(table.entityType),
  startedAtIdx: index("data_ingestion_log_started_at_idx").on(table.startedAt),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Country = typeof countries.$inferSelect;
export type InsertCountry = typeof countries.$inferInsert;

export type Venue = typeof venues.$inferSelect;
export type InsertVenue = typeof venues.$inferInsert;

export type League = typeof leagues.$inferSelect;
export type InsertLeague = typeof leagues.$inferInsert;

export type Season = typeof seasons.$inferSelect;
export type InsertSeason = typeof seasons.$inferInsert;

export type Team = typeof teams.$inferSelect;
export type InsertTeam = typeof teams.$inferInsert;

export type Fixture = typeof fixtures.$inferSelect;
export type InsertFixture = typeof fixtures.$inferInsert;

export type FixtureEvent = typeof fixtureEvents.$inferSelect;
export type InsertFixtureEvent = typeof fixtureEvents.$inferInsert;

export type FixtureStatistic = typeof fixtureStatistics.$inferSelect;
export type InsertFixtureStatistic = typeof fixtureStatistics.$inferInsert;

export type FixtureLineup = typeof fixtureLineups.$inferSelect;
export type InsertFixtureLineup = typeof fixtureLineups.$inferInsert;

export type FixturePlayerStatistic = typeof fixturePlayerStatistics.$inferSelect;
export type InsertFixturePlayerStatistic = typeof fixturePlayerStatistics.$inferInsert;

export type Standing = typeof standings.$inferSelect;
export type InsertStanding = typeof standings.$inferInsert;

export type Player = typeof players.$inferSelect;
export type InsertPlayer = typeof players.$inferInsert;

export type PlayerStatistic = typeof playerStatistics.$inferSelect;
export type InsertPlayerStatistic = typeof playerStatistics.$inferInsert;

export type Coach = typeof coaches.$inferSelect;
export type InsertCoach = typeof coaches.$inferInsert;

export type Transfer = typeof transfers.$inferSelect;
export type InsertTransfer = typeof transfers.$inferInsert;

export type Injury = typeof injuries.$inferSelect;
export type InsertInjury = typeof injuries.$inferInsert;

export type Trophy = typeof trophies.$inferSelect;
export type InsertTrophy = typeof trophies.$inferInsert;

export type Odds = typeof odds.$inferSelect;
export type InsertOdds = typeof odds.$inferInsert;

export type Prediction = typeof predictions.$inferSelect;
export type InsertPrediction = typeof predictions.$inferInsert;

export type EloRating = typeof eloRatings.$inferSelect;
export type InsertEloRating = typeof eloRatings.$inferInsert;

export type Timezone = typeof timezones.$inferSelect;
export type InsertTimezone = typeof timezones.$inferInsert;

export type DataIngestionLog = typeof dataIngestionLog.$inferSelect;
export type InsertDataIngestionLog = typeof dataIngestionLog.$inferInsert;
