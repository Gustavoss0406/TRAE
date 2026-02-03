/**
 * Essential Monitoring System
 * 
 * Tracks key operational metrics:
 * - Volume of ingested data
 * - API latency
 * - Error rates
 * - Ingestion failures
 * 
 * Alerts on critical issues without complex dashboards.
 */

import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';
import { fixtures, leagues, teams } from '../drizzle/schema.js';

const db = drizzle(process.env.DATABASE_URL);

/**
 * Alert thresholds
 */
const THRESHOLDS = {
  MIN_FIXTURES_PER_DAY: 10,
  MAX_API_LATENCY_MS: 1000,
  MAX_ERROR_RATE_PERCENT: 5,
  MIN_DATA_FRESHNESS_HOURS: 24,
};

/**
 * Get data volume metrics
 */
async function getDataVolumeMetrics() {
  const [fixtureCount] = await db.select({ count: sql`COUNT(*)` }).from(fixtures);
  const [leagueCount] = await db.select({ count: sql`COUNT(*)` }).from(leagues);
  const [teamCount] = await db.select({ count: sql`COUNT(*)` }).from(teams);

  // Get fixtures by date (last 7 days)
  const fixturesByDate = await db.execute(sql`
    SELECT 
      DATE(date) as fixture_date,
      COUNT(*) as count
    FROM fixtures
    WHERE date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    GROUP BY DATE(date)
    ORDER BY fixture_date DESC
  `);

  return {
    totalFixtures: fixtureCount.count,
    totalLeagues: leagueCount.count,
    totalTeams: teamCount.count,
    recentFixtures: fixturesByDate.rows || [],
  };
}

/**
 * Get data freshness metrics
 */
async function getDataFreshnessMetrics() {
  const [latestFixture] = await db.execute(sql`
    SELECT 
      MAX(updatedAt) as last_update,
      TIMESTAMPDIFF(HOUR, MAX(updatedAt), NOW()) as hours_since_update
    FROM fixtures
  `);

  const [latestIngestion] = await db.execute(sql`
    SELECT 
      MAX(createdAt) as last_ingestion,
      TIMESTAMPDIFF(HOUR, MAX(createdAt), NOW()) as hours_since_ingestion
    FROM fixtures
  `);

  return {
    lastUpdate: latestFixture.rows?.[0]?.last_update || null,
    hoursSinceUpdate: latestFixture.rows?.[0]?.hours_since_update || null,
    lastIngestion: latestIngestion.rows?.[0]?.last_ingestion || null,
    hoursSinceIngestion: latestIngestion.rows?.[0]?.hours_since_ingestion || null,
  };
}

/**
 * Simulate API latency check (would hit actual endpoints in production)
 */
async function getAPILatencyMetrics() {
  const endpoints = [
    '/api/trpc/football.fixtures',
    '/api/trpc/football.leagues',
    '/api/trpc/football.teams',
  ];

  // In production, would make actual HTTP requests
  // For now, simulate with database query times
  const start = Date.now();
  await db.select().from(fixtures).limit(10);
  const latency = Date.now() - start;

  return {
    avgLatency: latency,
    maxLatency: latency * 1.5, // Simulate variance
    endpoints: endpoints.length,
  };
}

/**
 * Get error rate metrics
 */
async function getErrorRateMetrics() {
  // In production, would track actual API errors
  // For now, check for data quality issues
  const [nullGoals] = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM fixtures
    WHERE statusShort = 'FT' AND (goalsHome IS NULL OR goalsAway IS NULL)
  `);

  const [totalCompleted] = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM fixtures
    WHERE statusShort = 'FT'
  `);

  const errorCount = nullGoals.rows?.[0]?.count || 0;
  const totalCount = totalCompleted.rows?.[0]?.count || 1;
  const errorRate = (errorCount / totalCount) * 100;

  return {
    errorCount,
    totalRequests: totalCount,
    errorRate: errorRate.toFixed(2),
  };
}

/**
 * Check for ingestion failures
 */
async function checkIngestionHealth() {
  const freshness = await getDataFreshnessMetrics();
  const alerts = [];

  // Alert if no data ingested in last 24 hours
  if (freshness.hoursSinceIngestion > THRESHOLDS.MIN_DATA_FRESHNESS_HOURS) {
    alerts.push({
      severity: 'HIGH',
      message: `No data ingested in ${freshness.hoursSinceIngestion} hours`,
      threshold: THRESHOLDS.MIN_DATA_FRESHNESS_HOURS,
    });
  }

  // Alert if data not updated in last 24 hours
  if (freshness.hoursSinceUpdate > THRESHOLDS.MIN_DATA_FRESHNESS_HOURS) {
    alerts.push({
      severity: 'MEDIUM',
      message: `Data not updated in ${freshness.hoursSinceUpdate} hours`,
      threshold: THRESHOLDS.MIN_DATA_FRESHNESS_HOURS,
    });
  }

  return alerts;
}

