/**
 * Poisson Regression Model for Fair Odds Calculation
 * 
 * Implements Poisson distribution-based probability calculation for football matches.
 * Calculates expected goals (xG) and converts to fair odds for betting markets.
 * 
 * Mathematical Foundation:
 * - P(X=k) = (λ^k * e^-λ) / k!
 * - λ (lambda) = expected goals for a team
 * - Accounts for home advantage, team strength, and historical performance
 */

interface TeamStats {
  goalsScored: number;
  goalsConceded: number;
  matchesPlayed: number;
  homeGoalsScored?: number;
  homeGoalsConceded?: number;
  awayGoalsScored?: number;
  awayGoalsConceded?: number;
  homeMatchesPlayed?: number;
  awayMatchesPlayed?: number;
}

interface MatchOdds {
  home: number;
  draw: number;
  away: number;
}

interface DetailedOdds {
  match_winner: MatchOdds;
  goals_over_under: {
    over_0_5: number;
    over_1_5: number;
    over_2_5: number;
    over_3_5: number;
    over_4_5: number;
    over_5_5: number;
    under_0_5: number;
    under_1_5: number;
    under_2_5: number;
    under_3_5: number;
    under_4_5: number;
    under_5_5: number;
  };
  both_teams_score: {
    yes: number;
    no: number;
  };
}

/**
 * Calculate factorial (n!)
 */
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

/**
 * Calculate Poisson probability P(X=k) = (λ^k * e^-λ) / k!
 */
