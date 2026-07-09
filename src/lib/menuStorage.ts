/**
 * Supabase Storage — menu JSON + food photos.
 *
 * Publish path (canonical):
 *   bucket: menu-data
 *   path:   {truckId}/menu.json
 *   e.g.    menu-data/cluckin-chaos/menu.json
 *
 * Uses the env-based Supabase client from ./supabase (VITE_SUPABASE_*).
 * Does NOT use localStorage as the cloud write target.
 */

import type { MenuItem, ScheduleDay } from "./truck-state";
import {
  getSupabase,
  getSupabaseAnonKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "./supabase";

export const MENU_DATA_BUCKET = "menu-data";
export const MENU_IMAGES_BUCKET = "menu-images";

const LOG = "[menuStorage]";

export type StoredMenuJson = {
  truckId: string;
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
};

export type UploadResult = {
  bucket: string;
  path: string;
  /** Full storage path including bucket, e.g. menu-data/cluckin-chaos/menu.json */
  fullPath: string;
  publicUrl: string;
  /** true when the object is publicly fetchable (bucket public + object present). */
  verified: boolean;
  /** true when the object shows up in the bucket listing (proves write landed). */
  listedInBucket: boolean;
};

export function menuJsonPath(truckId: string): string {
  const id = truckId.trim();
  if (!id) throw new Error("truckId is required for menu.json path");
  return `${id}/menu.json`;
}

export function menuJsonFullPath(truckId: string): string {
  return `${MENU_DATA_BUCKET}/${menuJsonPath(truckId)}`;
}

export function menuImagePath(truckId: string, itemId: string, ext: string): string {
  const safeId = itemId.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `${truckId.trim()}/${safeId}.${ext}`;
}

export function publicStorageUrl(bucket: string, path: string): string {
  const base = getSupabaseUrl().replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+/, "");
  return `${base}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

/** Public URL for menu-data/{truckId}/menu.json */
export function menuJsonPublicUrl(truckId: string): string {
  return publicStorageUrl(MENU_DATA_BUCKET, menuJsonPath(truckId));
}

/** Cache-busted public URL so CDNs / browsers never serve a stale menu. */
export function menuJsonPublicUrlWithCacheBust(truckId: string, bust = Date.now()): string {
  return `${menuJsonPublicUrl(truckId)}?t=${bust}`;
}

function extensionForBlob(blob: Blob): string {
  if (blob.type.includes("png")) return "png";
  if (blob.type.includes("webp")) return "webp";
  if (blob.type.includes("gif")) return "gif";
  return "jpg";
}

async function toBlob(image: string): Promise<Blob | null> {
  if (image.startsWith("data:") || image.startsWith("blob:")) {
    const res = await fetch(image);
    return res.blob();
  }
  return null;
}

function isLocalImage(url: string | undefined): boolean {
  if (!url) return false;
  return url.startsWith("data:") || url.startsWith("blob:");
}

async function verifyBucketListing(bucket: string, path: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const fileName = path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path;

  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    limit: 100,
    search: fileName,
  });

  if (error) {
    console.error(LOG, "bucket list FAILED", { bucket, folder, path, message: error.message });
    return false;
  }
  const found = (data ?? []).some((f) => f.name === fileName);
  console.info(LOG, "bucket list", { bucket, path, folder, fileName, found });
  return found;
}

async function verifyPublicUrl(publicUrl: string): Promise<boolean> {
  const bustUrl = `${publicUrl}?verify=${Date.now()}`;
  try {
    const res = await fetch(bustUrl, {
      cache: "no-store",
      headers: { Accept: "application/json,*/*" },
    });
    if (res.ok) {
      console.info(LOG, "✓ public URL verified", { publicUrl, status: res.status });
      return true;
    }
    console.warn(LOG, "public URL not readable yet", {
      publicUrl,
      status: res.status,
      body: (await res.text().catch(() => "")).slice(0, 200),
    });
    return false;
  } catch (err) {
    console.warn(LOG, "public URL verify threw", { publicUrl, err });
    return false;
  }
}

async function verifyAuthenticatedRead(bucket: string, path: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    console.error(LOG, "authenticated verify FAILED", { bucket, path, message: error?.message });
    return false;
  }
  console.info(LOG, "authenticated read OK", { bucket, path, bytes: data.size });
  return true;
}

/** REST fallback when the JS client upload fails. */
async function uploadViaRest(
  bucket: string,
  path: string,
  body: Blob,
  contentType: string,
): Promise<void> {
  const base = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!base || !anonKey) throw new Error("Supabase env vars missing for REST upload");

  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `${base}/storage/v1/object/${bucket}/${encodedPath}`;
  const isOpaqueKey =
    anonKey.startsWith("sb_publishable_") || anonKey.startsWith("sb_secret_");

  console.info(LOG, "REST upload attempt", {
    bucket,
    path,
    url,
    bytes: body.size,
    supabaseHost: base,
  });

  const headers: Record<string, string> = {
    apikey: anonKey,
    "Content-Type": contentType,
    "x-upsert": "true",
    "cache-control": "30",
  };
  if (!isOpaqueKey) {
    headers.Authorization = `Bearer ${anonKey}`;
  }

  let res = await fetch(url, { method: "POST", headers, body });
  if (!res.ok && (res.status === 400 || res.status === 409 || res.status === 405)) {
    console.warn(LOG, "REST POST upsert not accepted — trying PUT", { status: res.status });
    res = await fetch(url, { method: "PUT", headers, body });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(LOG, "REST upload FAILED", {
      bucket,
      path,
      status: res.status,
      detail: detail.slice(0, 500),
    });
    throw new Error(`REST storage upload failed (${res.status}): ${detail || res.statusText}`);
  }

  console.info(LOG, "REST upload OK", { bucket, path, status: res.status });
}

/**
 * Upload (overwrite) to Supabase Storage at {bucket}/{path}.
 * Uses env-based Supabase JS client → REST fallback → verify.
 */
async function uploadObject(
  bucket: string,
  path: string,
  body: Blob,
  contentType: string,
): Promise<UploadResult> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).",
    );
  }

  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase client could not be created from env vars.");
  }

  const fullPath = `${bucket}/${path}`;
  const publicUrl = publicStorageUrl(bucket, path);
  const supabaseHost = getSupabaseUrl();

  console.info(LOG, "upload start → Supabase Storage", {
    supabaseHost,
    bucket,
    path,
    fullPath,
    contentType,
    bytes: body.size,
    publicUrl,
  });

  // 1) Supabase JS client upsert
  const first = await supabase.storage.from(bucket).upload(path, body, {
    contentType,
    cacheControl: "30",
    upsert: true,
  });

  let uploadOk = !first.error;
  let lastMessage = first.error?.message ?? null;

  if (!uploadOk) {
    console.warn(LOG, "client upload failed — trying REST fallback", {
      fullPath,
      supabaseHost,
      message: lastMessage,
    });
    try {
      await uploadViaRest(bucket, path, body, contentType);
      uploadOk = true;
      lastMessage = null;
    } catch (restErr) {
      const restMsg = restErr instanceof Error ? restErr.message : String(restErr);
      throw new Error(
        `Supabase Storage upload failed at ${fullPath} (host ${supabaseHost}): client=${lastMessage ?? "n/a"} | REST=${restMsg}`,
      );
    }
  } else {
    console.info(LOG, "client upload OK", {
      fullPath,
      supabaseHost,
      id: first.data?.id,
    });
  }

  // 2) Prove write landed
  let listedInBucket = await verifyBucketListing(bucket, path);
  if (!listedInBucket) {
    const authOk = await verifyAuthenticatedRead(bucket, path);
    if (authOk) {
      listedInBucket = true;
      console.warn(LOG, "list missed file but download OK — treating as saved", { fullPath });
    } else {
      console.error(LOG, "upload reported OK but file NOT readable", { fullPath, supabaseHost });
    }
  }

  // 3) Public URL verify (Cluckin Chaos path)
  const verified = await verifyPublicUrl(publicUrl);
  if (!verified) {
    console.warn(
      LOG,
      "file is in Supabase Storage but public URL failed — check bucket public=true",
      { fullPath, publicUrl },
    );
  }

  return { bucket, path, fullPath, publicUrl, verified, listedInBucket };
}

/** Upload local images → menu-images; return menu lines with public URLs. */
export async function uploadMenuImages(
  truckId: string,
  menu: MenuItem[],
): Promise<MenuItem[]> {
  if (!getSupabase()) throw new Error("Supabase not configured");

  const id = truckId.trim();
  const updated: MenuItem[] = [];

  for (const item of menu) {
    let image = item.image?.trim();

    if (image && isLocalImage(image)) {
      const blob = await toBlob(image);
      if (blob) {
        const ext = extensionForBlob(blob);
        const path = menuImagePath(id, item.id, ext);
        try {
          const result = await uploadObject(
            MENU_IMAGES_BUCKET,
            path,
            blob,
            blob.type || `image/${ext}`,
          );
          image = result.publicUrl;
          console.info(LOG, "image OK", { itemId: item.id, fullPath: result.fullPath });
        } catch (err) {
          console.warn(LOG, "image upload failed (non-fatal)", { itemId: item.id, err });
        }
      }
    }

    updated.push({ ...item, image: image || undefined });
  }

  return updated;
}

/**
 * Upload full menu + schedule JSON to Supabase Storage:
 *   menu-data/{truckId}/menu.json
 *
 * This is the ONLY cloud write used by the Publish button.
 */
export async function uploadMenuJson(truckId: string, json: StoredMenuJson): Promise<UploadResult> {
  const id = truckId.trim();
  if (!id) throw new Error("truckId is required");

  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase env vars missing. Set VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY (or ANON_KEY).",
    );
  }

  const path = menuJsonPath(id);
  const fullPath = menuJsonFullPath(id);
  const body = JSON.stringify(json, null, 2);
  const blob = new Blob([body], { type: "application/json" });
  const publicUrl = menuJsonPublicUrl(id);
  const supabaseHost = getSupabaseUrl();

  console.info(LOG, "═══ menu.json → Supabase Storage START ═══", {
    supabaseHost,
    truckId: id,
    fullPath,
    publicUrl,
    menuItems: json.menu.length,
    scheduleDays: json.schedule.length,
    lastPublished: json.lastPublished,
    bytes: blob.size,
  });

  const result = await uploadObject(MENU_DATA_BUCKET, path, blob, "application/json");

  if (!result.listedInBucket) {
    throw new Error(
      `menu.json did not land in Supabase Storage at ${fullPath} (host ${supabaseHost}). Check bucket exists + storage RLS.`,
    );
  }

  if (result.verified) {
    console.info(LOG, "═══ menu.json publish SUCCESS (public Supabase Storage) ═══", {
      supabaseHost,
      fullPath: result.fullPath,
      publicUrl: result.publicUrl,
      menuItems: json.menu.length,
      scheduleDays: json.schedule.length,
      publicReadable: true,
    });
  } else {
    console.warn(LOG, "═══ menu.json SAVED to Supabase Storage (public URL not open yet) ═══", {
      supabaseHost,
      fullPath: result.fullPath,
      publicUrl: result.publicUrl,
      menuItems: json.menu.length,
      scheduleDays: json.schedule.length,
    });
  }

  return result;
}

/**
 * Read menu.json for TruckDash preview + Cluckin Chaos public pages.
 *
 * Order:
 *   1. Public URL with cache busting (preferred for Cluckin Chaos)
 *   2. Authenticated storage download via env-based Supabase client
 */
export async function fetchMenuJson(truckId: string): Promise<StoredMenuJson | null> {
  if (!isSupabaseConfigured()) {
    console.warn(LOG, "fetch skipped — Supabase env not configured");
    return null;
  }

  const id = truckId.trim();
  const path = menuJsonPath(id);
  const fullPath = menuJsonFullPath(id);
  const publicUrl = menuJsonPublicUrl(id);
  const bustUrl = menuJsonPublicUrlWithCacheBust(id);
  const supabaseHost = getSupabaseUrl();

  console.info(LOG, "fetch menu.json START", { supabaseHost, fullPath, publicUrl, bustUrl });

  // 1) Public URL first — cache-busted
  try {
    const res = await fetch(bustUrl, {
      cache: "no-store",
      headers: { Accept: "application/json,*/*" },
    });
    if (res.ok) {
      const parsed = (await res.json()) as StoredMenuJson;
      console.info(LOG, "✓ fetch OK (public URL, cache-busted)", {
        fullPath,
        menu: parsed.menu?.length ?? 0,
        schedule: parsed.schedule?.length ?? 0,
        lastPublished: parsed.lastPublished,
      });
      return parsed;
    }
    console.warn(LOG, "public fetch not ok — trying authenticated download", {
      fullPath,
      status: res.status,
      publicUrl,
    });
  } catch (err) {
    console.warn(LOG, "public fetch threw — trying authenticated download", { fullPath, err });
  }

  // 2) Env-based Supabase client download
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.storage.from(MENU_DATA_BUCKET).download(path);
    if (!error && data) {
      try {
        const parsed = JSON.parse(await data.text()) as StoredMenuJson;
        console.info(LOG, "✓ fetch OK (Supabase client download)", {
          fullPath,
          menu: parsed.menu?.length ?? 0,
          schedule: parsed.schedule?.length ?? 0,
          lastPublished: parsed.lastPublished,
        });
        return parsed;
      } catch (parseErr) {
        console.error(LOG, "invalid JSON from storage", { fullPath, parseErr });
      }
    } else if (error) {
      console.warn(LOG, "authenticated download failed", { fullPath, message: error.message });
    }
  }

  console.error(LOG, "fetch menu.json FAILED", { fullPath, publicUrl, supabaseHost });
  return null;
}
