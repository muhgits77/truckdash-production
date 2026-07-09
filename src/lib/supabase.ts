/**
 * Supabase client for TruckDash — driven only by env vars.
 *
 * Browser (Vite / Vercel):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY  (or VITE_SUPABASE_PUBLISHABLE_KEY)
 *
 * SSR fallbacks:
 *   SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY
 *
 * Publish target: menu-data/cluckin-chaos/menu.json
 *
 * Auth / Storage:
 *   Storage OpenAPI requires the `authorization` header on every request.
 *   Missing it → 400 "headers must have required property 'authorization'".
 *
 *   Always send:
 *     Authorization: Bearer <session JWT | anon key>
 *     apikey: <anon key>
 *
 * Fresh project one-time setup:
 *   Run supabase/storage_buckets.sql (or scripts/setup-storage.mts with service role).
 */

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

const LOG = "[supabase]";

function readEnv(name: string): string {
  const fromVite =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env[name] as string | undefined)
      : undefined;
  const fromProcess =
    typeof process !== "undefined" && process.env ? process.env[name] : undefined;
  return (fromVite ?? fromProcess ?? "").trim();
}

const url = (
  readEnv("VITE_SUPABASE_URL") ||
  readEnv("SUPABASE_URL")
).replace(/\/+$/, "");

const anonKey =
  readEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ||
  readEnv("VITE_SUPABASE_ANON_KEY") ||
  readEnv("SUPABASE_PUBLISHABLE_KEY") ||
  readEnv("SUPABASE_ANON_KEY");

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function isLikelyJwt(token: string): boolean {
  return token.split(".").length === 3;
}

/** Extract non-empty bearer token from Authorization header value. */
function bareBearerToken(authorization: string | null): string {
  if (!authorization) return "";
  return authorization.replace(/^Bearer\s+/i, "").trim();
}

function describeAuthHeader(value: string | null, apiKey: string): string {
  if (!value) return "missing";
  const bare = bareBearerToken(value);
  if (!bare) return "Bearer empty";
  if (bare === apiKey) {
    return isNewSupabaseApiKey(apiKey) ? "Bearer publishable-key" : "Bearer api-key";
  }
  if (isLikelyJwt(bare)) return "Bearer JWT";
  return "Bearer other";
}

/**
 * Custom fetch that GUARANTEES Authorization on every request.
 *
 * Critical for Storage: OpenAPI rejects requests without `authorization`.
 * Never leave Authorization empty — always fall back to the project anon key.
 */
function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    // Always build a fresh Headers bag so nothing can leave Authorization out.
    const headers = new Headers();

    // Copy Request headers first (if input is a Request)
    if (typeof Request !== "undefined" && input instanceof Request) {
      input.headers.forEach((value, key) => {
        headers.set(key, value);
      });
    }

    // Overlay init headers (may be Headers, object, or array)
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => {
        headers.set(key, value);
      });
    }

    const authBefore = headers.get("Authorization");
    const bare = bareBearerToken(authBefore);

    // Replace missing OR empty Bearer tokens with the project key.
    // Keep real session JWTs and non-empty tokens as-is.
    if (!bare) {
      headers.set("Authorization", `Bearer ${supabaseKey}`);
    }

    // Always set apikey (required by Supabase gateway)
    headers.set("apikey", supabaseKey);

    // Final hard guarantee for Storage + Auth endpoints
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : String(input);
    const finalBare = bareBearerToken(headers.get("Authorization"));
    if (!finalBare) {
      headers.set("Authorization", `Bearer ${supabaseKey}`);
    }

    if (urlStr.includes("/storage/") || urlStr.includes("/auth/v1/")) {
      const method =
        init?.method || (input instanceof Request ? input.method : "GET");
      console.info(LOG, "fetch", {
        method,
        path: urlStr.replace(url, ""),
        authorization: describeAuthHeader(headers.get("Authorization"), supabaseKey),
        authorizationWas: describeAuthHeader(authBefore, supabaseKey),
        hasApikey: Boolean(headers.get("apikey")),
      });
    }

    // Prefer URL string so Request body/header edge cases cannot drop Authorization
    const requestUrl =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : String(input);

    return fetch(requestUrl, {
      ...init,
      // If input was a Request, preserve method/body when init omits them
      method:
        init?.method ??
        (input instanceof Request ? input.method : undefined),
      body:
        init?.body !== undefined
          ? init.body
          : input instanceof Request
            ? input.body
            : undefined,
      // duplex required when reusing a Request stream body in some runtimes
      ...(input instanceof Request && input.body && init?.body === undefined
        ? { duplex: "half" as const }
        : {}),
      headers,
    } as RequestInit);
  };
}

/** True when URL + key are present (client can be created). */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey && url.startsWith("http"));
}

export function getSupabaseUrl(): string {
  return url;
}

export function getSupabaseAnonKey(): string {
  return anonKey;
}

export function isPublishableApiKey(): boolean {
  return isNewSupabaseApiKey(anonKey);
}

export type AuthStatus = {
  configured: boolean;
  signedIn: boolean;
  email: string | null;
  userId: string | null;
  /** true when access_token looks like a JWT (3 segments) */
  hasJwt: boolean;
  /** access_token or null */
  accessToken: string | null;
  expiresAt: number | null;
  tokenKind: "session-jwt" | "none";
  keyType: "publishable" | "anon-jwt" | "missing";
};

