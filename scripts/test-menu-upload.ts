/**
 * Live test: upload menu.json to menu-data/{truckId}/menu.json
 * Usage: npx tsx scripts/test-menu-upload.ts [truckId]
 *
 * Requires .env / .env.local with:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY
 * Optional: TEST_OWNER_EMAIL / TEST_OWNER_PASSWORD for authenticated upload
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const LOG = "[test-menu-upload]";

function loadEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of [".env", ".env.local"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
      out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

const env = { ...loadEnvLocal(), ...process.env };
const url = (env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const anonKey =
  env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || "";
const email = env.TEST_OWNER_EMAIL || "";
const password = env.TEST_OWNER_PASSWORD || "";
const truckId = (process.argv[2] || env.VITE_DEFAULT_TRUCK_ID || "cluckin-chaos").trim();

if (!url || !anonKey) {
  console.error(LOG, "Missing VITE_SUPABASE_URL or publishable/anon key in .env");
  process.exit(1);
}

const bucket = "menu-data";
const path = `${truckId}/menu.json`;
const fullPath = `${bucket}/${path}`;
const publicUrl = `${url}/storage/v1/object/public/${fullPath}`;

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers as HeadersInit);
    if (
      supabaseKey.startsWith("sb_publishable_") &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

async function main() {
  console.info(LOG, "═══ START ═══", { fullPath, publicUrl, url });

  const supabase = createClient(url, anonKey, {
    global: { fetch: createSupabaseFetch(anonKey) },
  });

  if (email && password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error(LOG, "sign-in FAILED", error.message);
      process.exit(1);
    }
    console.info(LOG, "signed in", email);
  } else {
    console.info(LOG, "no owner credentials — using publishable/anon key (needs storage RLS)");
  }

  const payload = {
    truckId,
    truckName: "Cluckin Chaos",
    phone: "",
    orderUrl: "",
    location: "test",
    hoursStart: "5pm",
    hoursEnd: "9pm",
    special: "test special",
    menu: [{ id: "test-1", name: "Test Item", price: "9.99" }],
    schedule: [
      {
        id: "d1",
        day: "FRI",
        neighborhood: "Russell Springs",
        spot: "Food Truck Friday",
        hoursStart: "5pm",
        hoursEnd: "9pm",
        closed: false,
        note: "",
      },
    ],
    lastPublished: new Date().toISOString(),
    version: 1,
  };

  const body = JSON.stringify(payload, null, 2);
  const blob = new Blob([body], { type: "application/json" });

  const { data, error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: "application/json",
    cacheControl: "30",
    upsert: true,
  });

  if (error) {
    console.error(LOG, "upload FAILED", error.message);
    process.exit(1);
  }

  console.info(LOG, "✓ upload OK", data);

  const { data: listed, error: listErr } = await supabase.storage.from(bucket).list(truckId, {
    search: "menu.json",
  });
  console.info(LOG, "bucket list", {
    listed: listed?.map((f) => f.name),
    listErr: listErr?.message,
  });

  const bust = `${publicUrl}?t=${Date.now()}`;
  const res = await fetch(bust, { cache: "no-store" });
  console.info(LOG, "public verify", { status: res.status, ok: res.ok, bust });

  if (res.ok) {
    const json = await res.json();
    console.info(LOG, "═══ SUCCESS (public) ═══", {
      fullPath,
      publicUrl,
      menuItems: json.menu?.length,
      scheduleDays: json.schedule?.length,
    });
    return;
  }

  // Fallback: authenticated download
  const dl = await supabase.storage.from(bucket).download(path);
  if (dl.error || !dl.data) {
    console.error(LOG, "auth download also FAILED", dl.error?.message);
    process.exit(1);
  }
  const json = JSON.parse(await dl.data.text());
  console.warn(LOG, "═══ SUCCESS (auth only — bucket not public yet) ═══", {
    fullPath,
    publicUrl,
    menuItems: json.menu?.length,
    scheduleDays: json.schedule?.length,
    hint: "Run supabase/storage_buckets.sql or migration 20260709020000 to set public=true",
  });
}

main().catch((err) => {
  console.error(LOG, "exception", err);
  process.exit(1);
});
