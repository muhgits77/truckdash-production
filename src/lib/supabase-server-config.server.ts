/**
 * Server-only Supabase config (service role + URL).
 *
 * File suffix `.server.ts` keeps this out of the client bundle.
 * Reads process.env first, then falls back to parsing .env on disk so
 * Vite/Nitro still work when only VITE_* were auto-injected.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type ServerSupabaseConfig = {
  url: string;
  key: string;
  keyKind: "service_role" | "anon";
};

function parseEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(filePath)) return out;
  try {
    for (const line of readFileSync(filePath, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      if (k && v) out[k] = v;
    }
  } catch {
    /* ignore */
  }
  return out;
}

function fileEnv(name: string): string {
  // Prefer cwd; also try one level up (some hosts run from .output)
  const roots = [process.cwd()];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    if (typeof import.meta !== "undefined" && (import.meta as { dirname?: string }).dirname) {
      roots.push(resolve((import.meta as { dirname: string }).dirname, "../.."));
    }
  } catch {
    /* ignore */
  }
  for (const root of roots) {
    for (const file of [".env", ".env.local", ".env.production", ".env.development"]) {
      const map = parseEnvFile(resolve(root, file));
      if (map[name]?.trim()) return map[name].trim();
    }
  }
  return "";
}

function env(name: string): string {
  // Bracket access — avoids some bundlers rewriting process.env.FOO → undefined
  const fromProcess =
    (typeof process !== "undefined" && process.env && process.env[name]?.trim()) || "";
  if (fromProcess) return fromProcess;
  return fileEnv(name);
}

/**
 * Resolve URL + key for Storage writes on the server.
 * Prefer service_role (bypasses RLS). Fall back to anon only if missing.
 */
export function getServerSupabaseConfig(): ServerSupabaseConfig {
  const url = (env("VITE_SUPABASE_URL") || env("SUPABASE_URL")).replace(/\/+$/, "");
  const service = env("SUPABASE_SERVICE_ROLE_KEY");
  const anon =
    env("VITE_SUPABASE_ANON_KEY") ||
    env("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    env("SUPABASE_ANON_KEY") ||
    env("SUPABASE_PUBLISHABLE_KEY");

  if (!url || !url.startsWith("http")) {
    throw new Error(
      "Server missing VITE_SUPABASE_URL. Add it to .env and restart the dev server.",
    );
  }

  if (service) {
    return { url, key: service, keyKind: "service_role" };
  }

  if (!anon) {
    throw new Error(
      "Server missing SUPABASE_SERVICE_ROLE_KEY (preferred) and anon key. " +
        "Add SUPABASE_SERVICE_ROLE_KEY to .env (no VITE_ prefix) and restart.",
    );
  }

  console.warn(
    "[supabase-server-config] SUPABASE_SERVICE_ROLE_KEY not found — using anon (RLS may block writes). " +
      "Set it in .env and restart npm run dev / redeploy Vercel.",
  );
  return { url, key: anon, keyKind: "anon" };
}
