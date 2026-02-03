
import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

async function runMigration() {
  console.log("Running manual migration to add source and isOfficial columns...");
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  
  try {
    // Add source column
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fixtures' AND column_name='source') THEN 
          ALTER TABLE "fixtures" ADD COLUMN "source" VARCHAR(50) DEFAULT 'api' NOT NULL; 
        END IF; 
      END $$;
    `);
    console.log("Added 'source' column.");

    // Add isOfficial column
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fixtures' AND column_name='isOfficial') THEN 
          ALTER TABLE "fixtures" ADD COLUMN "isOfficial" BOOLEAN DEFAULT TRUE NOT NULL; 
        END IF; 
      END $$;
    `);
    console.log("Added 'isOfficial' column.");

    // Update existing records to be official
    // await db.execute(sql`UPDATE "fixtures" SET "source" = 'api', "isOfficial" = TRUE WHERE "source" IS NULL`);
    
    console.log("Migration completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

runMigration();
