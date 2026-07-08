/**
 * Live test: upload menu.json to menu-data/{truckId}/menu.json
 * Usage: npx tsx scripts/test-menu-upload.ts [truckId]
 * Requires .env.local with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 * and TEST_OWNER_EMAIL / TEST_OWNER_PASSWORD for authenticated upload.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const LOG = "[test-menu-upload]";

function loadEnvLocal(): Record<string, string> {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...loadEnvLocal(), ...process.env };
const url = (env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const anonKey = env.VITE_SUPABASE_ANON_KEY || "";
const email = env.TEST_OWNER_EMAIL || "";
const password = env.TEST_OWNER_PASSWORD || "";
const truckId = (process.argv[2] || env.VITE_DEFAULT_TRUCK_ID || "cluckin-chaos").trim();

if (!url || !anonKey) {
  console.error(LOG, "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const bucket = "menu-data";
const path = `${truckId}/menu.json`;
const fullPath = `${bucket}/${path}`;
const publicUrl = `${url}/storage/v1/object/public/${fullPath}`;

async function main() {
  console.info(LOG, "start", { fullPath, publicUrl });

  const supabase = createClient(url, anonKey);

  if (email && password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error(LOG, "sign-in FAILED", error.message);
      process.exit(1);
    }
    console.info(LOG, "signed in", email);
  } else {
    console.warn(LOG, "no TEST_OWNER_EMAIL/PASSWORD — upload will fail without auth");
  }

  const payload = {
    truckId,
    truckName: "Upload Test",
    phone: "",
    orderUrl: "",
    location: "test",
    hoursStart: "5pm",
    hoursEnd: "9pm",
    special: "test special",
    menu: [{ id: "test-1", name: "Test Item", price: "9.99" }],
    schedule: [],
    lastPublished: new Date().toISOString(),
    version: 1,
  };

  const body = JSON.stringify(payload, null, 2);
  const blob = new Blob([body], { type: "application/json" });

  await supabase.storage.from(bucket).remove([path]).catch(() => {});

  const { data, error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: "application/json",
    upsert: true,
  });

  if (error) {
    console.error(LOG, "upload FAILED", error.message);
    process.exit(1);
  }

  console.info(LOG, "upload OK", data);

  const { data: listed, error: listErr } = await supabase.storage.from(bucket).list(truckId, {
    search: "menu.json",
  });
  console.info(LOG, "bucket list", { listed: listed?.map((f) => f.name), listErr: listErr?.message });

  const res = await fetch(`${publicUrl}?t=${Date.now()}`, { cache: "no-store" });
  console.info(LOG, "public verify", { status: res.status, ok: res.ok });
  if (!res.ok) process.exit(1);

  const json = await res.json();
  console.info(LOG, "SUCCESS", { fullPath, menuItems: json.menu?.length });
}

main().catch((err) => {
  console.error(LOG, "exception", err);
  process.exit(1);
});