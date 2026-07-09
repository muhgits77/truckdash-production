/**
 * Publish Service — TruckDash → Supabase Storage (env-based client).
 *
 * On "Publish Updates to My Website":
 *   1. Snapshot menu + schedule to localStorage (offline cache only)
 *   2. Upload menu.json → Supabase Storage menu-data/{truckId}/menu.json
 *      default: menu-data/cluckin-chaos/menu.json
 *   3. Upload food photos → menu-images (non-fatal)
 *   4. Re-upload menu.json if image URLs changed
 *
 * Cloud writes always go through the Supabase JS client + VITE_SUPABASE_* env vars.
 * localStorage is never the website source of truth.
 */

import type { MenuItem, ScheduleDay, TruckState } from "./truck-state";
import {
  ensureFreshSession,
  getAuthStatus,
  getSupabase,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "./supabase";
import {
  fetchMenuJson,
  menuJsonFullPath,
  menuJsonPublicUrl,
  type StoredMenuJson,
  uploadMenuImages,
  uploadMenuJson,
} from "./menuStorage";

export interface PublishedPayload {
  truckName: string;
  phone: string;
  orderUrl: string;
  location: string;
  hoursStart: string;
  hoursEnd: string;
  special: string;
  menu: MenuItem[];
  schedule: ScheduleDay[];
  lastPublished: string;
  version: number;
}

const PUBLISHED_KEY = "truckdash.published.v1";
const SYNC_ENABLED_KEY = "truckdash.supabase.syncEnabled";
const TRUCK_ID_KEY = "truckdash.supabase.truckId";
const PENDING_SYNC_KEY = "truckdash.supabase.pendingSync";
const PUBLISHED_VERSION = 1;

export const DEFAULT_TRUCK_ID =
  (
    (typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env.VITE_DEFAULT_TRUCK_ID as string | undefined)
      : undefined) ||
    (typeof process !== "undefined" ? process.env.VITE_DEFAULT_TRUCK_ID : undefined) ||
    "cluckin-chaos"
  ).trim() || "cluckin-chaos";

export const DEFAULT_PUBLISHED: PublishedPayload = {
  truckName: "",
  phone: "",
  orderUrl: "",
  location: "",
  hoursStart: "",
  hoursEnd: "",
  special: "",
  menu: [],
  schedule: [],
  lastPublished: "",
  version: PUBLISHED_VERSION,
};

// ── Settings ─────────────────────────────────────────────────────────────────

