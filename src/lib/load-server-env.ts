/**
 * Load non-VITE_ secrets into process.env for server-only code.
 * Vite's default loadEnv only injects VITE_* — service role would otherwise be missing.
 * Never import this from client-only modules in a way that ships secrets to the browser.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let loaded = false;

export function loadServerEnv(): void {
  if (loaded) return;
  if (typeof window !== "undefined") return;
  if (typeof process === "undefined" || !process.env) return;

  loaded = true;
  const cwd = process.cwd();
  for (const file of [".env", ".env.local", ".env.production", ".env.development"]) {
    const path = resolve(cwd, file);
    if (!existsSync(path)) continue;
    try {
      for (const line of readFileSync(path, "utf8").split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const i = t.indexOf("=");
        if (i < 1) continue;
        const k = t.slice(0, i).trim();
        const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
        // Prefer already-set process env (Vercel / shell), fill gaps from files
        if (!process.env[k]) process.env[k] = v;
      }
    } catch {
      /* ignore unreadable env files */
    }
  }
}
