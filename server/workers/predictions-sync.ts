
import { footballDataClient } from "../ingestion/sources/football-data-org";
import { syncLogger } from "../ingestion/utils/sync-logger";
import { getDb } from "../db";
import { predictions, fixtures } from "../../drizzle/schema";
import { eq, and, gt, lt } from "drizzle-orm";

export async function syncPredictions() {
  const context = syncLogger.startSync("predictions-sync");
  
  try {
    console.log("[predictions-sync] Starting predictions synchronization...");
    
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
      .limit(20); // Limit to avoid rate limits
    
    console.log(`[predictions-sync] Found ${upcomingFixtures.length} upcoming fixtures`);

    for (const fixture of upcomingFixtures) {
        if (!fixture.externalId) continue;

        try {
            console.log(`[predictions-sync] Fetching predictions for fixture ${fixture.externalId}`);
            const response = await footballDataClient.getPredictions(fixture.externalId);
            
            if (!response || !response.response || response.response.length === 0) continue;

            const predData = response.response[0]; // Usually one prediction object per fixture
            const predictionsObj = predData.predictions;

            // Upsert
            const existing = await db.select().from(predictions).where(eq(predictions.fixtureId, fixture.id)).limit(1);

            const data = {
                fixtureId: fixture.id,
                winnerName: predictionsObj.winner?.name,
                winnerComment: predictionsObj.winner?.comment,
                winOrDraw: predictionsObj.win_or_draw,
                underOver: predictionsObj.under_over,
                goalsHome: predictionsObj.goals?.home ? predictionsObj.goals.home.toString() : null,
                goalsAway: predictionsObj.goals?.away ? predictionsObj.goals.away.toString() : null,
                advice: predictionsObj.advice,
                percentHome: predictionsObj.percent?.home ? predictionsObj.percent.home.replace('%', '') : null,
                percentDraw: predictionsObj.percent?.draw ? predictionsObj.percent.draw.replace('%', '') : null,
                percentAway: predictionsObj.percent?.away ? predictionsObj.percent.away.replace('%', '') : null,
                updatedAt: new Date()
            };

            if (existing.length > 0) {
                await db.update(predictions).set(data).where(eq(predictions.id, existing[0].id));
                context.recordsUpdated++;
            } else {
                await db.insert(predictions).values(data);
                context.recordsInserted++;
            }

        } catch (err) {
            console.error(`[predictions-sync] Error processing fixture ${fixture.externalId}:`, err);
            context.errors.push(err instanceof Error ? err.message : "Unknown error");
        }
    }

    syncLogger.endSync(context, "football-data.org");
  } catch (error) {
    console.error("[predictions-sync] Fatal error:", error);
    context.errors.push(error instanceof Error ? error.message : "Unknown error");
    syncLogger.endSync(context, "football-data.org");
  }
}
