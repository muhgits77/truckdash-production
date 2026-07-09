/**
 * Supabase Storage — menu JSON + food photos.
 * Buckets: menu-data (JSON), menu-images (photos).
 *
 * Canonical publish path: menu-data/{truckId}/menu.json
 * Default truck: cluckin-chaos → menu-data/cluckin-chaos/menu.json
 *
 * Publish works with anon/publishable key (storage RLS).
 * Cluckin Chaos reads the public object URL with cache busting,
 * falling back to authenticated download if the bucket is still private.
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

/** Confirm the object appears in the bucket listing at {truckId}/menu.json */
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

/**
 * Prove the object is publicly readable via the CDN-style public URL.
 * Uses cache busting so we never mistake a stale 404 cache for failure.
 */
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

/** Authenticated/object API read — works even when bucket is still private. */
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

/** REST fallback when the JS client upload fails for any reason. */
async function uploadViaRest(
  bucket: string,
  path: string,
  body: Blob,
  contentType: string,
): Promise<void> {
  const base = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `${base}/storage/v1/object/${bucket}/${encodedPath}`;
  const isOpaqueKey =
    anonKey.startsWith("sb_publishable_") || anonKey.startsWith("sb_secret_");

  console.info(LOG, "REST upload attempt", { bucket, path, url, bytes: body.size });

  // Prefer POST + x-upsert (create or overwrite). Fall back to PUT.
  // Lovable publishable keys are opaque — send apikey only (no Bearer).
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
 * Upload (overwrite) a file to a bucket at exactly {bucket}/{path}.
 * Strategy: client upsert → REST fallback → list + public-read verify.
 */
async function uploadObject(
  bucket: string,
  path: string,
  body: Blob,
  contentType: string,
): Promise<UploadResult> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");

  const fullPath = `${bucket}/${path}`;
  const publicUrl = publicStorageUrl(bucket, path);

  console.info(LOG, "upload start", {
    bucket,
    path,
    fullPath,
    contentType,
    bytes: body.size,
    publicUrl,
  });

  // 1) Upsert via JS client
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
      message: lastMessage,
    });
    try {
      await uploadViaRest(bucket, path, body, contentType);
      uploadOk = true;
      lastMessage = null;
    } catch (restErr) {
      const restMsg = restErr instanceof Error ? restErr.message : String(restErr);
      throw new Error(
        `Storage upload failed at ${fullPath}: client=${lastMessage ?? "n/a"} | REST=${restMsg}`,
      );
    }
  }

  console.info(LOG, "upload OK", { fullPath, publicUrl });

  // 2) Prove write landed
  const listedInBucket = await verifyBucketListing(bucket, path);
  if (!listedInBucket) {
    console.error(LOG, "upload reported OK but file NOT in bucket listing", { fullPath });
  }

  // 3) Prefer public URL; fall back to authenticated existence check
  let verified = await verifyPublicUrl(publicUrl);
  if (!verified) {
    const authOk = await verifyAuthenticatedRead(bucket, path);
    if (authOk) {
      console.warn(
        LOG,
        "file is stored and readable with API key, but public URL failed. " +
          "Set storage.buckets.public = true for menu-data (run supabase/storage_buckets.sql).",
        { fullPath, publicUrl },
      );
    }
    // verified stays false unless the public URL works — website needs public
  }

  return { bucket, path, fullPath, publicUrl, verified, listedInBucket };
}

/** Upload local images → menu-images; return menu lines with public URLs. */
export async function uploadMenuImages(
  truckId: string,
  menu: MenuItem[],
): Promise<MenuItem[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");

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

/** Upload full menu + schedule JSON to menu-data/{truckId}/menu.json on every publish. */
export async function uploadMenuJson(truckId: string, json: StoredMenuJson): Promise<UploadResult> {
  const id = truckId.trim();
  if (!id) throw new Error("truckId is required");

  const path = menuJsonPath(id);
  const fullPath = menuJsonFullPath(id);
  const body = JSON.stringify(json, null, 2);
  const blob = new Blob([body], { type: "application/json" });
  const publicUrl = menuJsonPublicUrl(id);

  console.info(LOG, "═══ menu.json publish START ═══", {
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
    // One more authenticated check before failing hard — list can be flaky under RLS
    const authOk = await verifyAuthenticatedRead(MENU_DATA_BUCKET, path);
    if (!authOk) {
      throw new Error(
        `menu.json upload did not land at ${fullPath}. Check storage RLS / bucket exists.`,
      );
    }
    console.warn(LOG, "list missed file but authenticated read OK — treating as saved", {
      fullPath,
    });
    result.listedInBucket = true;
  }

  if (result.verified) {
    console.info(LOG, "═══ menu.json publish SUCCESS (public) ═══", {
      fullPath: result.fullPath,
      publicUrl: result.publicUrl,
      menuItems: json.menu.length,
      scheduleDays: json.schedule.length,
      publicReadable: true,
    });
  } else {
    console.warn(LOG, "═══ menu.json SAVED (API-readable; public URL not open yet) ═══", {
      fullPath: result.fullPath,
      publicUrl: result.publicUrl,
      menuItems: json.menu.length,
      scheduleDays: json.schedule.length,
      hint:
        "1) Run supabase/storage_buckets.sql. 2) Lovable Cloud: Settings → Privacy & security → disable “Block public storage buckets”. Cluckin Chaos still loads via authenticated download until then.",
    });
  }

  return result;
}

/**
 * Read menu.json for TruckDash preview + Cluckin Chaos public pages.
 *
 * Order (reliable):
 *   1. Public URL with cache busting (what the live website should use)
 *   2. Authenticated storage download (works while bucket is still private)
 */
export async function fetchMenuJson(truckId: string): Promise<StoredMenuJson | null> {
  if (!isSupabaseConfigured()) {
    console.warn(LOG, "fetch skipped — Supabase not configured");
    return null;
  }

  const id = truckId.trim();
  const path = menuJsonPath(id);
  const fullPath = menuJsonFullPath(id);
  const publicUrl = menuJsonPublicUrl(id);
  const bustUrl = menuJsonPublicUrlWithCacheBust(id);

  console.info(LOG, "fetch menu.json START", { fullPath, publicUrl, bustUrl });

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

  // 2) Authenticated / object API (works with publishable or anon key + SELECT policy)
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.storage.from(MENU_DATA_BUCKET).download(path);
    if (!error && data) {
      try {
        const parsed = JSON.parse(await data.text()) as StoredMenuJson;
        console.info(LOG, "✓ fetch OK (authenticated download)", {
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

  console.error(LOG, "fetch menu.json FAILED — no public or auth read", { fullPath, publicUrl });
  return null;
}
