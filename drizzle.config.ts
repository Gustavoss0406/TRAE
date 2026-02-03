import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

// Auto-detect database type from connection string
const isPostgreSQL = connectionString.startsWith("postgres://") || connectionString.startsWith("postgresql://");
const dialect = isPostgreSQL ? "postgresql" : "mysql";

console.log(`[Drizzle Config] Detected database: ${dialect}`);
console.log(`[Drizzle Config] Using schema: ./drizzle/schema${isPostgreSQL ? ".postgres" : ""}.ts`);

export default defineConfig({
  schema: isPostgreSQL ? "./drizzle/schema.postgres.ts" : "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: dialect as "postgresql" | "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