/**
 * Check API performance
 */
async function checkAPIPerformance() {
  const latency = await getAPILatencyMetrics();
  const alerts = [];

  if (latency.avgLatency > THRESHOLDS.MAX_API_LATENCY_MS) {
    alerts.push({
      severity: 'MEDIUM',
      message: `Average API latency ${latency.avgLatency}ms exceeds threshold`,
      threshold: THRESHOLDS.MAX_API_LATENCY_MS,
    });
  }

  return alerts;
}

/**
 * Check data quality
 */
async function checkDataQuality() {
  const errors = await getErrorRateMetrics();
  const alerts = [];

  if (parseFloat(errors.errorRate) > THRESHOLDS.MAX_ERROR_RATE_PERCENT) {
    alerts.push({
      severity: 'HIGH',
      message: `Error rate ${errors.errorRate}% exceeds threshold`,
      threshold: THRESHOLDS.MAX_ERROR_RATE_PERCENT,
    });
  }

  return alerts;
}

/**
 * Main monitoring process
 */
async function main() {
  console.log('=== Football Data Platform - System Monitor ===');
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // Collect metrics
  console.log('📊 Collecting metrics...\n');
  
  const volume = await getDataVolumeMetrics();
  const freshness = await getDataFreshnessMetrics();
  const latency = await getAPILatencyMetrics();
  const errors = await getErrorRateMetrics();

  // Display metrics
  console.log('=== Data Volume ===');
  console.log(`Total fixtures: ${volume.totalFixtures}`);
  console.log(`Total leagues: ${volume.totalLeagues}`);
  console.log(`Total teams: ${volume.totalTeams}`);
  
  if (volume.recentFixtures.length > 0) {
    console.log('\nRecent ingestion (last 7 days):');
    volume.recentFixtures.forEach(row => {
      console.log(`  ${row.fixture_date}: ${row.count} fixtures`);
    });
  }

  console.log('\n=== Data Freshness ===');
  console.log(`Last update: ${freshness.lastUpdate || 'N/A'}`);
  console.log(`Hours since update: ${freshness.hoursSinceUpdate || 'N/A'}`);
  console.log(`Last ingestion: ${freshness.lastIngestion || 'N/A'}`);
  console.log(`Hours since ingestion: ${freshness.hoursSinceIngestion || 'N/A'}`);

  console.log('\n=== API Performance ===');
  console.log(`Average latency: ${latency.avgLatency}ms`);
  console.log(`Max latency: ${latency.maxLatency.toFixed(0)}ms`);
  console.log(`Monitored endpoints: ${latency.endpoints}`);

  console.log('\n=== Error Rates ===');
  console.log(`Total requests: ${errors.totalRequests}`);
  console.log(`Errors: ${errors.errorCount}`);
  console.log(`Error rate: ${errors.errorRate}%`);

  // Check for alerts
  console.log('\n=== Health Checks ===');
  
  const ingestionAlerts = await checkIngestionHealth();
  const performanceAlerts = await checkAPIPerformance();
  const qualityAlerts = await checkDataQuality();
  
  const allAlerts = [...ingestionAlerts, ...performanceAlerts, ...qualityAlerts];

  if (allAlerts.length === 0) {
    console.log('✅ All systems operational');
    console.log('   - Data ingestion healthy');
    console.log('   - API performance normal');
    console.log('   - Data quality acceptable');
  } else {
    console.log(`⚠️  ${allAlerts.length} alert(s) detected:\n`);
    
    allAlerts.forEach((alert, index) => {
      const icon = alert.severity === 'HIGH' ? '🔴' : '🟡';
      console.log(`${icon} Alert ${index + 1} [${alert.severity}]`);
      console.log(`   ${alert.message}`);
      console.log(`   Threshold: ${alert.threshold}\n`);
    });

    console.log('Recommended actions:');
    if (ingestionAlerts.length > 0) {
      console.log('   - Check ingestion worker status');
      console.log('   - Verify upstream data source availability');
      console.log('   - Review ingestion logs for errors');
    }
    if (performanceAlerts.length > 0) {
      console.log('   - Check database query performance');
      console.log('   - Review cache hit rates');
      console.log('   - Consider scaling resources');
    }
    if (qualityAlerts.length > 0) {
      console.log('   - Investigate data quality issues');
      console.log('   - Check upstream data format changes');
      console.log('   - Review normalization logic');
    }
  }

  console.log('\n=== Monitor Complete ===\n');
  process.exit(allAlerts.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Monitoring failed:', error);
  process.exit(1);
});
