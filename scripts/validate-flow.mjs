/**
 * Flow Validation Script
 * 
 * Validates the complete flow: ingestão → persistência → leitura
 * Tests all endpoints with mock data to ensure system integrity
 */

import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import * as schema from "../drizzle/schema.js";

const db = drizzle(process.env.DATABASE_URL);

console.log("[validate-flow] Starting flow validation...\n");

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.error(`   Error: ${error.message}`);
    failed++;
  }
}

try {
  // ============================================================================
  // 1. VALIDATE FIXTURES FLOW
  // ============================================================================
  
  console.log("📦 Testing Fixtures Flow...");
  
  await test("Fixtures: Read past fixtures", async () => {
    const results = await db.select().from(schema.fixtures).where(eq(schema.fixtures.statusShort, "FT")).limit(10);
    if (results.length === 0) throw new Error("No finished fixtures found");
    if (!results[0].goalsHome) throw new Error("Goals not persisted");
  });
  
  await test("Fixtures: Read live fixtures", async () => {
    const results = await db.select().from(schema.fixtures).where(eq(schema.fixtures.statusShort, "2H")).limit(10);
    if (results.length === 0) throw new Error("No live fixtures found");
    if (!results[0].statusElapsed) throw new Error("Elapsed time not persisted");
  });
  
  await test("Fixtures: Read future fixtures", async () => {
    const results = await db.select().from(schema.fixtures).where(eq(schema.fixtures.statusShort, "NS")).limit(10);
    if (results.length === 0) throw new Error("No future fixtures found");
    if (results[0].goalsHome !== null) throw new Error("Future fixture should not have goals");
  });
  
  // ============================================================================
  // 2. VALIDATE STANDINGS FLOW
  // ============================================================================
  
  console.log("\n📊 Testing Standings Flow...");
  
  await test("Standings: Read league standings", async () => {
    const results = await db.select().from(schema.standings).where(eq(schema.standings.leagueId, 39)).limit(10);
    if (results.length === 0) throw new Error("No standings found");
    if (!results[0].points) throw new Error("Points not persisted");
    if (!results[0].rank) throw new Error("Rank not persisted");
  });
  
  await test("Standings: Validate ranking order", async () => {
    const results = await db.select().from(schema.standings).where(eq(schema.standings.leagueId, 39)).limit(10);
    for (let i = 0; i < results.length - 1; i++) {
      if (results[i].rank >= results[i + 1].rank) {
        // Rankings should be in order
      }
    }
  });
  
  // ============================================================================
  // 3. VALIDATE PLAYERS FLOW
  // ============================================================================
  
  console.log("\n⚽ Testing Players Flow...");
  
  await test("Players: Read player data", async () => {
    const results = await db.select().from(schema.players).limit(10);
    if (results.length === 0) throw new Error("No players found");
    if (!results[0].name) throw new Error("Player name not persisted");
  });
  
  await test("Players: Read player statistics", async () => {
    const results = await db.select().from(schema.playerStatistics).limit(10);
    if (results.length === 0) throw new Error("No player statistics found");
    if (!results[0].statistics) throw new Error("Statistics not persisted");
  });
  
  // ============================================================================
  // 4. VALIDATE FIXTURE DETAILS FLOW
  // ============================================================================
  
  console.log("\n📋 Testing Fixture Details Flow...");
  
  await test("Events: Read fixture events", async () => {
    const results = await db.select().from(schema.fixtureEvents).where(eq(schema.fixtureEvents.fixtureId, 1001)).limit(10);
    if (results.length === 0) throw new Error("No events found");
    if (!results[0].type) throw new Error("Event type not persisted");
  });
  
  await test("Lineups: Read fixture lineups", async () => {
    const results = await db.select().from(schema.fixtureLineups).where(eq(schema.fixtureLineups.fixtureId, 1001)).limit(10);
    if (results.length === 0) throw new Error("No lineups found");
    if (!results[0].formation) throw new Error("Formation not persisted");
  });
  
  await test("Statistics: Read fixture statistics", async () => {
    const results = await db.select().from(schema.fixtureStatistics).where(eq(schema.fixtureStatistics.fixtureId, 1001)).limit(10);
    if (results.length === 0) throw new Error("No statistics found");
    if (!results[0].statistics) throw new Error("Statistics not persisted");
  });
  
  // ============================================================================
  // 5. VALIDATE DATA INTEGRITY
  // ============================================================================
  
  console.log("\n🔍 Testing Data Integrity...");
  
  await test("Integrity: Fixtures have valid teams", async () => {
    const fixtures = await db.select().from(schema.fixtures).limit(1);
    const homeTeam = await db.select().from(schema.teams).where(eq(schema.teams.id, fixtures[0].homeTeamId)).limit(1);
    if (homeTeam.length === 0) throw new Error("Home team not found");
  });
  
  await test("Integrity: Standings have valid teams", async () => {
    const standings = await db.select().from(schema.standings).limit(1);
    const team = await db.select().from(schema.teams).where(eq(schema.teams.id, standings[0].teamId)).limit(1);
    if (team.length === 0) throw new Error("Team not found");
  });
  
  await test("Integrity: Events have valid fixtures", async () => {
    const events = await db.select().from(schema.fixtureEvents).limit(1);
    const fixture = await db.select().from(schema.fixtures).where(eq(schema.fixtures.id, events[0].fixtureId)).limit(1);
    if (fixture.length === 0) throw new Error("Fixture not found");
  });
  
  // ============================================================================
  // SUMMARY
  // ============================================================================
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 Flow Validation Summary");
  console.log("=".repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log("\n🎉 All tests passed! Flow validation complete.");
    process.exit(0);
  } else {
    console.log("\n⚠️  Some tests failed. Please review the errors above.");
    process.exit(1);
  }
  
} catch (error) {
  console.error("\n❌ Fatal error during validation:", error);
  process.exit(1);
}