export async function getAuthStatus(): Promise<AuthStatus> {
  const base: AuthStatus = {
    configured: isSupabaseConfigured(),
    signedIn: false,
    email: null,
    userId: null,
    hasJwt: false,
    accessToken: null,
    expiresAt: null,
    tokenKind: "none",
    keyType: !anonKey ? "missing" : isNewSupabaseApiKey(anonKey) ? "publishable" : "anon-jwt",
  };

  const supabase = getSupabase();
  if (!supabase) return base;

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn(LOG, "getSession error", error.message);
    return base;
  }

  const session = data.session;
  if (!session?.access_token?.trim()) return base;

  return {
    ...base,
    signedIn: true,
    email: session.user?.email ?? null,
    userId: session.user?.id ?? null,
    hasJwt: isLikelyJwt(session.access_token),
    accessToken: session.access_token,
    expiresAt: session.expires_at ?? null,
    tokenKind: "session-jwt",
  };
}

/**
 * Server-only service role (never VITE_* — must not ship to the browser).
 * Used for Storage writes that bypass RLS when anon INSERT policies are missing.
 */
export function getServiceRoleKey(): string {
  if (typeof window !== "undefined") return "";
  if (typeof process === "undefined" || !process.env) return "";
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

/**
 * Best Authorization bearer token for Storage:
 *   1. Server service role (Node/SSR only — bypasses RLS)
 *   2. Active user session access_token (JWT) when signed in
 *   3. Publishable/anon key (never empty)
 */
export async function getAccessTokenForStorage(): Promise<{
  token: string;
  kind: "service-role" | "session-jwt" | "api-key";
  email: string | null;
}> {
  const service = getServiceRoleKey();
  if (service) {
    return { token: service, kind: "service-role", email: null };
  }

  // Prefer a fresh session JWT when available
  await ensureFreshSession();
  const status = await getAuthStatus();

  if (status.accessToken?.trim() && status.hasJwt) {
    return {
      token: status.accessToken.trim(),
      kind: "session-jwt",
      email: status.email,
    };
  }

  if (!anonKey?.trim()) {
    throw new Error(
      "No Supabase API key available for Authorization header. Set VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY.",
    );
  }

  return { token: anonKey.trim(), kind: "api-key", email: null };
}

/** Build the exact headers Storage requires (never omit Authorization). */
export async function getStorageAuthHeaders(): Promise<Record<string, string>> {
  const publicKey = getSupabaseAnonKey();
  if (!publicKey && !getServiceRoleKey()) {
    throw new Error("Missing Supabase API key");
  }

  const { token, kind, email } = await getAccessTokenForStorage();
  const bearer = token.trim() || publicKey;
  // Gateway apikey: use service role when that is the bearer, else public anon key
  const apikey = kind === "service-role" ? bearer : publicKey || bearer;

  if (!bearer) {
    throw new Error("Cannot build Storage Authorization header: empty token");
  }

  const headers = {
    apikey,
    Authorization: `Bearer ${bearer}`,
  };

  console.info(LOG, "storage auth headers ready", {
    authKind: kind,
    email,
    authorization: describeAuthHeader(headers.Authorization, publicKey || bearer),
    hasApikey: true,
  });

  return headers;
}

/** Refresh session if present so uploads use a fresh JWT. */
export async function ensureFreshSession(): Promise<Session | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: current, error: getErr } = await supabase.auth.getSession();
  if (getErr) {
    console.warn(LOG, "ensureFreshSession getSession failed", getErr.message);
    return null;
  }

  const session = current.session;
  if (!session?.access_token) {
    console.info(LOG, "ensureFreshSession: no session (using API key Authorization)");
    return null;
  }

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  const skewMs = 60_000;
  if (expiresAtMs && expiresAtMs - Date.now() > skewMs) {
    console.info(LOG, "ensureFreshSession: session still valid", {
      email: session.user?.email,
      expiresInSec: Math.round((expiresAtMs - Date.now()) / 1000),
    });
    return session;
  }

  console.info(LOG, "ensureFreshSession: refreshing near-expiry session", {
    email: session.user?.email,
  });
  const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
  if (refreshErr) {
    console.warn(LOG, "ensureFreshSession refresh failed", refreshErr.message);
    // Session may still be usable briefly
    return session;
  }
  console.info(LOG, "ensureFreshSession: refreshed OK", {
    email: refreshed.session?.user?.email,
  });
  return refreshed.session ?? session;
}

let client: SupabaseClient | null = null;

/**
 * Shared Supabase JS client (browser + SSR).
 * Session is persisted in localStorage so owner sign-in survives reloads.
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    const inBrowser = typeof window !== "undefined";
    console.info(LOG, "creating client", {
      url,
      keyType: isNewSupabaseApiKey(anonKey) ? "publishable" : "anon-jwt",
      persistSession: inBrowser,
    });
    client = createClient(url, anonKey, {
      global: {
        fetch: createSupabaseFetch(anonKey),
        // Default Authorization so Storage never sees a missing header.
        // Session JWT is overlaid by supabase-js fetchWithAuth when signed in.
        headers: {
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
      },
      auth: {
        storage: inBrowser ? localStorage : undefined,
        persistSession: inBrowser,
        autoRefreshToken: inBrowser,
        detectSessionInUrl: inBrowser,
        flowType: "pkce",
      },
    });
  }
  return client;
}

export function getSupabaseConfigHint(): string {
  if (isSupabaseConfigured()) {
    return `Connected → ${url.replace(/^https?:\/\//, "")}`;
  }
  return "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_ANON_KEY";
}
