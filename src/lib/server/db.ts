import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { env } from "$env/dynamic/private";
import { building } from "$app/environment";
import * as schema from "./schema";
import { resolveDatabasePath } from "./persistence";

// The build only analyses the server code, so it gets a throwaway in-memory database.
export const databasePath = building ? ":memory:" : resolveDatabasePath(env.DATABASE_URL);

const sqlite = new Database(databasePath);
export const db = drizzle(sqlite, { schema, logger: env.DATABASE_LOGGING === "true" });
