import { defineConfig } from "drizzle-kit";
import { assertStagingMigrationConfiguration } from "./src/server/staging/migrationConfig.js";

// No fallback to a developer's potentially production-linked .env.local.
const { databaseUrl } = assertStagingMigrationConfiguration();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
