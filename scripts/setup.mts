#!/usr/bin/env npx tsx
/**
 * TruckDash one-command Supabase setup
 *
 *   npm run setup
 *
 * Reads .env / .env.local, creates storage buckets, verifies Publish path.
 * Minimal config for a new food truck:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY   (server-only — for setup + reliable Publish)
 *   VITE_DEFAULT_TRUCK_ID       (optional, default: cluckin-chaos)
 */
import { readFileSync, existsSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const LOG = "truckdash-setup";

function loadEnvFiles(): void {
  for (const file of [".env", ".env.local"]) {
    const p = resolve(ROOT, file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

function banner(msg: string) {
  console.log(`\n── ${msg} ${"─".repeat(Math.max(0, 52 - msg.length))}`);
}

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}

function warn(msg: string) {
  console.warn(`  ⚠ ${msg}`);
}

function fail(msg: string) {
  console.error(`  ✗ ${msg}`);
}

function info(msg: string) {
  console.log(`  · ${msg}`);
}

loadEnvFiles();

const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(
  /\/+$/,
  "",
);
const anonKey = (
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  ""
).trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const truckId = (
  process.env.VITE_DEFAULT_TRUCK_ID ||
  "cluckin-chaos"
).trim() || "cluckin-chaos";

const BUCKETS = [
  {
    id: "menu-data",
    public: true,
    file_size_limit: 5_242_880,
    allowed_mime_types: ["application/json", "application/octet-stream", "text/plain"],
  },
  {
    id: "menu-images",
    public: true,
    file_size_limit: 10_485_760,
    allowed_mime_types: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/jpg",
    ],
  },
] as const;

function headers(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function ensureEnvExample(): void {
  const example = resolve(ROOT, ".env.example");
  const envPath = resolve(ROOT, ".env");
  if (!existsSync(envPath) && existsSync(example)) {
    copyFileSync(example, envPath);
    ok("Created .env from .env.example — fill in your Supabase keys");
  }
}

async function ensureBucket(spec: (typeof BUCKETS)[number], adminKey: string): Promise<boolean> {
  const create = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: headers(adminKey),
    body: JSON.stringify({
      id: spec.id,
      name: spec.id,
      public: spec.public,
      file_size_limit: spec.file_size_limit,
      allowed_mime_types: spec.allowed_mime_types,
    }),
  });
  const body = await create.text();
  if (create.ok || create.status === 201) {
    ok(`Created bucket ${spec.id}`);
    return true;
  }
  if (create.status === 409 || /already exists|duplicate/i.test(body)) {
    const put = await fetch(`${url}/storage/v1/bucket/${spec.id}`, {
      method: "PUT",
      headers: headers(adminKey),
      body: JSON.stringify({
        public: true,
        file_size_limit: spec.file_size_limit,
        allowed_mime_types: spec.allowed_mime_types,
      }),
    });
    ok(`Bucket ${spec.id} ready (update ${put.status})`);
    return true;
  }
  fail(`Bucket ${spec.id}: ${create.status} ${body.slice(0, 160)}`);
  return false;
}

async function probeUpload(key: string, label: string): Promise<boolean> {
  const path = `${truckId}/menu.json`;
  const payload = JSON.stringify(
    {
      truckId,
      truckName: "Setup probe",
      phone: "",
      orderUrl: "",
      location: "",
      hoursStart: "",
      hoursEnd: "",
      special: `setup ${new Date().toISOString()}`,
      menu: [{ id: "setup", name: "Ready", price: "0" }],
      schedule: [],
      lastPublished: new Date().toISOString(),
      version: 1,
    },
    null,
    2,
  );

  const res = await fetch(`${url}/storage/v1/object/menu-data/${path}`, {
    method: "POST",
    headers: {
      ...headers(key),
      "Content-Type": "application/json",
      "x-upsert": "true",
      "cache-control": "30",
    },
    body: payload,
  });
  const text = await res.text();
  if (!res.ok) {
    fail(`${label} upload failed (${res.status}): ${text.slice(0, 200)}`);
    return false;
  }
  ok(`${label} can write menu-data/${path}`);
  return true;
}

async function probePublic(): Promise<boolean> {
  const publicUrl = `${url}/storage/v1/object/public/menu-data/${truckId}/menu.json?t=${Date.now()}`;
  const res = await fetch(publicUrl, { cache: "no-store" });
  if (!res.ok) {
    fail(`Public URL not readable (${res.status}): ${publicUrl}`);
    return false;
  }
  ok(`Public website can read menu-data/${truckId}/menu.json`);
  info(publicUrl.replace(/\?t=.*/, ""));
  return true;
}

function printSqlHelp(): void {
  console.log(`
  Open Supabase Dashboard → SQL Editor → paste & Run:

    supabase/storage_buckets.sql

  That creates public buckets + RLS so Publish works with the anon key too.
`);
}

function printNextSteps(opts: { serviceOk: boolean; anonOk: boolean }): void {
  banner("Next steps");
  info("1. npm run dev");
  info("2. Open the app → Publish Updates to My Website");
  info(`3. Public site: /website?truck=${truckId}`);
  info(`4. Live menu JSON: ${url}/storage/v1/object/public/menu-data/${truckId}/menu.json`);
  console.log("");
  info("Vercel: set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY");
  info("        (service role: server-only, no VITE_ prefix)");
  if (!opts.anonOk && opts.serviceOk) {
    warn("Anon write still blocked by RLS — server Publish still works with service role.");
    warn("Optional: run supabase/storage_buckets.sql for pure client writes.");
  }
  console.log("");
}

async function main() {
  console.log(`\n${LOG} · plug-and-play Supabase setup for TruckDash\n`);

  ensureEnvExample();

  banner("1. Check env");
  if (!url || !url.startsWith("http")) {
    fail("Missing VITE_SUPABASE_URL");
    info("Copy .env.example → .env and paste Project Settings → API values");
    process.exit(1);
  }
  ok(`URL  ${url}`);

  if (!anonKey) {
    fail("Missing VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)");
    process.exit(1);
  }
  ok(
    `Anon ${anonKey.startsWith("sb_publishable_") ? "publishable key" : "JWT"} (${anonKey.length} chars)`,
  );

  if (!serviceKey) {
    warn("SUPABASE_SERVICE_ROLE_KEY missing — bucket create + reliable Publish need it");
    info("Dashboard → Project Settings → API → service_role (secret) → paste into .env");
  } else {
    ok("Service role present (server-only)");
  }
  ok(`Truck id: ${truckId} → menu-data/${truckId}/menu.json`);

  const adminKey = serviceKey || anonKey;

  banner("2. Storage buckets");
  if (!serviceKey) {
    warn("Skipping create without service role — run SQL instead:");
    printSqlHelp();
  } else {
    let bucketsOk = true;
    for (const b of BUCKETS) {
      if (!(await ensureBucket(b, adminKey))) bucketsOk = false;
    }
    if (!bucketsOk) {
      fail("Could not create buckets. Run supabase/storage_buckets.sql in SQL Editor.");
      printSqlHelp();
      process.exit(1);
    }
  }

  banner("3. Publish probe");
  let serviceOk = false;
  let anonOk = false;

  if (serviceKey) {
    serviceOk = await probeUpload(serviceKey, "service_role");
    if (!serviceOk) {
      fail("Service-role write failed — check project URL/key match");
      process.exit(1);
    }
  }

  anonOk = await probeUpload(anonKey, "anon");
  if (!anonOk && !serviceOk) {
    fail("Neither service role nor anon can upload.");
    printSqlHelp();
    process.exit(1);
  }

  const publicOk = await probePublic();
  if (!publicOk) {
    warn("Set storage.buckets.public = true (storage_buckets.sql does this)");
  }

  // Write a tiny status file for humans (not secrets)
  try {
    writeFileSync(
      resolve(ROOT, ".truckdash-setup.json"),
      JSON.stringify(
        {
          ok: serviceOk || anonOk,
          url,
          truckId,
          path: `menu-data/${truckId}/menu.json`,
          publicUrl: `${url}/storage/v1/object/public/menu-data/${truckId}/menu.json`,
          serviceRoleWrite: serviceOk,
          anonWrite: anonOk,
          publicRead: publicOk,
          checkedAt: new Date().toISOString(),
        },
        null,
        2,
      ) + "\n",
    );
    ok("Wrote .truckdash-setup.json (status only, no secrets)");
  } catch {
    /* ignore */
  }

  banner(serviceOk || anonOk ? "Setup complete" : "Setup incomplete");
  if (serviceOk || anonOk) {
    ok("Publish is ready — run npm run dev and tap Publish");
  }
  printNextSteps({ serviceOk, anonOk });

  if (!(serviceOk || anonOk) || !publicOk) process.exit(1);
}

main().catch((e) => {
  console.error(LOG, e);
  process.exit(1);
});
