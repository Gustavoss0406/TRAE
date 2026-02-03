/**
 * ELO Rating System for Match Predictions
 * 
 * Implements ELO rating calculation for football teams to predict match outcomes.
 * ELO ratings dynamically adjust based on match results, providing a relative strength measure.
 * 
 * Mathematical Foundation:
 * - Expected score: E_A = 1 / (1 + 10^((R_B - R_A)/400))
 * - Rating update: R'_A = R_A + K * (S_A - E_A)
 * - K-factor determines rating volatility (higher K = faster adaptation)
 * - Home advantage bonus typically +100 ELO points
 */

export interface ELORating {
  teamId: number;
  rating: number;
  matchesPlayed: number;
  lastUpdated: Date;
}

export interface MatchPrediction {
  winner: {
    id: number | null;
    name: string;
    comment: string;
  };
  win_or_draw: boolean;
  under_over: string | null;
  goals: {
    home: string;
    away: string;
  };
  advice: string;
  percent: {
    home: string;
    draw: string;
    away: string;
  };
}

interface MatchResult {
  homeGoals: number;
  awayGoals: number;
}

/**
 * Default ELO configuration
 */
const DEFAULT_ELO_CONFIG = {
  initialRating: 1500,
  kFactor: 32,
  homeAdvantage: 100,
  minRating: 1000,
  maxRating: 2500,
};

/**
 * Calculate expected score for a team given ELO ratings
 * E_A = 1 / (1 + 10^((R_B - R_A)/400))
 */
export function calculateExpectedScore(
  ratingA: number,
  ratingB: number,
  isHomeTeam: boolean = false
): number {
  const homeBonus = isHomeTeam ? DEFAULT_ELO_CONFIG.homeAdvantage : 0;
  const adjustedRatingA = ratingA + homeBonus;
  const exponent = (ratingB - adjustedRatingA) / 400;
  return 1 / (1 + Math.pow(10, exponent));
}

/**
 * Calculate new ELO rating after a match
 * R'_A = R_A + K * (S_A - E_A)
 */
export function updateELORating(
  currentRating: number,
  expectedScore: number,
  actualScore: number,
  kFactor: number = DEFAULT_ELO_CONFIG.kFactor
): number {
  const newRating = currentRating + kFactor * (actualScore - expectedScore);
  return Math.max(
    DEFAULT_ELO_CONFIG.minRating,
    Math.min(DEFAULT_ELO_CONFIG.maxRating, newRating)
  );
}

/**
 * Convert match result to actual scores (1 = win, 0.5 = draw, 0 = loss)
 */
export function getActualScores(result: MatchResult): { home: number; away: number } {
  if (result.homeGoals > result.awayGoals) {
    return { home: 1.0, away: 0.0 };
  } else if (result.homeGoals < result.awayGoals) {
    return { home: 0.0, away: 1.0 };
  } else {
    return { home: 0.5, away: 0.5 };
  }
}

/**
 * Update both teams' ELO ratings after a match
 */
export function updateMatchRatings(
  homeRating: number,
  awayRating: number,
  result: MatchResult,
  kFactor?: number
): { homeRating: number; awayRating: number } {
  const homeExpected = calculateExpectedScore(homeRating, awayRating, true);
  const awayExpected = calculateExpectedScore(awayRating, homeRating, false);
  
  const actualScores = getActualScores(result);
  
  const newHomeRating = updateELORating(homeRating, homeExpected, actualScores.home, kFactor);
  const newAwayRating = updateELORating(awayRating, awayExpected, actualScores.away, kFactor);
  
  return {
    homeRating: newHomeRating,
    awayRating: newAwayRating,
  };
}

/**
 * Calculate win probabilities based on ELO ratings
 */