export function isSupabaseSyncEnabled(): boolean {
  try {
    return localStorage.getItem(SYNC_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSupabaseSyncEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SYNC_ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function getConfiguredTruckId(): string {
  try {
    const stored = localStorage.getItem(TRUCK_ID_KEY)?.trim();
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_TRUCK_ID;
}

export function setConfiguredTruckId(truckId: string): void {
  try {
    localStorage.setItem(TRUCK_ID_KEY, truckId.trim() || DEFAULT_TRUCK_ID);
  } catch {
    /* ignore */
  }
}

export function canUseSupabaseSync(): boolean {
  return isSupabaseConfigured() && isSupabaseSyncEnabled();
}

// ── localStorage ─────────────────────────────────────────────────────────────

function readLocalPublished(): PublishedPayload {
  try {
    const raw = localStorage.getItem(PUBLISHED_KEY);
    if (raw) return { ...DEFAULT_PUBLISHED, ...JSON.parse(raw) };
  } catch (err) {
    console.warn("[publishService] local read failed", err);
  }
  return { ...DEFAULT_PUBLISHED };
}

function writeLocalPublished(published: PublishedPayload): void {
  localStorage.setItem(PUBLISHED_KEY, JSON.stringify(published));
}

function storedJsonFromPayload(truckId: string, published: PublishedPayload): StoredMenuJson {
  return {
    truckId: truckId.trim() || DEFAULT_TRUCK_ID,
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
    version: published.version,
  };
}

function storedJsonToPayload(json: StoredMenuJson): PublishedPayload {
  return {
    truckName: json.truckName || "",
    phone: json.phone || "",
    orderUrl: json.orderUrl || "",
    location: json.location || "",
    hoursStart: json.hoursStart || "",
    hoursEnd: json.hoursEnd || "",
    special: json.special || "",
    menu: Array.isArray(json.menu) ? json.menu : [],
    schedule: Array.isArray(json.schedule) ? json.schedule : [],
    lastPublished: json.lastPublished || "",
    version: json.version || PUBLISHED_VERSION,
  };
}

// ── Pending sync queue ───────────────────────────────────────────────────────

type PendingSync = { truckId: string; payload: PublishedPayload; queuedAt: string };

function getPendingSync(): PendingSync | null {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    return raw ? (JSON.parse(raw) as PendingSync) : null;
  } catch {
    return null;
  }
}

function setPendingSync(item: PendingSync | null): void {
  try {
    if (!item) localStorage.removeItem(PENDING_SYNC_KEY);
    else localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(item));
  } catch {
    /* ignore */
  }
}

export function hasPendingCloudSync(): boolean {
  return !!getPendingSync();
}

let onlineHooked = false;
function ensureOnlineHook() {
  if (onlineHooked || typeof window === "undefined") return;
  onlineHooked = true;
  window.addEventListener("online", () => void flushPendingCloudSync());
}

// ── Storage publish ──────────────────────────────────────────────────────────

/**
 * Upload full menu + schedule (+ images) to Supabase Storage via env-based client.
 * Always writes menu-data/{truckId}/menu.json (default: cluckin-chaos).
 */
export async function publishToStorage(
  truckId: string,
  payload: PublishedPayload | Omit<PublishedPayload, "lastPublished" | "version">,
): Promise<PublishedPayload> {
  if (!isSupabaseConfigured() || !getSupabase()) {
    throw new Error(
      "Supabase not configured. Copy .env.example → .env, add your keys, run npm run setup.",
    );
  }

  const published: PublishedPayload =
    "lastPublished" in payload && payload.lastPublished
      ? { ...payload, version: (payload as PublishedPayload).version || PUBLISHED_VERSION }
      : {
          ...(payload as Omit<PublishedPayload, "lastPublished" | "version">),
          lastPublished: new Date().toISOString(),
          version: PUBLISHED_VERSION,
        };

  const id = (truckId.trim() || DEFAULT_TRUCK_ID || "cluckin-chaos").trim();
  const targetPath = menuJsonFullPath(id);
  const publicUrl = menuJsonPublicUrl(id);
  const supabaseHost = getSupabaseUrl();

  await ensureFreshSession();
  const auth = await getAuthStatus();
  console.info("[publishService] ═══ Supabase Storage publish START ═══", {
    supabaseHost,
    truckId: id,
    targetPath,
    publicUrl,
    menuItems: published.menu.length,
    scheduleDays: published.schedule.length,
    special: published.special?.slice(0, 80),
    auth: {
      signedIn: auth.signedIn,
      email: auth.email,
      userId: auth.userId,
      hasJwt: auth.hasJwt,
      keyType: auth.keyType,
      tokenKind: auth.tokenKind,
    },
  });

  // 1) Full menu + schedule JSON → menu-data/{id}/menu.json
  const initialJson = storedJsonFromPayload(id, published);
  let upload = await uploadMenuJson(id, initialJson);

  if (!upload.listedInBucket || !upload.verified) {
    throw new Error(
      `Publish incomplete for ${targetPath}: listedInBucket=${upload.listedInBucket} publicVerified=${upload.verified}. ` +
        `Object must exist at ${targetPath} with public access.`,
    );
  }

  console.info("[publishService] ✓ menu.json in Supabase Storage (list + public verified)", {
    supabaseHost,
    truckId: id,
    fullPath: upload.fullPath,
    publicUrl: upload.publicUrl,
    publicReadable: upload.verified,
    listedInBucket: upload.listedInBucket,
    objectId: upload.objectId,
    listedBytes: upload.listedBytes,
    menuItems: initialJson.menu.length,
    scheduleDays: initialJson.schedule.length,
  });

  // 2) Images (non-fatal) then re-publish JSON if any URLs changed
  let menuWithImages = published.menu;
  try {
    menuWithImages = await uploadMenuImages(id, published.menu);
    const hasNewImageUrls = menuWithImages.some(
      (item, i) => item.image && item.image !== published.menu[i]?.image,
    );
    if (hasNewImageUrls) {
      const jsonWithImages = storedJsonFromPayload(id, { ...published, menu: menuWithImages });
      upload = await uploadMenuJson(id, jsonWithImages);
      console.info("[publishService] menu.json re-uploaded with image URLs", {
        fullPath: upload.fullPath,
        publicUrl: upload.publicUrl,
        publicReadable: upload.verified,
      });
    }
  } catch (imgErr) {
    console.warn("[publishService] image upload failed (menu.json already saved)", imgErr);
  }

  if (!upload.listedInBucket) {
    throw new Error(`menu.json missing from Supabase Storage after publish (${targetPath})`);
  }

  if (!upload.verified) {
    console.warn(
      "[publishService] menu.json in bucket but public URL not verified — ensure storage.buckets.public = true for menu-data",
      upload.publicUrl,
    );
  }

  console.info("[publishService] ═══ Supabase Storage publish SUCCESS ═══", {
    supabaseHost,
    truckId: id,
    fullPath: upload.fullPath,
    publicUrl: upload.publicUrl,
    publicReadable: upload.verified,
    menuItems: menuWithImages.length,
    scheduleDays: published.schedule.length,
  });

  return { ...published, menu: menuWithImages };
}

export async function getLatestPublished(truckId: string): Promise<PublishedPayload | null> {
  const id = truckId.trim() || DEFAULT_TRUCK_ID;
  const json = await fetchMenuJson(id);
  if (!json?.lastPublished) return null;
  return storedJsonToPayload(json);
}

export async function flushPendingCloudSync(): Promise<{ ok: boolean; message?: string }> {
  const pending = getPendingSync();
  if (!pending) return { ok: true, message: "Nothing pending" };
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured" };
  }
  try {
    await publishToStorage(pending.truckId, pending.payload);
    setPendingSync(null);
    return { ok: true, message: "Offline publish synced to Supabase Storage" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    console.warn("[publishService] flushPendingCloudSync", err);
    return { ok: false, message };
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export type PublishResult = {
  published: PublishedPayload;
  source: "local" | "storage" | "local+queued";
  message?: string;
};

export type WebsiteMenuJson = StoredMenuJson;

export function buildWebsiteMenuJson(
  published: PublishedPayload,
  truckId?: string,
): WebsiteMenuJson {
  return storedJsonFromPayload(truckId || getConfiguredTruckId(), published);
}

/** @deprecated Use storage buckets — kept for manual export backup */
export function downloadWebsiteMenuJson(
  published: PublishedPayload,
  truckId?: string,
  filename = "menu.json",
): void {
  if (typeof document === "undefined") return;
  const json = buildWebsiteMenuJson(published, truckId);
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function getPublishedData(truckId?: string): Promise<PublishedPayload> {
  ensureOnlineHook();
  const id = truckId?.trim() || getConfiguredTruckId();

  if (isSupabaseConfigured()) {
    try {
      const remote = await getLatestPublished(id);
      if (remote?.lastPublished) {
        writeLocalPublished(remote);
        return remote;
      }
    } catch (err) {
      console.warn("[publishService] storage read failed, using local", err);
    }
  }

  return readLocalPublished();
}

export async function publishData(
  data: Omit<PublishedPayload, "lastPublished" | "version">,
  options?: { truckId?: string; skipCloud?: boolean },
): Promise<PublishResult> {
  ensureOnlineHook();

  const published: PublishedPayload = {
    ...data,
    lastPublished: new Date().toISOString(),
    version: PUBLISHED_VERSION,
  };

  // Local cache only — never the website source of truth
  writeLocalPublished(published);

  // Always prefer cluckin-chaos unless an explicit truckId option is passed
  const truckId =
    options?.truckId?.trim() || getConfiguredTruckId().trim() || DEFAULT_TRUCK_ID || "cluckin-chaos";
  const fullPath = menuJsonFullPath(truckId);
  const publicUrl = menuJsonPublicUrl(truckId);
  const supabaseHost = getSupabaseUrl();

  if (options?.skipCloud) {
    return {
      published,
      source: "local",
      message: "Saved locally only (skipCloud).",
    };
  }

  if (!isSupabaseConfigured()) {
    console.error("[publishService] Publish blocked — Supabase env vars missing", {
      targetPath: fullPath,
    });
    return {
      published,
      source: "local",
      message:
        "Saved locally only. Add VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY to .env, then run npm run setup.",
    };
  }

  // Sync toggle is optional UX — Publish always uploads when env is set
  if (!isSupabaseSyncEnabled()) {
    console.info(
      "[publishService] Supabase Sync toggle is off — still uploading menu.json to Supabase Storage",
      { supabaseHost, fullPath },
    );
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setPendingSync({ truckId, payload: published, queuedAt: new Date().toISOString() });
    return {
      published,
      source: "local+queued",
      message: "Saved offline — will upload to Supabase Storage when back online",
    };
  }

  try {
    console.info("[publishService] Publish button → Supabase Storage upload", {
      supabaseHost,
      truckId,
      fullPath,
      publicUrl,
    });
    const uploaded = await publishToStorage(truckId, published);
    writeLocalPublished(uploaded);
    setPendingSync(null);
    console.info("[publishService] ✓ Publish Updates complete (Supabase Storage)", {
      supabaseHost,
      fullPath,
      publicUrl,
      menuItems: uploaded.menu.length,
      scheduleDays: uploaded.schedule.length,
      lastPublished: uploaded.lastPublished,
    });
    return {
      published: uploaded,
      source: "storage",
      message: `Published to Supabase Storage: ${fullPath} (listed + public verified)`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cloud publish failed";
    setPendingSync({ truckId, payload: published, queuedAt: new Date().toISOString() });
    console.error("[publishService] Supabase Storage publish FAILED", {
      supabaseHost,
      truckId,
      targetPath: fullPath,
      publicUrl,
      error: message,
      err,
    });
    return {
      published,
      source: "local+queued",
      message: `Supabase Storage upload failed: ${message}`,
    };
  }
}

export async function exportPublishedJSON(): Promise<void> {
  const data = await getPublishedData();
  if (!data.lastPublished) throw new Error("Publish first.");
  downloadWebsiteMenuJson(data, getConfiguredTruckId());
}

export async function clearPublishedData(): Promise<void> {
  try {
    localStorage.removeItem(PUBLISHED_KEY);
    localStorage.removeItem(PENDING_SYNC_KEY);
  } catch {
    /* ignore */
  }
}

export function buildPublishPayloadFromState(
  state: TruckState,
): Omit<PublishedPayload, "lastPublished" | "version"> {
  return {
    truckName: state.name,
    phone: state.phone,
    orderUrl: state.orderUrl,
    location: state.location,
    hoursStart: state.hoursStart,
    hoursEnd: state.hoursEnd,
    special: state.special,
    menu: state.menu,
    schedule: state.schedule,
  };
}

// ── Owner auth ───────────────────────────────────────────────────────────────

export async function getOwnerSessionEmail(): Promise<string | null> {
  const status = await getAuthStatus();
  return status.email;
}

export async function signInOwner(email: string, password: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");

  const trimmed = email.trim();
  console.info("[publishService] sign-in START", {
    email: trimmed,
    supabaseHost: getSupabaseUrl(),
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: trimmed,
    password,
  });
  if (error) {
    console.error("[publishService] sign-in FAILED", {
      email: trimmed,
      message: error.message,
      status: error.status,
    });
    throw new Error(error.message);
  }

  let accessToken = data.session?.access_token?.trim() ?? "";
  let refreshToken = data.session?.refresh_token?.trim() ?? "";

  // Persist session explicitly so Storage uploads pick up the JWT immediately
  if (accessToken && refreshToken) {
    const { data: setData, error: setErr } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (setErr) {
      console.warn("[publishService] setSession warning", setErr.message);
    } else if (setData.session?.access_token) {
      accessToken = setData.session.access_token;
      refreshToken = setData.session.refresh_token ?? refreshToken;
    }
  }

  if (!accessToken) {
    // One more read in case the client persisted the session asynchronously
    const { data: again } = await supabase.auth.getSession();
    accessToken = again.session?.access_token?.trim() ?? "";
  }

  if (!accessToken) {
    console.error("[publishService] sign-in returned no session", {
      email: trimmed,
      userId: data.user?.id,
    });
    throw new Error(
      "Signed in but no session was returned. Confirm your email if required, then try again.",
    );
  }
  const status = await getAuthStatus();
  console.info("[publishService] sign-in OK — session JWT ready for Storage uploads", {
    email: status.email,
    userId: status.userId,
    hasJwt: status.hasJwt,
    tokenKind: status.tokenKind,
    expiresAt: status.expiresAt,
    accessTokenLen: accessToken.length,
  });

  await flushPendingCloudSync();
}

export async function signUpOwner(email: string, password: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");
  const trimmed = email.trim();
  console.info("[publishService] sign-up START", { email: trimmed });
  const { data, error } = await supabase.auth.signUp({ email: trimmed, password });
  if (error) {
    console.error("[publishService] sign-up FAILED", { email: trimmed, message: error.message });
    throw new Error(error.message);
  }
  console.info("[publishService] sign-up OK", {
    email: trimmed,
    userId: data.user?.id,
    session: Boolean(data.session),
    needsEmailConfirm: !data.session,
  });
}

export async function signOutOwner(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  console.info("[publishService] sign-out");
  await supabase.auth.signOut();
}