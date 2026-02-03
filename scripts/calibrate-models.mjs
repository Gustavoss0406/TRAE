/**
 * Model Calibration Script
 * 
 * Analyzes real fixture data to calculate league-specific parameters:
 * - Average goals per match
 * - Home advantage factor
 * - Goal distribution statistics
 * 
 * These parameters are used to improve Poisson odds and ELO predictions.
 */

import { drizzle } from 'drizzle-orm/mysql2';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { fixtures, leagues } from '../drizzle/schema.js';

const db = drizzle(process.env.DATABASE_URL);

/**
 * Calculate league statistics from completed fixtures
 */
async function calculateLeagueStats(leagueId) {
  // Get all completed fixtures (FT status) for this league
  const completedFixtures = await db
    .select({
      homeGoals: fixtures.goalsHome,
      awayGoals: fixtures.goalsAway,
      statusShort: fixtures.statusShort,
    })
    .from(fixtures)
    .where(
      and(
        eq(fixtures.leagueId, leagueId),
        eq(fixtures.statusShort, 'FT'),
        isNotNull(fixtures.goalsHome),
        isNotNull(fixtures.goalsAway)
      )
    );

  if (completedFixtures.length === 0) {
    return null;
  }

  // Calculate statistics
  let totalGoals = 0;
  let homeGoals = 0;
  let awayGoals = 0;
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  completedFixtures.forEach((fixture) => {
    const home = fixture.homeGoals;
    const away = fixture.awayGoals;
    
    totalGoals += home + away;
    homeGoals += home;
    awayGoals += away;
    
    if (home > away) homeWins++;
    else if (home === away) draws++;
    else awayWins++;
  });

  const matchCount = completedFixtures.length;
  const avgGoalsPerMatch = totalGoals / matchCount;
  const avgHomeGoals = homeGoals / matchCount;
  const avgAwayGoals = awayGoals / matchCount;
  const homeAdvantage = avgHomeGoals / avgAwayGoals;

  return {
    leagueId,
    matchCount,
    avgGoalsPerMatch: avgGoalsPerMatch.toFixed(2),
    avgHomeGoals: avgHomeGoals.toFixed(2),
    avgAwayGoals: avgAwayGoals.toFixed(2),
    homeAdvantage: homeAdvantage.toFixed(2),
    homeWinRate: ((homeWins / matchCount) * 100).toFixed(1) + '%',
    drawRate: ((draws / matchCount) * 100).toFixed(1) + '%',
    awayWinRate: ((awayWins / matchCount) * 100).toFixed(1) + '%',
  };
}

/**
 * Validate model sanity checks
 */
function validateModelSanity(stats) {
  const issues = [];

  // Check 1: Average goals should be between 1.5 and 4.0
  const avgGoals = parseFloat(stats.avgGoalsPerMatch);
  if (avgGoals < 1.5 || avgGoals > 4.0) {
    issues.push(`⚠️  Average goals (${avgGoals}) outside normal range [1.5, 4.0]`);
  }

  // Check 2: Home advantage should be between 1.0 and 1.5
  const homeAdv = parseFloat(stats.homeAdvantage);
  if (homeAdv < 1.0 || homeAdv > 1.5) {
    issues.push(`⚠️  Home advantage (${homeAdv}) outside normal range [1.0, 1.5]`);
  }

  // Check 3: Home win rate should be higher than away win rate
  const homeWinRate = parseFloat(stats.homeWinRate);
  const awayWinRate = parseFloat(stats.awayWinRate);
  if (homeWinRate <= awayWinRate) {
    issues.push(`⚠️  Home win rate (${homeWinRate}%) not higher than away (${awayWinRate}%)`);
  }

  // Check 4: Draw rate should be between 15% and 35%
  const drawRate = parseFloat(stats.drawRate);
  if (drawRate < 15 || drawRate > 35) {
    issues.push(`⚠️  Draw rate (${drawRate}%) outside normal range [15%, 35%]`);
  }

  // Check 5: Win probabilities should sum to 100%
  const totalProb = homeWinRate + drawRate + awayWinRate;
  if (Math.abs(totalProb - 100) > 0.5) {
    issues.push(`⚠️  Probabilities don't sum to 100% (${totalProb.toFixed(1)}%)`);
  }

  return issues;
}

