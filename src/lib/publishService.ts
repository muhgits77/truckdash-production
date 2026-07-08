/**
 * Publish Service — "Publish to My Website" for TruckDash.
 *
 * Shared data between TruckDash (owner dashboard) and public website views
 * (/website, /menu, /schedule — Cluckin Chaos style, monticelloeatsandfinds.live, etc.).
 *
 * Dual mode:
 *   1. localStorage always (fast, offline-friendly for truck owners on the road)
 *   2. Supabase when "Use Supabase Sync" is on + env keys + (for writes) owner signed in
 *
 * Offline: publish always hits localStorage; failed cloud pushes queue and sync on reconnect.
 */

import type { MenuItem, ScheduleDay, TruckState } from "./truck-state";
import { getSupabase, isSupabaseConfigured } from "./supabase";

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
  lastPublished: string; // ISO timestamp
  version: number;
}

/** Row shape returned from published_trucks (snake_case columns). */
export interface PublishedTruckRow {
  id: string;
  truck_id: string;
  user_id: string | null;
  truck_name: string;
  phone: string;
  order_url: string;
  location: string;
  hours_start: string;
  hours_end: string;
  special: string;
  menu: MenuItem[];
  schedule: ScheduleDay[];
  last_published: string;
  version: number;
  payload: PublishedPayload | Record<string, unknown>;
}

const PUBLISHED_KEY = "truckdash.published.v1";
const SYNC_ENABLED_KEY = "truckdash.supabase.syncEnabled";
const TRUCK_ID_KEY = "truckdash.supabase.truckId";
const PENDING_SYNC_KEY = "truckdash.supabase.pendingSync";
const PUBLISHED_VERSION = 1;

export const DEFAULT_TRUCK_ID =
  (import.meta.env.VITE_DEFAULT_TRUCK_ID as string | undefined)?.trim() || "bluegrass-kitchen";

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

// ---------------------------------------------------------------------------
// Settings helpers (localStorage)
// ---------------------------------------------------------------------------

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

/** Whether cloud publish/read should be attempted. */
export function canUseSupabaseSync(): boolean {
  return isSupabaseConfigured() && isSupabaseSyncEnabled();
}

// ---------------------------------------------------------------------------
// Row ↔ payload mapping
// ---------------------------------------------------------------------------

function rowToPayload(row: PublishedTruckRow): PublishedPayload {
  const fromPayload =
    row.payload && typeof row.payload === "object" && "menu" in row.payload
      ? (row.payload as Partial<PublishedPayload>)
      : {};

  return {
    ...DEFAULT_PUBLISHED,
    ...fromPayload,
    truckName: row.truck_name || fromPayload.truckName || "",
    phone: row.phone || fromPayload.phone || "",
    orderUrl: row.order_url || fromPayload.orderUrl || "",
    location: row.location || fromPayload.location || "",
    hoursStart: row.hours_start || fromPayload.hoursStart || "",
    hoursEnd: row.hours_end || fromPayload.hoursEnd || "",
    special: row.special || fromPayload.special || "",
    menu: (Array.isArray(row.menu) ? row.menu : fromPayload.menu) || [],
    schedule: (Array.isArray(row.schedule) ? row.schedule : fromPayload.schedule) || [],
    lastPublished: row.last_published || fromPayload.lastPublished || "",
    version: row.version ?? fromPayload.version ?? PUBLISHED_VERSION,
  };
}

function payloadToRowFields(truckId: string, userId: string | null, payload: PublishedPayload) {
  return {
    truck_id: truckId,
    user_id: userId,
    truck_name: payload.truckName,
    phone: payload.phone,
    order_url: payload.orderUrl,
    location: payload.location,
    hours_start: payload.hoursStart,
    hours_end: payload.hoursEnd,
    special: payload.special,
    menu: payload.menu,
    schedule: payload.schedule,
    last_published: payload.lastPublished,
    version: payload.version,
    payload,
  };
}

// ---------------------------------------------------------------------------
// localStorage core
// ---------------------------------------------------------------------------

function readLocalPublished(): PublishedPayload {
  try {
    const raw = localStorage.getItem(PUBLISHED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PublishedPayload;
      return { ...DEFAULT_PUBLISHED, ...parsed };
    }
  } catch (err) {
    console.warn("[publishService] Failed to read published data", err);
  }
  return { ...DEFAULT_PUBLISHED };
}

function writeLocalPublished(published: PublishedPayload): void {
  localStorage.setItem(PUBLISHED_KEY, JSON.stringify(published));
}

// ---------------------------------------------------------------------------
// Offline pending queue
// ---------------------------------------------------------------------------

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

/**
 * Push any queued publish to Supabase (call on online / after login / after publish).
 */
