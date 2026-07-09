/**
 * Bootstrap Storage for your Supabase project (Vercel / non-Lovable).
 *
 * 1) Creates public buckets menu-data + menu-images (needs service role)
 * 2) Applies RLS for anon INSERT/UPDATE/SELECT when DATABASE_URL is set
 * 3) Verifies service-role write + public read + (if policies applied) anon write
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... npx tsx scripts/setup-storage.mts
 *
 * For anon-key browser Publish without a server, also run:
 *   supabase/storage_buckets.sql  in Dashboard → SQL Editor
 *   (or set DATABASE_URL so this script can apply it)
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

for (const file of [".env", ".env.local"]) {
  const p = resolve(process.cwd(), file);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!(k in process.env) || !process.env[k]) process.env[k] = v;
  }
}

const LOG = "[setup-storage]";
const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(
  /\/+$/,
  "",
);
const anonKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "";
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!url || !anonKey) {
  console.error(LOG, "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const adminKey = serviceKey || anonKey;
const usingService = Boolean(serviceKey);

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
    allowed_mime_types: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/jpg"],
  },
] as const;

function headers(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function createBucket(spec: (typeof BUCKETS)[number]): Promise<boolean> {
  const res = await fetch(`${url}/storage/v1/bucket`, {
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
  const body = await res.text();
  if (res.ok || res.status === 200 || res.status === 201) {
    console.info(LOG, `✓ created bucket ${spec.id}`);
    return true;
  }
  if (res.status === 409 || /already exists|duplicate/i.test(body)) {
    // Ensure public + limits
    const put = await fetch(`${url}/storage/v1/bucket/${spec.id}`, {
      method: "PUT",
      headers: headers(adminKey),
      body: JSON.stringify({
        public: true,
        file_size_limit: spec.file_size_limit,
        allowed_mime_types: spec.allowed_mime_types,
      }),
    });
    console.info(LOG, `✓ bucket ${spec.id} already exists (update ${put.status})`);
    return true;
  }
  console.error(LOG, `✗ create ${spec.id} failed`, res.status, body.slice(0, 300));
  return false;
}

/** RLS policies from storage_buckets.sql — applied when DATABASE_URL is set. */
async function tryApplyRlsViaDatabaseUrl(): Promise<boolean> {
  const dbUrl = (process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || "").trim();
  if (!dbUrl) {
    console.info(LOG, "No DATABASE_URL — skip automatic RLS apply (use SQL Editor)");
    return false;
  }

  try {
    const postgres = (await import("postgres")).default;
    const sql = postgres(dbUrl, { max: 1, connect_timeout: 10 });
    const file = resolve(process.cwd(), "supabase/storage_buckets.sql");
    const text = readFileSync(file, "utf8");
    // Strip pure comment lines; postgres.js can run multi-statement if we split carefully
    await sql.unsafe(text);
    await sql.end({ timeout: 5 });
    console.info(LOG, "✓ applied storage_buckets.sql via DATABASE_URL");
    return true;
  } catch (e) {
    console.warn(LOG, "DATABASE_URL RLS apply failed", e instanceof Error ? e.message : e);
    return false;
  }
}

async function uploadWith(key: string, label: string): Promise<boolean> {
  const path = "cluckin-chaos/menu.json";
  const payload = JSON.stringify({
    truckId: "cluckin-chaos",
    special: `setup-storage ${label} ${new Date().toISOString()}`,
    menu: [{ id: "setup", name: "Setup OK", price: "0" }],
    schedule: [],
    lastPublished: new Date().toISOString(),
    version: 1,
  });
  const res = await fetch(`${url}/storage/v1/object/menu-data/${path}`, {
    method: "POST",
    headers: {
      ...headers(key),
      "Content-Type": "application/json",
      "x-upsert": "true",
    },
    body: payload,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(LOG, `✗ ${label} upload FAILED`, res.status, text.slice(0, 300));
    return false;
  }
  console.info(LOG, `✓ ${label} upload works`);
  return true;
}

async function verifyPublic(): Promise<boolean> {
  const pub = await fetch(
    `${url}/storage/v1/object/public/menu-data/cluckin-chaos/menu.json?t=${Date.now()}`,
    { cache: "no-store" },
  );
  console.info(LOG, "public read", { status: pub.status, ok: pub.ok });
  if (!pub.ok) {
    console.warn(LOG, "Public URL failed — ensure bucket public=true");
    return false;
  }
  return true;
}

async function main() {
  console.info(LOG, "═══ START ═══", {
    url,
    usingServiceRole: usingService,
    keyType: anonKey.startsWith("sb_") ? "sb_*" : "jwt-anon",
  });

  if (!usingService) {
    console.warn(
      LOG,
      "No SUPABASE_SERVICE_ROLE_KEY — bucket create / admin update may fail.",
    );
  }

  let allOk = true;
  for (const b of BUCKETS) {
    const ok = await createBucket(b);
    if (!ok) allOk = false;
  }

  if (!allOk && !usingService) {
    console.error(LOG, "");
    console.error(LOG, "Bucket create blocked without service role.");
    console.error(LOG, "  Set SUPABASE_SERVICE_ROLE_KEY and re-run, OR");
    console.error(LOG, "  Dashboard → SQL Editor → run supabase/storage_buckets.sql");
    process.exit(1);
  }

  await tryApplyRlsViaDatabaseUrl();

  // Service role must always be able to write
  if (usingService) {
    const svcOk = await uploadWith(serviceKey, "service_role");
    if (!svcOk) process.exit(1);
  }

  const publicOk = await verifyPublic();
  if (!publicOk) process.exit(1);

  // Anon write — required for pure-client Publish without server fn
  const anonOk = await uploadWith(anonKey, "anon");
  if (!anonOk) {
    console.warn(LOG, "");
    console.warn(LOG, "Anon INSERT still blocked by RLS (expected until policies are applied).");
    console.warn(LOG, "Do ONE of:");
    console.warn(LOG, "  1) Dashboard → SQL Editor → paste supabase/storage_buckets.sql → Run");
    console.warn(LOG, "  2) Set DATABASE_URL (postgres connection string) and re-run this script");
    console.warn(LOG, "  3) Keep SUPABASE_SERVICE_ROLE_KEY on the server — app Publish uses server upload");
    console.warn(LOG, "");
    console.warn(LOG, "Service-role write + public read are OK. App can Publish via server path.");
    // Not a hard failure if service role works — app uses serverUploadStorageObject
    if (!usingService) process.exit(1);
  } else {
    console.info(LOG, "═══ SUCCESS ═══ anon Publish + public read ready");
  }

  if (anonOk) {
    console.info(LOG, "═══ FULL SUCCESS ═══");
  } else {
    console.info(LOG, "═══ PARTIAL SUCCESS ═══ buckets + service write + public OK; apply SQL for anon");
  }
}

main().catch((e) => {
  console.error(LOG, e);
  process.exit(1);
});