export function calculateWinProbabilities(
  homeRating: number,
  awayRating: number
): { home: number; draw: number; away: number } {
  const homeExpected = calculateExpectedScore(homeRating, awayRating, true);
  const awayExpected = 1 - homeExpected;
  
  // Estimate draw probability based on rating difference
  // Closer ratings = higher draw probability
  const ratingDiff = Math.abs(homeRating - awayRating);
  const drawProb = Math.max(0.15, Math.min(0.35, 0.30 - (ratingDiff / 1000)));
  
  // Adjust win probabilities to account for draw
  const homeWinProb = homeExpected * (1 - drawProb);
  const awayWinProb = awayExpected * (1 - drawProb);
  
  // Normalize to sum to 1.0
  const total = homeWinProb + drawProb + awayWinProb;
  
  return {
    home: homeWinProb / total,
    draw: drawProb / total,
    away: awayWinProb / total,
  };
}

/**
 * Predict expected goals based on ELO rating difference
 */
export function predictGoals(
  homeRating: number,
  awayRating: number,
  leagueAverage: number = 2.7
): { home: number; away: number } {
  const ratingDiff = homeRating - awayRating;
  
  // Base expected goals on league average
  const baseGoals = leagueAverage / 2;
  
  // Adjust based on rating difference (±1 goal per 200 ELO points)
  const homeAdjustment = (ratingDiff / 200) * 0.5;
  const awayAdjustment = -(ratingDiff / 200) * 0.5;
  
  return {
    home: Math.max(0.5, Math.min(4.0, baseGoals + homeAdjustment)),
    away: Math.max(0.5, Math.min(4.0, baseGoals + awayAdjustment)),
  };
}

/**
 * Generate match prediction based on ELO ratings
 */
export function generatePrediction(
  homeTeamId: number,
  homeTeamName: string,
  homeRating: number,
  awayTeamId: number,
  awayTeamName: string,
  awayRating: number
): MatchPrediction {
  // Calculate win probabilities
  const probabilities = calculateWinProbabilities(homeRating, awayRating);
  
  // Predict goals
  const goals = predictGoals(homeRating, awayRating);
  
  // Determine winner
  let winner: { id: number | null; name: string; comment: string };
  let advice: string;
  
  if (probabilities.home > probabilities.away && probabilities.home > probabilities.draw) {
    winner = {
      id: homeTeamId,
      name: homeTeamName,
      comment: "Home team has higher ELO rating and home advantage",
    };
    advice = `Bet on ${homeTeamName} to win`;
  } else if (probabilities.away > probabilities.home && probabilities.away > probabilities.draw) {
    winner = {
      id: awayTeamId,
      name: awayTeamName,
      comment: "Away team has significantly higher ELO rating",
    };
    advice = `Bet on ${awayTeamName} to win`;
  } else {
    winner = {
      id: null,
      name: "Draw",
      comment: "Teams are closely matched based on ELO ratings",
    };
    advice = "Consider draw or double chance bet";
  }
  
  // Determine win_or_draw (home team perspective)
  const win_or_draw = probabilities.home + probabilities.draw > 0.6;
  
  // Determine under/over based on predicted total goals
  const totalGoals = goals.home + goals.away;
  const under_over = totalGoals > 2.5 ? "Over 2.5" : totalGoals < 2.5 ? "Under 2.5" : null;
  
  return {
    winner,
    win_or_draw,
    under_over,
    goals: {
      home: goals.home.toFixed(1),
      away: goals.away.toFixed(1),
    },
    advice,
    percent: {
      home: (probabilities.home * 100).toFixed(0) + "%",
      draw: (probabilities.draw * 100).toFixed(0) + "%",
      away: (probabilities.away * 100).toFixed(0) + "%",
    },
  };
}

/**
 * Get or initialize ELO rating for a team
 */
export function getOrInitializeRating(
  existingRating: ELORating | undefined,
  teamId: number
): ELORating {
  if (existingRating) {
    return existingRating;
  }
  
  return {
    teamId,
    rating: DEFAULT_ELO_CONFIG.initialRating,
    matchesPlayed: 0,
    lastUpdated: new Date(),
  };
}

/**
 * Calculate K-factor based on matches played (higher K for new teams)
 */
export function calculateKFactor(matchesPlayed: number): number {
  if (matchesPlayed < 10) {
    return 40; // High volatility for new teams
  } else if (matchesPlayed < 30) {
    return 32; // Standard volatility
  } else {
    return 24; // Lower volatility for established teams
  }
}
