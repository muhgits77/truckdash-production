/**
 * Supabase client for TruckDash — driven only by env vars.
 *
 * Browser (Vite):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY  (Lovable)  or  VITE_SUPABASE_ANON_KEY
 *
 * SSR fallbacks:
 *   SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY
 *
 * Publish target: menu-data/cluckin-chaos/menu.json
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

/**
 * Lovable/new Supabase API keys are opaque strings, not bearer JWTs.
 * Sending them as Authorization: Bearer can break some endpoints.
 */
function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
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

let client: SupabaseClient | null = null;

/**
 * Shared Supabase JS client (browser + SSR).
 * Used by Publish → Storage uploads and Cluckin Chaos reads.
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    console.info("[supabase] creating client", {
      url,
      keyType: isNewSupabaseApiKey(anonKey) ? "publishable" : "anon-jwt",
    });
    client = createClient(url, anonKey, {
      global: {
        fetch: createSupabaseFetch(anonKey),
      },
      auth: {
        persistSession: typeof window !== "undefined",
        autoRefreshToken: true,
        detectSessionInUrl: typeof window !== "undefined",
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
