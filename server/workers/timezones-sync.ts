
import { footballDataClient } from "../ingestion/sources/football-data-org";
import { syncLogger } from "../ingestion/utils/sync-logger";
import { getDb } from "../db";
import { timezones } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export async function syncTimezones() {
  const context = syncLogger.startSync("timezones-sync");
  
  try {
    console.log("[timezones-sync] Starting timezones synchronization...");
    
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }
    
    // Use static list for timezones as Football-Data.org doesn't provide a list endpoint
    const timezonesData = [
      "UTC", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Rome",
      "Europe/Madrid", "Europe/Lisbon", "Europe/Amsterdam", "America/Sao_Paulo",
      "America/New_York", "Asia/Tokyo", "Australia/Sydney"
    ]; // Add more as needed
    
    if (timezonesData) {
      console.log(`[timezones-sync] Processing ${timezonesData.length} timezones`);
      
      for (const timezone of timezonesData) {
        try {
            // Check if exists
            const existing = await db.select().from(timezones).where(eq(timezones.timezone, timezone)).limit(1);
            
            if (existing.length === 0) {
                await db.insert(timezones).values({ timezone: timezone });
                context.recordsProcessed++;
            }
        } catch (e) {
            console.error(`[timezones-sync] Error processing timezone ${timezone}:`, e);
        }
      }
    }
    
    syncLogger.endSync(context, "static-list");
  } catch (error) {
    context.errors.push(error instanceof Error ? error.message : "Unknown error");
    syncLogger.endSync(context, "static-list");
  }
}
