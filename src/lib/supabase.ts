/**
 * Supabase client for TruckDash.
 *
 * Lovable Cloud / Vite env (any of these key names work):
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   (Lovable)
 *   VITE_SUPABASE_ANON_KEY=eyJ...                      (classic anon JWT)
 *
 * Default truck slug for Cluckin Chaos: cluckin-chaos
 * → menu-data/cluckin-chaos/menu.json
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
const anonKey =
  (
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
  )?.trim() ?? "";

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
  return url.replace(/\/+$/, "");
}

export function getSupabaseAnonKey(): string {
  return anonKey;
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      global: {
        fetch: createSupabaseFetch(anonKey),
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

export function getSupabaseConfigHint(): string {
  if (isSupabaseConfigured()) {
    return `Connected → ${getSupabaseUrl().replace(/^https?:\/\//, "")}`;
  }
  return "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY";
}
