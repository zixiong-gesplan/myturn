import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import { readFile, readdir } from "node:fs/promises";

dotenv.config({ path: ".env.local" });
const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("Define TURSO_DATABASE_URL en .env.local antes de migrar");

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
await client.execute(
  "CREATE TABLE IF NOT EXISTS _app_migrations (name TEXT PRIMARY KEY NOT NULL, applied_at INTEGER NOT NULL)",
);

try {
  const migrationFiles = (await readdir(new URL("../drizzle/", import.meta.url)))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();
  for (const file of migrationFiles) {
    const migrationName = file.replace(/\.sql$/, "");
    const applied = await client.execute({
      sql: "SELECT name FROM _app_migrations WHERE name = ?",
      args: [migrationName],
    });
    if (applied.rows.length) {
      console.log(`Migración ${migrationName} ya aplicada.`);
      continue;
    }

    const migrationSql = await readFile(new URL(`../drizzle/${file}`, import.meta.url), "utf8");
    const statements = migrationSql
      .split(/;\s*(?:\r?\n|$)/)
      .map((statement) => statement.trim())
      .filter(Boolean);
    const transaction = await client.transaction("write");
    try {
      for (const statement of statements) await transaction.execute(statement);
      await transaction.execute({
        sql: "INSERT INTO _app_migrations (name, applied_at) VALUES (?, ?)",
        args: [migrationName, Math.floor(Date.now() / 1000)],
      });
      await transaction.commit();
      console.log(`Migración ${migrationName} aplicada correctamente.`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
} finally {
  client.close();
}
