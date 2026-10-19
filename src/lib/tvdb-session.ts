import { createCustomFetch } from "$lib/custom-fetch";
import { createScopedLogger } from "$lib/logger";

// TVDB login token, shared by the whole server and used by `providers.tvdb` through
// `tvdbFetch`. A TVDB outage only degrades TVDB data: a failed login waits a minute
// before retrying, and requests go out without a token instead of failing the page.

const logger = createScopedLogger("tvdb-session");

const TVDB_API_KEY = "6be85335-5c4f-4d8d-b945-d3ed0eb8cdce";
const TVDB_LOGIN_URL = "https://api4.thetvdb.com/v4/login";
const LOGIN_RETRY_DELAY_MS = 60 * 1000;

const baseFetch = createCustomFetch();

let cachedToken: string | null = null;
let loginRetryAfter = 0;
// Concurrent callers share one login request.
let inflight: Promise<string | null> | null = null;

async function login(): Promise<string | null> {
    try {
        const res = await baseFetch(TVDB_LOGIN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apikey: TVDB_API_KEY })
        });

        if (!res.ok) {
            logger.warn(`TVDB login returned HTTP ${res.status}`);
            return null;
        }

        const json = (await res.json()) as { data?: { token?: string } };
        return json.data?.token ?? null;
    } catch (e) {
        logger.warn(`TVDB login failed: ${e instanceof Error ? e.message : String(e)}`);
        return null;
    }
}

/** The cached TVDB token, logging in if needed; null while TVDB is unavailable. */
export async function getTvdbToken(force = false): Promise<string | null> {
    if (!force && cachedToken) return cachedToken;
    if (Date.now() < loginRetryAfter) return null;
    if (inflight) return inflight;

    inflight = (async () => {
        try {
            const token = await login();
            if (token) {
                cachedToken = token;
                logger.info("Logged in to TVDB");
            } else {
                loginRetryAfter = Date.now() + LOGIN_RETRY_DELAY_MS;
            }
            return token;
        } finally {
            inflight = null;
        }
    })();

    return inflight;
}

/** Fetch for the TVDB client: adds the token, and logs in again once on a 401. */
export async function tvdbFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    if (url.endsWith("/login")) return baseFetch(input, init);

    const send = (token: string | null) => {
        // openapi-fetch passes a Request, so keep its headers
        const headers = new Headers(
            init?.headers ?? (input instanceof Request ? input.headers : undefined)
        );
        if (token && !headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${token}`);
        }
        return baseFetch(input, { ...init, headers });
    };

    let token = await getTvdbToken();
    let response = await send(token);

    if (response.status === 401 && token) {
        cachedToken = null;
        token = await getTvdbToken(true);
        if (token) response = await send(token);
    }

    return response;
}
