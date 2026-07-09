/**
 * Live e2e test: auth status + upload menu.json to menu-data/{truckId}/menu.json
 *
 * Usage:
 *   npx tsx scripts/test-menu-upload.ts [truckId]
 *
 * Requires .env / .env.local with:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY
 * Optional (authenticated path):
 *   TEST_OWNER_EMAIL / TEST_OWNER_PASSWORD
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

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
/** Server-only — prefer for writes when anon INSERT RLS is not applied yet */
const serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
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

function isLikelyJwt(token: string): boolean {
  return token.split(".").length === 3;
}

function describeAuth(value: string | null, apiKey: string): string {
  if (!value) return "missing";
  const bare = value.replace(/^Bearer\s+/i, "");
  if (!bare) return "Bearer empty";
  if (bare === apiKey) {
    return apiKey.startsWith("sb_publishable_") ? "Bearer publishable-key" : "Bearer api-key";
  }
  if (isLikelyJwt(bare)) return "Bearer JWT";
  return "Bearer other";
}

/**
 * Fixed fetch: always keep Authorization present (never strip to empty).
 * This is the bug that caused: headers must have required property 'authorization'
 */
function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    const before = describeAuth(headers.get("Authorization"), supabaseKey);
    if (!headers.get("Authorization")) {
      headers.set("Authorization", `Bearer ${supabaseKey}`);
    }
    headers.set("apikey", supabaseKey);

    const u = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    if (u.includes("/storage/") || u.includes("/auth/v1/")) {
      console.info(LOG, "fetch", {
        method: init?.method || (input instanceof Request ? input.method : "GET"),
        path: u.replace(url, ""),
        authorization: describeAuth(headers.get("Authorization"), supabaseKey),
        authorizationWas: before,
      });
    }

    return fetch(input, { ...init, headers });
  };
}

async function logAuthStatus(supabase: SupabaseClient, label: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn(LOG, `${label} getSession error`, error.message);
    return null;
  }
  const session = data.session;
  console.info(LOG, `${label} auth status`, {
    signedIn: Boolean(session),
    email: session?.user?.email ?? null,
    userId: session?.user?.id ?? null,
    hasJwt: session?.access_token ? isLikelyJwt(session.access_token) : false,
    expiresAt: session?.expires_at ?? null,
    tokenPrefix: session?.access_token?.slice(0, 16) ?? null,
  });
  return session;
}

async function uploadMenu(
  supabase: SupabaseClient,
  session: Session | null,
): Promise<void> {
  const payload = {
    truckId,
    truckName: "Cluckin Chaos",
    phone: "",
    orderUrl: "",
    location: "e2e-test",
    hoursStart: "5pm",
    hoursEnd: "9pm",
    special: `e2e test ${new Date().toISOString()}`,
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
  // Prefer session JWT → service role (bypasses RLS) → anon/publishable
  const token = (session?.access_token || serviceKey || anonKey).trim();
  const authMode = session
    ? "session-jwt"
    : serviceKey && token === serviceKey
      ? "service-role"
      : "api-key";
  if (!token) {
    console.error(LOG, "No Authorization token available");
    process.exit(1);
  }

  // PRIMARY: REST with explicit Authorization (matches app fix)
  const restUrl = `${url}/storage/v1/object/${bucket}/${path}`;
  console.info(LOG, "upload start (REST primary)", {
    fullPath,
    bytes: body.length,
    authMode,
    email: session?.user?.email ?? null,
    authorization: describeAuth(`Bearer ${token}`, anonKey),
  });

  const headers: Record<string, string> = {
    // When using service_role, apikey must also be the service key
    apikey: authMode === "service-role" ? serviceKey : anonKey,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "x-upsert": "true",
    "cache-control": "30",
  };

  let res = await fetch(restUrl, { method: "POST", headers, body });
  if (!res.ok && (res.status === 400 || res.status === 409 || res.status === 405)) {
    const peek = (await res.clone().text()).slice(0, 200);
    if (/required property 'authorization'/i.test(peek)) {
      console.error(LOG, "FAIL: missing authorization despite sending header", peek);
      process.exit(1);
    }
    res = await fetch(restUrl, { method: "PUT", headers, body });
  }

  if (!res.ok) {
    const detail = await res.text();
    console.error(LOG, "REST upload FAILED", res.status, detail.slice(0, 400));
    // Secondary: client path with ArrayBuffer + explicit headers
    console.info(LOG, "trying client fallback…");
    const buf = new TextEncoder().encode(body);
    const { data, error } = await supabase.storage.from(bucket).upload(path, buf, {
      contentType: "application/json",
      cacheControl: "30",
      upsert: true,
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (error) {
      console.error(LOG, "client upload also FAILED", error.message);
      process.exit(1);
    }
    console.info(LOG, "✓ client upload OK", data);
    return;
  }

  console.info(LOG, "✓ REST upload OK", res.status);
}

async function main() {
  console.info(LOG, "═══ START ═══", {
    fullPath,
    publicUrl,
    url,
    keyType: anonKey.startsWith("sb_publishable_") ? "publishable" : "anon-jwt",
    hasOwnerCreds: Boolean(email && password),
  });

  const supabase = createClient(url, anonKey, {
    global: {
      fetch: createSupabaseFetch(anonKey),
      headers: { Authorization: `Bearer ${anonKey}` },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let session: Session | null = null;

  if (email && password) {
    console.info(LOG, "signing in owner…", { email });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error(LOG, "sign-in FAILED", error.message);
      process.exit(1);
    }
    session = data.session;
    if (!session?.access_token) {
      console.error(LOG, "sign-in returned no session (email confirm required?)");
      process.exit(1);
    }
    console.info(LOG, "✓ signed in", {
      email: session.user?.email,
      userId: session.user?.id,
      hasJwt: isLikelyJwt(session.access_token),
    });
  } else {
    console.info(
      LOG,
      "no TEST_OWNER_EMAIL / TEST_OWNER_PASSWORD — uploading with API key Authorization",
    );
  }

  session = (await logAuthStatus(supabase, "pre-upload")) ?? session;

  await uploadMenu(supabase, session);

  // Strict post-upload bucket list (same gate as the app)
  const root = await supabase.storage.from(bucket).list("", { limit: 100 });
  const folderList = await supabase.storage.from(bucket).list(truckId, { limit: 100 });
  const searchList = await supabase.storage.from(bucket).list(truckId, {
    search: "menu.json",
  });
  const rootNames = (root.data ?? []).map((f) => f.name);
  const folderNames = (folderList.data ?? []).map((f) => f.name);
  const hit = (folderList.data ?? []).find((f) => f.name === "menu.json" && f.id);
  console.info(LOG, "═══ post-upload bucket list ═══", {
    rootEntries: rootNames,
    folderEntries: folderNames,
    searchEntries: (searchList.data ?? []).map((f) => f.name),
    found: Boolean(hit),
    objectId: hit?.id,
    listedBytes: hit?.metadata?.size,
    rootErr: root.error?.message,
    folderErr: folderList.error?.message,
  });
  if (folderList.error || !hit) {
    console.error(LOG, "FAIL: menu.json not listed in bucket after upload", {
      fullPath,
      folderEntries: folderNames,
      rootEntries: rootNames,
    });
    process.exit(1);
  }

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
      special: json.special,
      authMode: session
        ? "session-jwt"
        : serviceKey
          ? "service-role"
          : "api-key",
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
