import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { appSettings } from "./schema";

type Database = LibSQLDatabase<typeof schema>;

const globalForDb = globalThis as typeof globalThis & {
  tursoClient?: Client;
  drizzleDb?: Database;
};

function getClient(): Client {
  if (globalForDb.tursoClient) return globalForDb.tursoClient;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL is not configured");
  globalForDb.tursoClient = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return globalForDb.tursoClient;
}

export function getDatabase(): Database {
  if (!globalForDb.drizzleDb) {
    globalForDb.drizzleDb = drizzle(getClient(), { schema });
  }
  return globalForDb.drizzleDb;
}

export async function getAppSettings(): Promise<Record<string, string>> {
  const rows = await getDatabase()
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings);
  return Object.fromEntries(rows.map((item) => [item.key, item.value]));
}

export function getClientForTransaction(): Client {
  return getClient();
}
