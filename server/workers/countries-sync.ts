
import { footballDataClient } from "../ingestion/sources/football-data-org";
import { syncLogger } from "../ingestion/utils/sync-logger";
import { getDb } from "../db";
import { countries } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export async function syncCountries() {
  const context = syncLogger.startSync("countries-sync");
  
  try {
    console.log("[countries-sync] Starting countries synchronization...");
    
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }
    
    const response = await footballDataClient.getCountries();
    
    if (response && response.response) {
      const countriesData = response.response;
      console.log(`[countries-sync] Received ${countriesData.length} countries`);
      
      for (const country of countriesData) {
        try {
            const c = {
                name: country.name,
                code: country.code,
                flag: country.flag
            };
            
            // Check if exists
            const existing = await db.select().from(countries).where(eq(countries.name, c.name)).limit(1);
            
            if (existing.length === 0) {
                await db.insert(countries).values(c);
                context.recordsProcessed++;
            }
        } catch (e) {
            console.error(`[countries-sync] Error processing country ${country.name}:`, e);
        }
      }
    }
    
    syncLogger.endSync(context, "football-data.org");
  } catch (error) {
    context.errors.push(error instanceof Error ? error.message : "Unknown error");
    syncLogger.endSync(context, "football-data.org");
  }
}
