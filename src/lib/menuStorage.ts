/**
 * Supabase Storage — menu JSON + food photos.
 * Buckets: menu-data (JSON), menu-images (photos).
 *
 * menu.json path: menu-data/{truckId}/menu.json
 * Storage RLS allows anon read + write for both buckets (see migrations),
 * so Publish works without owner sign-in and the public website can fetch
 * the JSON directly once the buckets are flipped to public in workspace
 * Privacy & Security.
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

/** Try public URL first; if bucket is private that returns 400, so fall back
 *  to the authenticated object endpoint with the anon key. Either success
 *  proves the object exists and is readable. */
async function verifyReadable(bucket: string, path: string): Promise<boolean> {
  const pub = publicStorageUrl(bucket, path);
  try {
    const res = await fetch(`${pub}?verify=${Date.now()}`, { cache: "no-store" });
    if (res.ok) {
      console.info(LOG, "verify PUBLIC ok", { pub });
      return true;
    }
    console.info(LOG, "public verify not ok — trying authenticated read", { pub, status: res.status });
  } catch (err) {
    console.warn(LOG, "public verify threw — trying authenticated read", err);
  }

  const supabase = getSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    console.error(LOG, "authenticated verify FAILED", { bucket, path, message: error?.message });
    return false;
  }
  console.info(LOG, "verify AUTH ok (bucket is private — flip public in Cloud settings for website read)", {
    bucket,
    path,
  });
  return false; // reachable, but not publicly reachable
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

  console.info(LOG, "REST upload attempt", { bucket, path, url, bytes: body.size });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      "Content-Type": contentType,
      "x-upsert": "true",
      "cache-control": "30",
    },
    body,
  });

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
 * No auth required — buckets use anon-writable RLS.
 * Strategy: client upsert → REST fallback → list + read verify.
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

  // Upsert via JS client
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

  const listedInBucket = await verifyBucketListing(bucket, path);
  if (!listedInBucket) {
    console.error(LOG, "upload reported OK but file NOT in bucket listing", { fullPath });
  }
  const verified = await verifyReadable(bucket, path);

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

/** Upload menu.json to menu-data/{truckId}/menu.json on every publish. */
export async function uploadMenuJson(truckId: string, json: StoredMenuJson): Promise<UploadResult> {
  const id = truckId.trim();
  if (!id) throw new Error("truckId is required");

  const path = menuJsonPath(id);
  const fullPath = menuJsonFullPath(id);
  const body = JSON.stringify(json, null, 2);
  const blob = new Blob([body], { type: "application/json" });

  console.info(LOG, "menu.json publish START", {
    truckId: id,
    fullPath,
    menuItems: json.menu.length,
    scheduleDays: json.schedule.length,
    lastPublished: json.lastPublished,
    bytes: blob.size,
    publicUrl: publicStorageUrl(MENU_DATA_BUCKET, path),
  });

  const result = await uploadObject(MENU_DATA_BUCKET, path, blob, "application/json");

  if (!result.listedInBucket) {
    throw new Error(
      `menu.json upload did not appear in bucket listing at ${fullPath}. Check storage RLS.`,
    );
  }

  if (!result.verified) {
    console.warn(
      LOG,
      "menu.json saved but public URL not verified — bucket is private. " +
        "Flip menu-data + menu-images to public in workspace Privacy & Security " +
        "so the website can read it.",
      result.publicUrl,
    );
  }

  console.info(LOG, "menu.json publish SUCCESS", {
    fullPath: result.fullPath,
    publicUrl: result.publicUrl,
    publicReadable: result.verified,
    listedInBucket: result.listedInBucket,
    menuItems: json.menu.length,
  });

  return result;
}

/** Public / authenticated read — TruckDash preview + external website. */
export async function fetchMenuJson(truckId: string): Promise<StoredMenuJson | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabase();
  if (!supabase) return null;

  const path = menuJsonPath(truckId);
  const fullPath = menuJsonFullPath(truckId);
  const publicUrl = publicStorageUrl(MENU_DATA_BUCKET, path);

  console.info(LOG, "fetch menu.json", { fullPath, publicUrl });

  const { data, error } = await supabase.storage.from(MENU_DATA_BUCKET).download(path);

  if (!error && data) {
    try {
      const parsed = JSON.parse(await data.text()) as StoredMenuJson;
      console.info(LOG, "fetch OK (client)", { fullPath, menu: parsed.menu?.length ?? 0 });
      return parsed;
    } catch (parseErr) {
      console.error(LOG, "invalid JSON from storage", { fullPath, parseErr });
    }
  } else if (error) {
    console.warn(LOG, "client download failed, trying public URL", { fullPath, message: error.message });
  }

  try {
    const res = await fetch(`${publicUrl}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) {
      console.warn(LOG, "public fetch failed", { fullPath, status: res.status, publicUrl });
      return null;
    }
    const parsed = (await res.json()) as StoredMenuJson;
    console.info(LOG, "fetch OK (public URL)", { fullPath, menu: parsed.menu?.length ?? 0 });
    return parsed;
  } catch (err) {
    console.error(LOG, "fetch failed", { fullPath, err });
    return null;
  }
}
