/**
 * Supabase Storage — menu JSON + food photos.
 * Buckets: menu-data (JSON), menu-images (photos).
 *
 * menu.json path: menu-data/{truckId}/menu.json (public read)
 */

import type { MenuItem } from "./truck-state";
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
  schedule: import("./truck-state").ScheduleDay[];
  lastPublished: string;
  version: number;
};

export type UploadResult = {
  bucket: string;
  path: string;
  /** Full storage path including bucket, e.g. menu-data/cluckin-chaos/menu.json */
  fullPath: string;
  publicUrl: string;
  verified: boolean;
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

function toUploadBlob(body: Blob | Uint8Array, contentType: string): Blob {
  if (body instanceof Blob) return body;
  return new Blob([body], { type: contentType });
}

type AuthContext = {
  accessToken: string;
  email: string | null;
};

/** Refresh session and require signed-in owner (RLS). */
async function requireAuthSession(): Promise<AuthContext> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    console.warn(LOG, "session refresh failed — using existing session", refreshError.message);
  }

  const session = refreshData.session ?? (await supabase.auth.getSession()).data.session;
  const user = session?.user ?? (await supabase.auth.getUser()).data.user;

  console.info(LOG, "auth session", {
    signedIn: !!user,
    email: user?.email ?? null,
    hasAccessToken: !!session?.access_token,
    refreshError: refreshError?.message ?? null,
  });

  if (!user || !session?.access_token) {
    throw new Error(
      "Sign in as the truck owner in Settings before publishing to menu-data storage.",
    );
  }

  return { accessToken: session.access_token, email: user.email ?? null };
}

/** Verify the object is publicly readable (bucket must be public). */
async function verifyPublicUrl(publicUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${publicUrl}?verify=${Date.now()}`, { cache: "no-store" });
    console.info(LOG, "public verify", { status: res.status, ok: res.ok, url: publicUrl });
    return res.ok;
  } catch (err) {
    console.error(LOG, "public verify FAILED", { url: publicUrl, err });
    return false;
  }
}

/** Confirm menu.json exists in bucket listing at {truckId}/menu.json */
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
  console.info(LOG, "bucket list", {
    bucket,
    path,
    folder,
    fileName,
    found,
    entries: (data ?? []).map((f) => f.name),
  });
  return found;
}

/** REST fallback when JS client upload fails (same path, x-upsert). */
async function uploadViaRest(
  bucket: string,
  path: string,
  body: Blob,
  contentType: string,
  accessToken: string,
): Promise<void> {
  const base = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const url = `${base}/storage/v1/object/${bucket}/${encodedPath}`;

  console.info(LOG, "REST upload attempt", { bucket, path, url, bytes: body.size });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
 * Upload (overwrite) a file to a public bucket at exactly {bucket}/{path}.
 * Strategy: remove → client upload → REST fallback → list + public verify.
 */
async function uploadObject(
  bucket: string,
  path: string,
  body: Blob | Uint8Array,
  contentType: string,
): Promise<UploadResult> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not configured");

  const auth = await requireAuthSession();
  const blob = toUploadBlob(body, contentType);
  const fullPath = `${bucket}/${path}`;
  const publicUrl = publicStorageUrl(bucket, path);

  console.info(LOG, "upload start", {
    bucket,
    path,
    fullPath,
    contentType,
    bytes: blob.size,
    publicUrl,
    owner: auth.email,
  });

  const { error: removeError } = await supabase.storage.from(bucket).remove([path]);
  if (removeError) {
    console.info(LOG, "remove skipped (may not exist yet)", {
      fullPath,
      message: removeError.message,
    });
  } else {
    console.info(LOG, "removed existing object", { fullPath });
  }

  let uploadData: { path: string; id?: string; fullPath?: string } | null = null;
  let uploadError: { message: string; name?: string } | null = null;

  const { data, error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType,
    cacheControl: "30",
    upsert: true,
  });

  uploadData = data;
  uploadError = error;

  if (error && /already exists|duplicate/i.test(error.message)) {
    console.warn(LOG, "client upload duplicate — trying update()", {
      fullPath,
      message: error.message,
    });
    const upd = await supabase.storage.from(bucket).update(path, blob, {
      contentType,
      cacheControl: "30",
      upsert: true,
    });
    uploadData = upd.data;
    uploadError = upd.error;
  }

  if (uploadError) {
    console.warn(LOG, "client upload FAILED — trying REST fallback", {
      fullPath,
      message: uploadError.message,
      name: uploadError.name,
    });
    try {
      await uploadViaRest(bucket, path, blob, contentType, auth.accessToken);
      uploadError = null;
    } catch (restErr) {
      const restMsg = restErr instanceof Error ? restErr.message : String(restErr);
      console.error(LOG, "upload FAILED (client + REST)", {
        fullPath,
        clientError: uploadError.message,
        restError: restMsg,
      });
      throw new Error(
        `Storage upload failed at ${fullPath}: ${uploadError.message} | REST: ${restMsg}`,
      );
    }
  }

  console.info(LOG, "upload OK", {
    fullPath,
    id: uploadData?.id,
    storageFullPath: uploadData?.fullPath,
    publicUrl,
  });

  const listedInBucket = await verifyBucketListing(bucket, path);
  if (!listedInBucket) {
    console.error(LOG, "upload OK but file NOT listed in bucket", { fullPath, publicUrl });
  }

  const verified = await verifyPublicUrl(publicUrl);
  if (!verified) {
    console.error(LOG, "upload OK but public URL not readable", {
      fullPath,
      publicUrl,
      hint: "Run supabase/storage_buckets.sql and ensure bucket is public",
    });
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

/**
 * Upload menu.json to menu-data/{truckId}/menu.json on every publish.
 * Requires authenticated owner (RLS). Bucket must be public for website read.
 */
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
      `menu.json upload did not appear in bucket listing at ${fullPath}. Check RLS policies in storage_buckets.sql.`,
    );
  }

  if (!result.verified) {
    console.warn(
      LOG,
      "menu.json saved but public URL not verified — bucket may not be public",
      result.publicUrl,
    );
  }

  console.info(LOG, "menu.json publish SUCCESS", {
    fullPath: result.fullPath,
    publicUrl: result.publicUrl,
    publicVerified: result.verified,
    listedInBucket: result.listedInBucket,
    menuItems: json.menu.length,
  });

  return result;
}

/** Public read — TruckDash preview + Cluckin Chaos. */
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