export async function flushPendingCloudSync(): Promise<{ ok: boolean; message?: string }> {
  const pending = getPendingSync();
  if (!pending) return { ok: true, message: "Nothing pending" };
  if (!canUseSupabaseSync()) {
    return { ok: false, message: "Supabase sync is off or not configured" };
  }

  try {
    await publishToSupabase(pending.truckId, pending.payload);
    setPendingSync(null);
    return { ok: true, message: "Offline publish synced to Supabase" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    console.warn("[publishService] flushPendingCloudSync", err);
    return { ok: false, message };
  }
}

// Wire online listener once (browser only)
let onlineHooked = false;
function ensureOnlineHook() {
  if (onlineHooked || typeof window === "undefined") return;
  onlineHooked = true;
  window.addEventListener("online", () => {
    void flushPendingCloudSync();
  });
}

// ---------------------------------------------------------------------------
// Supabase API
// ---------------------------------------------------------------------------

/**
 * Upsert the latest published snapshot for a truck.
 * Requires authenticated session; RLS enforces user_id = auth.uid().
 */
export async function publishToSupabase(
  truckId: string,
  payload: PublishedPayload | Omit<PublishedPayload, "lastPublished" | "version">,
): Promise<PublishedPayload> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    throw new Error("Sign in as the truck owner in Settings to publish to Supabase.");
  }

  const published: PublishedPayload =
    "lastPublished" in payload && payload.lastPublished
      ? {
          ...payload,
          version: (payload as PublishedPayload).version || PUBLISHED_VERSION,
        }
      : {
          ...(payload as Omit<PublishedPayload, "lastPublished" | "version">),
          lastPublished: new Date().toISOString(),
          version: PUBLISHED_VERSION,
        };

  const id = truckId.trim() || DEFAULT_TRUCK_ID;
  const row = payloadToRowFields(id, user.id, published);

  const { error } = await supabase.from("published_trucks").upsert(row, {
    onConflict: "truck_id",
  });

  if (error) {
    console.error("[publishService] publishToSupabase", error);
    throw new Error(error.message || "Failed to publish to Supabase");
  }

  return published;
}

/**
 * Fetch the latest published record for a truck (public / anon OK via RLS).
 * Returns null if none found or Supabase unavailable.
 */
export async function getLatestPublished(truckId: string): Promise<PublishedPayload | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const id = truckId.trim() || DEFAULT_TRUCK_ID;

  const { data, error } = await supabase
    .from("published_trucks")
    .select(
      "id, truck_id, user_id, truck_name, phone, order_url, location, hours_start, hours_end, special, menu, schedule, last_published, version, payload",
    )
    .eq("truck_id", id)
    .order("last_published", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[publishService] getLatestPublished", error.message);
    return null;
  }
  if (!data) return null;

  return rowToPayload(data as PublishedTruckRow);
}

// ---------------------------------------------------------------------------
// Public service API (local + cloud)
// ---------------------------------------------------------------------------

export type PublishResult = {
  published: PublishedPayload;
  source: "local" | "supabase" | "local+queued";
  message?: string;
};

/**
 * Read published data.
 * Prefer Supabase when configured+enabled (or always try cloud for public pages
 * when env is set); fall back to localStorage.
 */
export async function getPublishedData(truckId?: string): Promise<PublishedPayload> {
  ensureOnlineHook();
  const id = truckId?.trim() || getConfiguredTruckId();

  // Public pages / owners with env keys: try cloud even if owner toggle is off,
  // so /website works for customers. Toggle mainly gates *writes*.
  if (isSupabaseConfigured()) {
    try {
      const remote = await getLatestPublished(id);
      if (remote?.lastPublished) {
        // Cache for offline visitors on this device
        try {
          writeLocalPublished(remote);
        } catch {
          /* ignore */
        }
        return remote;
      }
    } catch (err) {
      console.warn("[publishService] remote read failed, using local", err);
    }
  }

  return readLocalPublished();
}

/**
 * Publish: always write localStorage, then optionally push to Supabase.
 * Offline / auth failures queue a pending cloud sync.
 */
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

  try {
    writeLocalPublished(published);
  } catch (err) {
    console.error("[publishService] Failed to publish data locally", err);
    throw err;
  }

  const truckId = options?.truckId?.trim() || getConfiguredTruckId();
  const wantCloud = !options?.skipCloud && canUseSupabaseSync();

  if (!wantCloud) {
    return {
      published,
      source: "local",
      message: isSupabaseSyncEnabled()
        ? "Saved on this device (Supabase env not configured)"
        : "Saved on this device",
    };
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setPendingSync({ truckId, payload: published, queuedAt: new Date().toISOString() });
    return {
      published,
      source: "local+queued",
      message: "Saved offline — will sync to Supabase when you're back online",
    };
  }

  try {
    await publishToSupabase(truckId, published);
    setPendingSync(null);
    return {
      published,
      source: "supabase",
      message: "Published to your website (Supabase)",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cloud publish failed";
    setPendingSync({ truckId, payload: published, queuedAt: new Date().toISOString() });
    console.warn("[publishService] cloud publish queued:", message);
    return {
      published,
      source: "local+queued",
      message: `${message} — saved on this device; will retry when ready`,
    };
  }
}

/**
 * Export the currently published data as a clean JSON file.
 */
export async function exportPublishedJSON(): Promise<void> {
  const data = await getPublishedData();
  if (!data.lastPublished) {
    throw new Error("No published data to export yet. Publish first.");
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (data.truckName || "truck").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  a.href = url;
  a.download = `${safeName}-published-menu-schedule.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
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

// ---------------------------------------------------------------------------
// Lightweight owner auth helpers (used by Settings)
// ---------------------------------------------------------------------------

export async function getOwnerSessionEmail(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.email ?? null;
}

export async function signInOwner(email: string, password: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  await flushPendingCloudSync();
}

export async function signUpOwner(email: string, password: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOutOwner(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}
