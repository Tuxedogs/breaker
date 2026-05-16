import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!existsSync(".env.local")) return undefined;

  const envFile = readFileSync(".env.local", "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
    if (!match) continue;
    return match[1].replace(/^['"]|['"]$/g, "");
  }

  return undefined;
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: readDatabaseUrl() ?? "",
  },
});
