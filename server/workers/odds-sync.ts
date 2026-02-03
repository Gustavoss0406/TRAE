
import { footballDataClient } from "../ingestion/sources/football-data-org";
import { syncLogger } from "../ingestion/utils/sync-logger";
import { getDb } from "../db";
import { odds, fixtures } from "../../drizzle/schema";
import { eq, and, gt, lt } from "drizzle-orm";

export async function syncOdds() {
  const context = syncLogger.startSync("odds-sync");
  
  try {
    console.log("[odds-sync] Starting odds synchronization...");
    
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }
    
    // Get upcoming fixtures (next 7 days)
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);
    
    const upcomingFixtures = await db
      .select({
        id: fixtures.id,
        externalId: fixtures.externalId,
        date: fixtures.date
      })
      .from(fixtures)
      .where(
        and(
            gt(fixtures.date, now),
            lt(fixtures.date, nextWeek)
        )
      )
      .limit(20); 
    
    console.log(`[odds-sync] Found ${upcomingFixtures.length} upcoming fixtures`);

    for (const fixture of upcomingFixtures) {
        if (!fixture.externalId) continue;

        try {
            console.log(`[odds-sync] Fetching odds for fixture ${fixture.externalId}`);
            // Fetch pre-match odds
            const response = await footballDataClient.getOdds({ fixture: fixture.externalId });
            
            if (!response || !response.response || response.response.length === 0) continue;

            const oddsData = response.response[0]; // First bookmaker? Or response structure?
            // Response is array of objects with { league, fixture, update, bookmakers: [] }
            
            const bookmakers = oddsData.bookmakers;
            if (!bookmakers) continue;

            for (const bookmaker of bookmakers) {
                for (const bet of bookmaker.bets) {
                    // Check if exists
                    const existing = await db.select().from(odds).where(
                        and(
                            eq(odds.fixtureId, fixture.id),
                            eq(odds.bookmaker, bookmaker.name),
                            eq(odds.bet, bet.name)
                        )
                    ).limit(1);

                    const data = {
                        fixtureId: fixture.id,
                        bookmaker: bookmaker.name,
                        bet: bet.name,
                        values: bet.values, // JSON
                        updatedAt: new Date()
                    };

                    if (existing.length > 0) {
                        await db.update(odds).set(data).where(eq(odds.id, existing[0].id));
                        context.recordsUpdated++;
                    } else {
                        await db.insert(odds).values(data);
                        context.recordsInserted++;
                    }
                }
            }

        } catch (err) {
            console.error(`[odds-sync] Error processing fixture ${fixture.externalId}:`, err);
            context.errors.push(err instanceof Error ? err.message : "Unknown error");
        }
    }

    syncLogger.endSync(context, "football-data.org");
  } catch (error) {
    console.error("[odds-sync] Fatal error:", error);
    context.errors.push(error instanceof Error ? error.message : "Unknown error");
    syncLogger.endSync(context, "football-data.org");
  }
}