function poissonProbability(lambda: number, k: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

/**
 * Calculate expected goals (xG) for a team based on historical performance
 */
export function calculateExpectedGoals(
  teamStats: TeamStats,
  opponentStats: TeamStats,
  isHome: boolean,
  leagueAverage: { goalsPerMatch: number; homeAdvantage: number } = {
    goalsPerMatch: 2.7,
    homeAdvantage: 1.3,
  }
): number {
  const matchesPlayed = isHome
    ? (teamStats.homeMatchesPlayed || teamStats.matchesPlayed)
    : (teamStats.awayMatchesPlayed || teamStats.matchesPlayed);
  
  const goalsScored = isHome
    ? (teamStats.homeGoalsScored || teamStats.goalsScored)
    : (teamStats.awayGoalsScored || teamStats.goalsScored);
  
  const opponentGoalsConceded = isHome
    ? (opponentStats.awayGoalsConceded || opponentStats.goalsConceded)
    : (opponentStats.homeGoalsConceded || opponentStats.goalsConceded);
  
  const opponentMatchesPlayed = isHome
    ? (opponentStats.awayMatchesPlayed || opponentStats.matchesPlayed)
    : (opponentStats.homeMatchesPlayed || opponentStats.matchesPlayed);
  
  // Handle edge case: insufficient data
  if (matchesPlayed < 3 || opponentMatchesPlayed < 3) {
    // Use league average with home advantage factor
    return leagueAverage.goalsPerMatch * (isHome ? leagueAverage.homeAdvantage : 1.0) / 2;
  }
  
  // Calculate attack strength and defense strength
  const attackStrength = (goalsScored / matchesPlayed) / (leagueAverage.goalsPerMatch / 2);
  const defenseStrength = (opponentGoalsConceded / opponentMatchesPlayed) / (leagueAverage.goalsPerMatch / 2);
  
  // Calculate expected goals with home advantage
  const homeAdvantage = isHome ? leagueAverage.homeAdvantage : 1.0;
  const expectedGoals = attackStrength * defenseStrength * (leagueAverage.goalsPerMatch / 2) * homeAdvantage;
  
  // Clamp to reasonable range (0.2 to 5.0 goals)
  return Math.max(0.2, Math.min(5.0, expectedGoals));
}

/**
 * Calculate match outcome probabilities using Poisson distribution
 */
export function calculateMatchProbabilities(
  homeExpectedGoals: number,
  awayExpectedGoals: number,
  maxGoals: number = 10
): { homeWin: number; draw: number; awayWin: number } {
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  
  // Calculate probability for each possible score combination
  for (let homeGoals = 0; homeGoals <= maxGoals; homeGoals++) {
    for (let awayGoals = 0; awayGoals <= maxGoals; awayGoals++) {
      const prob = 
        poissonProbability(homeExpectedGoals, homeGoals) *
        poissonProbability(awayExpectedGoals, awayGoals);
      
      if (homeGoals > awayGoals) {
        homeWin += prob;
      } else if (homeGoals === awayGoals) {
        draw += prob;
      } else {
        awayWin += prob;
      }
    }
  }
  
  // Normalize probabilities to sum to 1.0
  const total = homeWin + draw + awayWin;
  return {
    homeWin: homeWin / total,
    draw: draw / total,
    awayWin: awayWin / total,
  };
}

/**
 * Convert probability to fair odds (decimal format)
 */
export function probabilityToOdds(probability: number): number {
  if (probability <= 0 || probability >= 1) {
    return 1.01; // Minimum odds
  }
  return Math.max(1.01, 1 / probability);
}

/**
 * Calculate over/under probabilities for total goals
 */
export function calculateOverUnderProbabilities(
  homeExpectedGoals: number,
  awayExpectedGoals: number,
  threshold: number,
  maxGoals: number = 15
): { over: number; under: number } {
  const totalExpectedGoals = homeExpectedGoals + awayExpectedGoals;
  
  let underProb = 0;
  
  // Calculate probability of scoring exactly k goals
  for (let k = 0; k <= threshold; k++) {
    underProb += poissonProbability(totalExpectedGoals, k);
  }
  
  const overProb = 1 - underProb;
  
  return {
    over: Math.max(0.01, Math.min(0.99, overProb)),
    under: Math.max(0.01, Math.min(0.99, underProb)),
  };
}

/**
 * Calculate both teams to score (BTTS) probability
 */
export function calculateBTTSProbability(
  homeExpectedGoals: number,
  awayExpectedGoals: number
): { yes: number; no: number } {
  // P(both score) = P(home >= 1) * P(away >= 1)
  const homeScoreProb = 1 - poissonProbability(homeExpectedGoals, 0);
  const awayScoreProb = 1 - poissonProbability(awayExpectedGoals, 0);
  
  const yesProb = homeScoreProb * awayScoreProb;
  const noProb = 1 - yesProb;
  
  return {
    yes: Math.max(0.01, Math.min(0.99, yesProb)),
    no: Math.max(0.01, Math.min(0.99, noProb)),
  };
}

/**
 * Generate comprehensive odds for a match
 */
export function generateMatchOdds(
  homeTeamStats: TeamStats,
  awayTeamStats: TeamStats,
  leagueAverage?: { goalsPerMatch: number; homeAdvantage: number }
): DetailedOdds {
  // Calculate expected goals
  const homeXG = calculateExpectedGoals(homeTeamStats, awayTeamStats, true, leagueAverage);
  const awayXG = calculateExpectedGoals(awayTeamStats, homeTeamStats, false, leagueAverage);
  
  // Calculate match outcome probabilities
  const { homeWin, draw, awayWin } = calculateMatchProbabilities(homeXG, awayXG);
  
  // Calculate over/under probabilities
  const overUnder = {
    over_0_5: calculateOverUnderProbabilities(homeXG, awayXG, 0).over,
    over_1_5: calculateOverUnderProbabilities(homeXG, awayXG, 1).over,
    over_2_5: calculateOverUnderProbabilities(homeXG, awayXG, 2).over,
    over_3_5: calculateOverUnderProbabilities(homeXG, awayXG, 3).over,
    over_4_5: calculateOverUnderProbabilities(homeXG, awayXG, 4).over,
    over_5_5: calculateOverUnderProbabilities(homeXG, awayXG, 5).over,
    under_0_5: calculateOverUnderProbabilities(homeXG, awayXG, 0).under,
    under_1_5: calculateOverUnderProbabilities(homeXG, awayXG, 1).under,
    under_2_5: calculateOverUnderProbabilities(homeXG, awayXG, 2).under,
    under_3_5: calculateOverUnderProbabilities(homeXG, awayXG, 3).under,
    under_4_5: calculateOverUnderProbabilities(homeXG, awayXG, 4).under,
    under_5_5: calculateOverUnderProbabilities(homeXG, awayXG, 5).under,
  };
  
  // Calculate BTTS probability
  const btts = calculateBTTSProbability(homeXG, awayXG);
  
  // Convert probabilities to odds
  return {
    match_winner: {
      home: probabilityToOdds(homeWin),
      draw: probabilityToOdds(draw),
      away: probabilityToOdds(awayWin),
    },
    goals_over_under: {
      over_0_5: probabilityToOdds(overUnder.over_0_5),
      over_1_5: probabilityToOdds(overUnder.over_1_5),
      over_2_5: probabilityToOdds(overUnder.over_2_5),
      over_3_5: probabilityToOdds(overUnder.over_3_5),
      over_4_5: probabilityToOdds(overUnder.over_4_5),
      over_5_5: probabilityToOdds(overUnder.over_5_5),
      under_0_5: probabilityToOdds(overUnder.under_0_5),
      under_1_5: probabilityToOdds(overUnder.under_1_5),
      under_2_5: probabilityToOdds(overUnder.under_2_5),
      under_3_5: probabilityToOdds(overUnder.under_3_5),
      under_4_5: probabilityToOdds(overUnder.under_4_5),
      under_5_5: probabilityToOdds(overUnder.under_5_5),
    },
    both_teams_score: {
      yes: probabilityToOdds(btts.yes),
      no: probabilityToOdds(btts.no),
    },
  };
}
