
import { footballDataClient } from "../ingestion/sources/football-data-org";
import { syncLogger } from "../ingestion/utils/sync-logger";
import { getDb } from "../db";
import { trophies, coaches, players } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export async function syncTrophies() {
  const context = syncLogger.startSync("trophies-sync");
  
  try {
    console.log("[trophies-sync] Starting trophies synchronization...");
    
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // 1. Sync Coach Trophies
    // Get coaches that don't have trophies yet or just all coaches?
    // Let's do top 20 coaches for now to save API calls
    const coachList = await db.select().from(coaches).limit(20);
    console.log(`[trophies-sync] Processing ${coachList.length} coaches`);

    for (const coach of coachList) {
        if (!coach.externalId) continue;
        try {
            const response = await footballDataClient.getTrophies({ coach: coach.externalId });
            if (!response || !response.response) continue;

            const trophiesData = response.response;
            for (const t of trophiesData) {
                // Check if exists
                const existing = await db.select().from(trophies).where(
                    and(
                        eq(trophies.entityType, "coach"),
                        eq(trophies.entityId, coach.id),
                        eq(trophies.league, t.league),
                        eq(trophies.season, t.season)
                    )
                ).limit(1);

                if (existing.length === 0) {
                    await db.insert(trophies).values({
                        entityType: "coach",
                        entityId: coach.id,
                        league: t.league,
                        country: t.country,
                        season: t.season,
                        place: t.place
                    });
                    context.recordsInserted++;
                }
            }
        } catch (err) {
            console.error(`[trophies-sync] Error processing coach ${coach.name}:`, err);
            context.errors.push(err instanceof Error ? err.message : "Unknown error");
        }
    }

    // 2. Sync Player Trophies (Top 20 players?)
    // This is just to demonstrate population
    const playerList = await db.select().from(players).limit(20);
    console.log(`[trophies-sync] Processing ${playerList.length} players`);

    for (const player of playerList) {
        if (!player.externalId) continue;
        try {
            const response = await footballDataClient.getTrophies({ player: player.externalId });
            if (!response || !response.response) continue;

            const trophiesData = response.response;
            for (const t of trophiesData) {
                 const existing = await db.select().from(trophies).where(
                    and(
                        eq(trophies.entityType, "player"),
                        eq(trophies.entityId, player.id),
                        eq(trophies.league, t.league),
                        eq(trophies.season, t.season)
                    )
                ).limit(1);

                if (existing.length === 0) {
                    await db.insert(trophies).values({
                        entityType: "player",
                        entityId: player.id,
                        league: t.league,
                        country: t.country,
                        season: t.season,
                        place: t.place
                    });
                    context.recordsInserted++;
                }
            }
        } catch (err) {
            console.error(`[trophies-sync] Error processing player ${player.name}:`, err);
            context.errors.push(err instanceof Error ? err.message : "Unknown error");
        }
    }

    syncLogger.endSync(context, "football-data.org");
  } catch (error) {
    console.error("[trophies-sync] Fatal error:", error);
    context.errors.push(error instanceof Error ? error.message : "Unknown error");
    syncLogger.endSync(context, "football-data.org");
  }
}

