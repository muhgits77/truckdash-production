/**
 * Supabase client for TruckDash.
 *
 * Set these in your env (Lovable / Vite / .env):
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
 *
 * Truck owners: enable "Use Supabase Sync" in Settings after pasting
 * the SQL from supabase/published_trucks.sql into the Supabase SQL editor.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
const anonKey =
  ((import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined))?.trim() ?? "";

/** True when URL + anon key are present (client can be created). */
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
  if (isSupabaseConfigured()) return "Connected (env keys present)";
  return "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY";
}
