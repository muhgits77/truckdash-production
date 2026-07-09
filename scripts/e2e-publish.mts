/**
 * E2E: exercise real app modules for sign-in + publishToStorage + public verify.
 * Usage: npx tsx scripts/e2e-publish.mts
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
    process.env[k] = v;
  }
}

const LOG = "[e2e-publish]";

const {
  isSupabaseConfigured,
  getAuthStatus,
  getAccessTokenForStorage,
  ensureFreshSession,
  getSupabaseUrl,
} = await import("../src/lib/supabase.ts");

const { uploadMenuJson } = await import("../src/lib/menuStorage.ts");
const {
  publishToStorage,
  signInOwner,
  getOwnerSessionEmail,
} = await import("../src/lib/publishService.ts");

console.info(LOG, "configured?", isSupabaseConfigured(), getSupabaseUrl());
if (!isSupabaseConfigured()) {
  console.error(LOG, "Supabase not configured");
  process.exit(1);
}

const pre = await getAuthStatus();
console.info(LOG, "pre-auth", {
  signedIn: pre.signedIn,
  email: pre.email,
  keyType: pre.keyType,
  hasJwt: pre.hasJwt,
});

const access = await getAccessTokenForStorage();
console.info(LOG, "access token kind", access.kind, "email", access.email);

const email = process.env.TEST_OWNER_EMAIL || "";
const password = process.env.TEST_OWNER_PASSWORD || "";
if (email && password) {
  console.info(LOG, "attempting signInOwner…");
  await signInOwner(email, password);
  const after = await getOwnerSessionEmail();
  console.info(LOG, "signed in as", after);
  console.info(LOG, "post-sign-in auth", await getAuthStatus());
} else {
  console.info(LOG, "skipping sign-in (no TEST_OWNER_* creds) — API key Authorization");
}

await ensureFreshSession();

const truckId = process.env.VITE_DEFAULT_TRUCK_ID || "cluckin-chaos";
const payload = {
  truckName: "Cluckin Chaos",
  phone: "555-0100",
  orderUrl: "https://example.com/order",
  location: "e2e publish path",
  hoursStart: "5pm",
  hoursEnd: "9pm",
  special: `publishService e2e ${new Date().toISOString()}`,
  menu: [
    { id: "item-1", name: "Chaos Sandwich", price: "12.00", description: "e2e" },
  ],
  schedule: [
    {
      id: "d1",
      day: "FRI",
      neighborhood: "Russell Springs",
      spot: "Food Truck Friday",
      hoursStart: "5pm",
      hoursEnd: "9pm",
      closed: false,
      note: "e2e",
    },
  ],
};

console.info(LOG, "calling publishToStorage…", { truckId });
const published = await publishToStorage(truckId, payload);
console.info(LOG, "publishToStorage result", {
  lastPublished: published.lastPublished,
  menuItems: published.menu.length,
  scheduleDays: published.schedule.length,
  special: published.special,
});

const publicUrl = `${getSupabaseUrl()}/storage/v1/object/public/menu-data/${truckId}/menu.json?t=${Date.now()}`;
const res = await fetch(publicUrl, { cache: "no-store" });
const json = res.ok ? await res.json() : null;
console.info(LOG, "public fetch", {
  status: res.status,
  special: json?.special,
  menuItems: json?.menu?.length,
  lastPublished: json?.lastPublished,
});

if (!res.ok || !json?.lastPublished) {
  console.error(LOG, "FAILED public verify");
  process.exit(1);
}

const up = await uploadMenuJson(truckId, {
  truckId,
  truckName: published.truckName,
  phone: published.phone,
  orderUrl: published.orderUrl,
  location: published.location,
  hoursStart: published.hoursStart,
  hoursEnd: published.hoursEnd,
  special: published.special,
  menu: published.menu,
  schedule: published.schedule,
  lastPublished: published.lastPublished,
  version: published.version || 1,
});
console.info(LOG, "uploadMenuJson", {
  fullPath: up.fullPath,
  verified: up.verified,
  listedInBucket: up.listedInBucket,
  publicUrl: up.publicUrl,
});

if (!up.listedInBucket || !up.verified) {
  console.error(LOG, "FAILED listed/verified", up);
  process.exit(1);
}

console.info(LOG, "═══ E2E SUCCESS ═══");
