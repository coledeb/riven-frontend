// Defaults for DATABASE_URL and AUTH_SECRET, so a missing setting doesn't lose data.
// Without DATABASE_URL, better-sqlite3 opens an in-memory database (every user is gone
// after a restart); without AUTH_SECRET, a new secret on each start logs everyone out.
// No SvelteKit imports: better-auth.config.ts (the better-auth CLI) uses this too.

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const DEFAULT_DATABASE_PATH = "data/riven.db";
const SECRET_FILE = "auth-secret";

function isMemory(path: string): boolean {
    return path === ":memory:" || path.startsWith("file::memory:");
}

/** The SQLite path to open: DATABASE_URL, else data/riven.db under the working directory. */
export function resolveDatabasePath(databaseUrl: string | undefined): string {
    const configured = databaseUrl?.trim();

    if (configured && isMemory(configured)) return configured;

    const path = resolve(configured || DEFAULT_DATABASE_PATH);

    if (!configured) {
        console.warn(
            `DATABASE_URL is not set; using ${path}. Set DATABASE_URL to a path outside ` +
                "the app folder if updates replace that folder (DUMB does)."
        );
    }

    mkdirSync(dirname(path), { recursive: true });
    return path;
}

/**
 * AUTH_SECRET, else a generated secret saved as `auth-secret` next to the database
 * (mode 600) and reused on every start. An in-memory database gets a throwaway secret.
 */
export function resolveAuthSecret(authSecret: string | undefined, databasePath: string): string {
    const configured = authSecret?.trim();

    if (configured) return configured;

    const generated = randomBytes(32).toString("base64url");

    if (isMemory(databasePath)) return generated;

    const file = join(dirname(databasePath), SECRET_FILE);

    if (existsSync(file)) {
        const saved = readFileSync(file, "utf8").trim();

        if (saved) return saved;
    }

    writeFileSync(file, generated + "\n", { mode: 0o600 });
    console.warn(`AUTH_SECRET is not set; generated one and saved it to ${file}.`);
    return generated;
}