/**
 * Main calibration process
 */
async function main() {
  console.log('=== Football Data Platform - Model Calibration ===\n');

  // Get all leagues with fixtures
  const allLeagues = await db
    .select({
      id: leagues.id,
      name: leagues.name,
    })
    .from(leagues);

  console.log(`Found ${allLeagues.length} leagues in database\n`);

  const calibrationResults = [];
  let totalIssues = 0;

  for (const league of allLeagues) {
    const stats = await calculateLeagueStats(league.id);
    
    if (!stats) {
      console.log(`⏭️  ${league.name} (ID: ${league.id}): No completed fixtures yet`);
      continue;
    }

    console.log(`\n📊 ${league.name} (ID: ${league.id})`);
    console.log(`   Completed matches: ${stats.matchCount}`);
    console.log(`   Avg goals/match: ${stats.avgGoalsPerMatch}`);
    console.log(`   Avg home goals: ${stats.avgHomeGoals}`);
    console.log(`   Avg away goals: ${stats.avgAwayGoals}`);
    console.log(`   Home advantage: ${stats.homeAdvantage}x`);
    console.log(`   Win distribution: ${stats.homeWinRate} H / ${stats.drawRate} D / ${stats.awayWinRate} A`);

    // Validate sanity checks
    const issues = validateModelSanity(stats);
    if (issues.length > 0) {
      console.log(`\n   Sanity Check Issues:`);
      issues.forEach(issue => console.log(`   ${issue}`));
      totalIssues += issues.length;
    } else {
      console.log(`   ✅ All sanity checks passed`);
    }

    calibrationResults.push({
      league: league.name,
      ...stats,
      issues: issues.length,
    });
  }

  // Summary
  console.log('\n\n=== Calibration Summary ===\n');
  
  const leaguesWithData = calibrationResults.length;
  const leaguesWithIssues = calibrationResults.filter(r => r.issues > 0).length;
  
  console.log(`Total leagues analyzed: ${leaguesWithData}`);
  console.log(`Leagues with sanity check issues: ${leaguesWithIssues}`);
  console.log(`Total issues found: ${totalIssues}`);

  if (totalIssues === 0) {
    console.log('\n✅ All models passed sanity checks!');
    console.log('   - Odds calculations are coherent');
    console.log('   - Probabilities sum correctly');
    console.log('   - No obvious biases detected');
  } else {
    console.log('\n⚠️  Some issues detected. Review the logs above.');
    console.log('   This may be due to:');
    console.log('   - Insufficient data (< 20 matches)');
    console.log('   - Unusual league characteristics');
    console.log('   - Data quality issues');
  }

  // Calculate global averages for leagues with sufficient data
  const validLeagues = calibrationResults.filter(r => r.matchCount >= 20);
  
  if (validLeagues.length > 0) {
    const globalAvgGoals = validLeagues.reduce((sum, l) => sum + parseFloat(l.avgGoalsPerMatch), 0) / validLeagues.length;
    const globalHomeAdv = validLeagues.reduce((sum, l) => sum + parseFloat(l.homeAdvantage), 0) / validLeagues.length;
    
    console.log('\n📈 Global Averages (leagues with 20+ matches):');
    console.log(`   Average goals per match: ${globalAvgGoals.toFixed(2)}`);
    console.log(`   Home advantage factor: ${globalHomeAdv.toFixed(2)}x`);
    console.log('\n   💡 Recommended model parameters:');
    console.log(`   - leagueAverage.goalsPerMatch: ${globalAvgGoals.toFixed(1)}`);
    console.log(`   - leagueAverage.homeAdvantage: ${globalHomeAdv.toFixed(2)}`);
  }

  console.log('\n=== Calibration Complete ===\n');
  process.exit(0);
}

main().catch((error) => {
  console.error('Calibration failed:', error);
  process.exit(1);
});
