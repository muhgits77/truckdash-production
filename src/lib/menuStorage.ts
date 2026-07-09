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
  ensureFreshSession,
  getAccessTokenForStorage,
  getAuthStatus,
  getStorageAuthHeaders,
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
  /** true when the object is publicly fetchable AND content matches what we wrote. */
  verified: boolean;
  /** true when the object shows up in the bucket listing (required for success). */
  listedInBucket: boolean;
  /** Bytes reported by storage list metadata (if available). */
  listedBytes?: number | null;
  /** Object id from list/download metadata. */
  objectId?: string | null;
};

export type BucketListVerification = {
  ok: boolean;
  folder: string;
  fileName: string;
  folderEntries: string[];
  rootEntries: string[];
  found: boolean;
  objectId: string | null;
  listedBytes: number | null;
  error?: string;
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

function splitStoragePath(path: string): { folder: string; fileName: string } {
  if (!path.includes("/")) return { folder: "", fileName: path };
  return {
    folder: path.slice(0, path.lastIndexOf("/")),
    fileName: path.slice(path.lastIndexOf("/") + 1),
  };
}

/**
 * Strict post-upload proof that the object is visible in Storage.
 *
 * Lists:
 *   1. bucket root (should show truck folder, e.g. cluckin-chaos)
 *   2. folder contents without search
 *   3. folder contents with search=fileName
 *
 * Requires a real file entry (id != null) named fileName — folders have id=null.
 * Does NOT soft-pass on download alone (that hid empty-bucket failures).
 */
export async function verifyBucketListing(
  bucket: string,
  path: string,
): Promise<BucketListVerification> {
  const supabase = getSupabase();
  const { folder, fileName } = splitStoragePath(path);
  const empty: BucketListVerification = {
    ok: false,
    folder,
    fileName,
    folderEntries: [],
    rootEntries: [],
    found: false,
    objectId: null,
    listedBytes: null,
  };

  if (!supabase) {
    return { ...empty, error: "Supabase client missing" };
  }

  console.info(LOG, "bucket list verification START", {
    bucket,
    path,
    folder: folder || "(root)",
    fileName,
    listApi: `${getSupabaseUrl()}/storage/v1/object/list/${bucket}`,
  });

  // Root listing — confirms folder appears (e.g. cluckin-chaos/)
  const root = await supabase.storage.from(bucket).list("", { limit: 100 });
  if (root.error) {
    console.error(LOG, "bucket root list FAILED", {
      bucket,
      message: root.error.message,
      hint: "SELECT RLS on storage.objects may be missing for this role",
    });
    return { ...empty, error: `root list: ${root.error.message}` };
  }
  const rootEntries = (root.data ?? []).map((f) => f.name);
  console.info(LOG, "bucket root list", { bucket, entries: rootEntries });

  if (folder && !rootEntries.includes(folder)) {
    console.error(LOG, "truck folder missing from bucket root", {
      bucket,
      expectedFolder: folder,
      rootEntries,
    });
    // Continue — some Storage versions only return files, not prefixes
  }

  // Folder listing WITHOUT search (most reliable)
  const folderList = await supabase.storage.from(bucket).list(folder, {
    limit: 100,
    sortBy: { column: "name", order: "asc" },
  });
  if (folderList.error) {
    console.error(LOG, "bucket folder list FAILED", {
      bucket,
      folder,
      message: folderList.error.message,
    });
    return {
      ...empty,
      rootEntries,
      error: `folder list: ${folderList.error.message}`,
    };
  }

  const folderEntries = (folderList.data ?? []).map((f) => f.name);
  const match = (folderList.data ?? []).find(
    (f) => f.name === fileName && f.id != null && f.id !== "",
  );

  // Search listing as second signal
  const searched = await supabase.storage.from(bucket).list(folder, {
    limit: 100,
    search: fileName,
  });
  const searchNames = (searched.data ?? []).map((f) => f.name);
  const searchMatch = (searched.data ?? []).find(
    (f) => f.name === fileName && f.id != null && f.id !== "",
  );

  const hit = match ?? searchMatch ?? null;
  const found = Boolean(hit);
  const objectId = hit?.id ?? null;
  const listedBytes =
    typeof hit?.metadata?.size === "number"
      ? (hit.metadata.size as number)
      : typeof (hit?.metadata as { contentLength?: number } | null)?.contentLength === "number"
        ? ((hit?.metadata as { contentLength: number }).contentLength as number)
        : null;

  console.info(LOG, "bucket list verification RESULT", {
    bucket,
    path,
    folder: folder || "(root)",
    fileName,
    found,
    objectId,
    listedBytes,
    folderEntries,
    searchNames,
    rootEntries,
    searchError: searched.error?.message,
  });

  if (!found) {
    console.error(LOG, "FILE NOT IN BUCKET LIST after upload", {
      bucket,
      path,
      fullPath: `${bucket}/${path}`,
      folderEntries,
      rootEntries,
      searchNames,
      hint: "Upload may have returned 200 without persisting, or RLS blocks SELECT. Run supabase/storage_buckets.sql",
    });
  }

  return {
    ok: found,
    folder,
    fileName,
    folderEntries,
    rootEntries,
    found,
    objectId,
    listedBytes,
    error: found ? undefined : "file not present in storage.list() after upload",
  };
}

/**
 * Download via authenticated Storage API and optionally match a content fingerprint.
 * Fingerprint = substring that must appear (e.g. lastPublished ISO string).
 */
async function verifyAuthenticatedContent(
  bucket: string,
  path: string,
  fingerprint?: string,
): Promise<{ ok: boolean; bytes: number; textPreview: string; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, bytes: 0, textPreview: "", error: "no client" };

  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    console.error(LOG, "authenticated download FAILED", {
      bucket,
      path,
      message: error?.message,
    });
    return { ok: false, bytes: 0, textPreview: "", error: error?.message ?? "no data" };
  }

  const text = await data.text();
  const hasFp = fingerprint ? text.includes(fingerprint) : true;
  console.info(LOG, "authenticated download", {
    bucket,
    path,
    bytes: data.size,
    fingerprintMatch: hasFp,
    fingerprint: fingerprint?.slice(0, 40),
    preview: text.slice(0, 120),
  });

  if (!hasFp) {
    return {
      ok: false,
      bytes: data.size,
      textPreview: text.slice(0, 200),
      error: "downloaded content does not match uploaded fingerprint",
    };
  }
  return { ok: true, bytes: data.size, textPreview: text.slice(0, 200) };
}

async function verifyPublicContent(
  publicUrl: string,
  fingerprint?: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const bustUrl = `${publicUrl}${publicUrl.includes("?") ? "&" : "?"}verify=${Date.now()}`;
  try {
    const res = await fetch(bustUrl, {
      cache: "no-store",
      headers: { Accept: "application/json,*/*" },
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      console.warn(LOG, "public URL not readable", {
        publicUrl,
        status: res.status,
        body: text.slice(0, 200),
        hint: "Ensure storage.buckets.public = true and public SELECT RLS (run storage_buckets.sql)",
      });
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    const hasFp = fingerprint ? text.includes(fingerprint) : true;
    console.info(LOG, "✓ public URL verified", {
      publicUrl,
      status: res.status,
      bytes: text.length,
      fingerprintMatch: hasFp,
    });
    if (!hasFp) {
      return {
        ok: false,
        status: res.status,
        error: "public content does not match uploaded fingerprint (stale CDN or wrong object)",
      };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    console.warn(LOG, "public URL verify threw", { publicUrl, err });
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Full post-upload gate: list + auth download + public URL.
 * Throws if the file is not actually in the bucket.
 */
async function assertUploadLanded(
  bucket: string,
  path: string,
  opts?: { fingerprint?: string; requirePublic?: boolean },
): Promise<{
  listed: BucketListVerification;
  verified: boolean;
  listedInBucket: boolean;
  objectId: string | null;
  listedBytes: number | null;
}> {
  const fullPath = `${bucket}/${path}`;
  const publicUrl = publicStorageUrl(bucket, path);
  const fingerprint = opts?.fingerprint;
  const requirePublic = opts?.requirePublic ?? bucket === MENU_DATA_BUCKET;

  // Brief retry — Storage list can lag a tick after upsert
  let listed = await verifyBucketListing(bucket, path);
  if (!listed.ok) {
    for (const waitMs of [250, 500, 1000]) {
      console.warn(LOG, `list miss — retry in ${waitMs}ms`, { fullPath });
      await new Promise((r) => setTimeout(r, waitMs));
      listed = await verifyBucketListing(bucket, path);
      if (listed.ok) break;
    }
  }

  if (!listed.ok) {
    // Extra diagnostics: download may still work while list is RLS-blocked
    const dl = await verifyAuthenticatedContent(bucket, path, fingerprint);
    console.error(LOG, "UPLOAD DID NOT LAND IN BUCKET LIST", {
      fullPath,
      publicUrl,
      listError: listed.error,
      folderEntries: listed.folderEntries,
      rootEntries: listed.rootEntries,
      downloadOk: dl.ok,
      downloadError: dl.error,
    });
    throw new Error(
      `Upload reported OK but storage.list() does not show ${fullPath}. ` +
        `folderEntries=[${listed.folderEntries.join(", ") || "empty"}] ` +
        `rootEntries=[${listed.rootEntries.join(", ") || "empty"}]. ` +
        `Check RLS SELECT on storage.objects for bucket "${bucket}" (run supabase/storage_buckets.sql). ` +
        (listed.error ? `listError=${listed.error}` : ""),
    );
  }

  const dl = await verifyAuthenticatedContent(bucket, path, fingerprint);
  if (!dl.ok) {
    throw new Error(
      `File listed at ${fullPath} but authenticated download failed or content mismatch: ${dl.error}`,
    );
  }

  const pub = await verifyPublicContent(publicUrl, fingerprint);
  if (requirePublic && !pub.ok) {
    throw new Error(
      `File is in bucket at ${fullPath} but public URL failed (${pub.error}). ` +
        `Set storage.buckets.public=true for "${bucket}" and ensure public read RLS. URL: ${publicUrl}`,
    );
  }
  if (!pub.ok) {
    console.warn(LOG, "public verify soft-fail (not required for this bucket)", {
      fullPath,
      publicUrl,
      error: pub.error,
    });
  }

  console.info(LOG, "✓ upload landed (list + download + public)", {
    fullPath,
    publicUrl,
    objectId: listed.objectId,
    listedBytes: listed.listedBytes,
    publicOk: pub.ok,
    fingerprint: fingerprint?.slice(0, 40),
  });

  return {
    listed,
    verified: pub.ok,
    listedInBucket: true,
    objectId: listed.objectId,
    listedBytes: listed.listedBytes,
  };
}

/**
 * Classify Storage API error bodies so we don't mislabel auth/key mismatches as RLS.
 */
function classifyStorageError(status: number, body: string): {
  kind: "missing-auth" | "invalid-key" | "rls" | "not-found" | "other";
  message: string;
} {
  const text = body || "";
  if (
    /required property ['"]?authorization['"]?/i.test(text) ||
    /missing.*authorization/i.test(text)
  ) {
    return {
      kind: "missing-auth",
      message:
        "Storage rejected the request: Authorization header missing. " +
        "Always send Authorization: Bearer <anon JWT | session JWT> and apikey: <anon key>.",
    };
  }
  if (/invalid compact jws|invalid api key|invalid jwt|jwsError/i.test(text)) {
    return {
      kind: "invalid-key",
      message:
        `Storage rejected the API key (${status}): ${text.slice(0, 180)}. ` +
        `VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be from the same project.`,
    };
  }
  if (
    /row-level security|violates row-level/i.test(text) ||
    (/Unauthorized/i.test(text) && /policy/i.test(text))
  ) {
    return {
      kind: "rls",
      message:
        `Storage RLS blocked the write (${status}). ` +
        `Run supabase/storage_buckets.sql in the SQL Editor (or: npx tsx scripts/setup-storage.mts with SUPABASE_SERVICE_ROLE_KEY). ` +
        `Detail: ${text.slice(0, 200)}`,
    };
  }
  if (/bucket not found|not_found/i.test(text) || status === 404) {
    return {
      kind: "not-found",
      message:
        `Storage bucket/object not found (${status}). ` +
        `Create menu-data + menu-images via supabase/storage_buckets.sql. Detail: ${text.slice(0, 160)}`,
    };
  }
  return { kind: "other", message: `Storage error (${status}): ${text.slice(0, 300) || "unknown"}` };
}

function describeBearerForLog(token: string): string {
  if (!token) return "empty";
  if (token.startsWith("sb_publishable_")) return "publishable-key";
  if (token.startsWith("sb_secret_")) return "secret-key";
  if (token.split(".").length === 3) return "jwt";
  return "other";
}

const BUCKET_SPECS: Record<
  string,
  { public: boolean; fileSizeLimit: number; allowedMimeTypes: string[] }
> = {
  [MENU_DATA_BUCKET]: {
    public: true,
    fileSizeLimit: 5_242_880,
    allowedMimeTypes: ["application/json", "application/octet-stream", "text/plain"],
  },
  [MENU_IMAGES_BUCKET]: {
    public: true,
    fileSizeLimit: 10_485_760,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/jpg"],
  },
};

function storageAdminHeaders(fallbackAuth: Record<string, string>): Record<string, string> {
  const serviceKey =
    (typeof process !== "undefined" &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || "")?.trim()) ||
    "";
  const bearer =
    serviceKey ||
    fallbackAuth.Authorization?.replace(/^Bearer\s+/i, "").trim() ||
    getSupabaseAnonKey();
  const apikey = serviceKey || fallbackAuth.apikey || getSupabaseAnonKey();
  return {
    apikey,
    Authorization: `Bearer ${bearer}`,
    "Content-Type": "application/json",
  };
}

/**
 * Create bucket if missing. Anon usually cannot insert into storage.buckets —
 * service role or storage_buckets.sql is required for a fresh project.
 */
async function ensureBucketExists(
  bucket: string,
  authHeaders: Record<string, string>,
): Promise<"ready" | "created" | "missing"> {
  const base = getSupabaseUrl();
  const spec = BUCKET_SPECS[bucket] ?? {
    public: true,
    fileSizeLimit: 5_242_880,
    allowedMimeTypes: ["*/*"],
  };
  const headers = storageAdminHeaders(authHeaders);
  const usingService = Boolean(
    typeof process !== "undefined" && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );

  // GET /bucket/{id} is the reliable missing-bucket signal on stock Supabase
  const infoRes = await fetch(`${base}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
    headers,
  });
  if (infoRes.ok) {
    const info = (await infoRes.json().catch(() => null)) as { public?: boolean } | null;
    console.info(LOG, "ensureBucket: exists", {
      bucket,
      public: info?.public,
      usingServiceRole: usingService,
    });
    if (info && info.public === false) {
      console.warn(
        LOG,
        `bucket "${bucket}" is private — public menu URLs may fail. Re-run storage_buckets.sql (public=true).`,
      );
    }
    return "ready";
  }

  const infoBody = (await infoRes.text().catch(() => "")).slice(0, 200);
  console.info(LOG, "ensureBucket: not found or inaccessible — attempting create", {
    bucket,
    status: infoRes.status,
    infoBody,
    usingServiceRole: usingService,
  });

  const createRes = await fetch(`${base}/storage/v1/bucket`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: bucket,
      name: bucket,
      public: spec.public,
      file_size_limit: spec.fileSizeLimit,
      allowed_mime_types: spec.allowedMimeTypes,
    }),
  });

  if (createRes.ok || createRes.status === 200 || createRes.status === 201) {
    console.info(LOG, "ensureBucket: created", { bucket, status: createRes.status });
    return "created";
  }

  const detail = (await createRes.text().catch(() => "")).slice(0, 300);
  if (/already exists|duplicate/i.test(detail) || createRes.status === 409) {
    console.info(LOG, "ensureBucket: already exists (race)", { bucket });
    return "ready";
  }

  console.warn(LOG, "ensureBucket: create blocked — run SQL setup", {
    bucket,
    status: createRes.status,
    detail,
    hint: usingService
      ? "Service role create failed — check project URL/key"
      : "Anon cannot create buckets. Run supabase/storage_buckets.sql or set SUPABASE_SERVICE_ROLE_KEY and run scripts/setup-storage.mts",
  });
  return "missing";
}

/**
 * Preflight: Authorization present + bucket usable.
 *
 * Stock Supabase quirk: anon GET /bucket/{id} often returns 404 even when the
 * public bucket exists. Prefer:
 *   1) service-role GET/create when available
 *   2) POST /object/list as the anon existence signal
 */
async function assertStorageReady(bucket: string): Promise<void> {
  const base = getSupabaseUrl();
  const authHeaders = await getStorageAuthHeaders();
  const bearer = authHeaders.Authorization?.replace(/^Bearer\s+/i, "").trim();

  if (!bearer) {
    throw new Error(
      "Storage Authorization header is empty. Set VITE_SUPABASE_ANON_KEY (or sign in).",
    );
  }

  const status = await ensureBucketExists(bucket, authHeaders);
  if (status === "ready" || status === "created") {
    console.info(LOG, "bucket ready", {
      bucket,
      status,
      supabaseHost: base,
      auth: describeBearerForLog(bearer),
    });
    return;
  }

  // Anon cannot always GET /bucket/{id} — list is the real probe
  const listRes = await fetch(`${base}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
    method: "POST",
    headers: {
      apikey: authHeaders.apikey || getSupabaseAnonKey(),
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefix: "", limit: 1 }),
  });

  if (listRes.ok) {
    console.info(LOG, "bucket ready (anon list probe)", {
      bucket,
      supabaseHost: base,
      auth: describeBearerForLog(bearer),
    });
    return;
  }

  const detail = (await listRes.text().catch(() => "")).slice(0, 240);
  throw new Error(
    `Storage bucket "${bucket}" is not usable on ${base} (list ${listRes.status}). ` +
      `Run supabase/storage_buckets.sql or: SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/setup-storage.mts. ` +
      `Detail: ${detail}`,
  );
}

/**
 * Prefer server upload (service role) so Publish works without anon INSERT RLS.
 * Falls back cleanly when SSR/server fn is unavailable (pure static, tests, etc.).
 */
async function uploadViaServerFn(
  bucket: string,
  path: string,
  body: Blob,
  contentType: string,
): Promise<void> {
  // Dynamic import keeps this optional for non-Start environments (scripts).
  const { serverUploadStorageObject } = await import("./storage-publish.fn");

  const isBinary = !contentType.includes("json") && !contentType.startsWith("text/");
  let payload: string;
  let base64 = false;

  if (isBinary) {
    const buf = new Uint8Array(await body.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    payload = btoa(binary);
    base64 = true;
  } else {
    payload = await body.text();
  }

  console.info(LOG, "server upload attempt", { bucket, path, contentType, base64 });
  const result = await serverUploadStorageObject({
    data: { bucket, path, body: payload, contentType, base64 },
  });
  console.info(LOG, "server upload OK", result);
}

/**
 * PRIMARY client upload path: raw Storage REST with explicit Authorization.
 *
 * Why not rely only on supabase.storage.upload()?
 *   storage-js wraps Blob bodies in FormData. Combined with publishable keys
 *   and custom fetch, Authorization can be dropped → 400
 *   "headers must have required property 'authorization'".
 *
 * We always send:
 *   Authorization: Bearer <session JWT | anon/publishable key>
 *   apikey: <anon/publishable key>
 */
async function uploadViaRest(
  bucket: string,
  path: string,
  body: Blob | ArrayBuffer | string,
  contentType: string,
): Promise<void> {
  const base = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!base || !anonKey) throw new Error("Supabase env vars missing for REST upload");

  const access = await getAccessTokenForStorage();
  const authHeaders = await getStorageAuthHeaders();
  const bearer = authHeaders.Authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) {
    throw new Error(
      "Refusing Storage upload: Authorization bearer token is empty (would cause 400)",
    );
  }

  // BodyInit-safe payload (avoid Uint8Array typing issues across TS/DOM libs)
  const payload: Blob | ArrayBuffer | string =
    body instanceof Blob || typeof body === "string" || body instanceof ArrayBuffer
      ? body
      : new Blob([body as BlobPart], { type: contentType });

  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `${base}/storage/v1/object/${bucket}/${encodedPath}`;
  const bytes =
    typeof payload === "string"
      ? payload.length
      : payload instanceof Blob
        ? payload.size
        : payload.byteLength;

  // Prefer service-role bearer when available (Node/SSR); else session/anon.
  // apikey must match the elevated key when using service_role.
  const headers: Record<string, string> = {
    apikey: authHeaders.apikey || anonKey,
    Authorization: authHeaders.Authorization || `Bearer ${access.token || anonKey}`,
    "Content-Type": contentType || "application/octet-stream",
    "x-upsert": "true",
    "cache-control": "30",
  };

  // Final hard assert — Storage OpenAPI requires these
  if (!headers.Authorization || !headers.Authorization.replace(/^Bearer\s+/i, "").trim()) {
    headers.Authorization = `Bearer ${access.token || anonKey}`;
  }
  if (!headers.apikey) {
    headers.apikey =
      access.kind === "service-role" ? access.token : anonKey;
  }
  if (access.kind === "service-role") {
    // Both headers must be the service_role JWT for Storage to bypass RLS
    headers.apikey = access.token;
    headers.Authorization = `Bearer ${access.token}`;
  }

  console.info(LOG, "REST upload (primary path)", {
    bucket,
    path,
    url,
    bytes,
    supabaseHost: base,
    authKind: access.kind,
    authEmail: access.email,
    hasAuthorization: Boolean(headers.Authorization),
    hasApikey: Boolean(headers.apikey),
    contentType: headers["Content-Type"],
  });

  let res = await fetch(url, { method: "POST", headers, body: payload });
  // Upsert may need PUT on some Storage versions / conflict responses
  if (!res.ok && (res.status === 400 || res.status === 409 || res.status === 405)) {
    const peek = (await res.clone().text().catch(() => "")).slice(0, 400);
    const classified = classifyStorageError(res.status, peek);

    // Auth / key / RLS are hard fails — do not mask with PUT retry
    if (
      classified.kind === "missing-auth" ||
      classified.kind === "invalid-key" ||
      classified.kind === "rls"
    ) {
      console.error(LOG, "REST upload hard-fail", {
        status: res.status,
        kind: classified.kind,
        authKind: access.kind,
        hasAuthorization: Boolean(headers.Authorization),
        authorizationPreview: (headers.Authorization || "").slice(0, 28) + "…",
        hasApikey: Boolean(headers.apikey),
        peek,
      });
      throw new Error(classified.message);
    }

    console.warn(LOG, "REST POST not accepted — trying PUT", {
      status: res.status,
      kind: classified.kind,
      peek,
    });
    res = await fetch(url, { method: "PUT", headers, body: payload });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(LOG, "REST upload FAILED", {
      bucket,
      path,
      status: res.status,
      authKind: access.kind,
      detail: detail.slice(0, 500),
    });
    const classified = classifyStorageError(res.status, detail);
    throw new Error(classified.message);
  }

  console.info(LOG, "REST upload OK", {
    bucket,
    path,
    status: res.status,
    authKind: access.kind,
  });
}

/**
 * Secondary path: supabase-js storage.upload with explicit Authorization.
 * Uses ArrayBuffer (not Blob) so storage-js does NOT wrap body in FormData.
 */
async function uploadViaClient(
  bucket: string,
  path: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase client missing");

  const access = await getAccessTokenForStorage();
  const authHeaders = await getStorageAuthHeaders();

  console.info(LOG, "client upload attempt", {
    bucket,
    path,
    bytes: body.byteLength,
    authKind: access.kind,
    hasAuthorization: Boolean(authHeaders.Authorization),
  });

  // Pass raw ArrayBuffer → storage-js sets content-type on headers (no FormData).
  // Also inject Authorization via fileOptions.headers for belt-and-suspenders.
  const { data, error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType,
    cacheControl: "30",
    upsert: true,
    headers: {
      Authorization: authHeaders.Authorization,
      apikey: authHeaders.apikey,
    },
  });

  if (error) {
    console.warn(LOG, "client upload failed", {
      message: error.message,
      authKind: access.kind,
    });
    throw new Error(error.message);
  }

  console.info(LOG, "client upload OK", {
    path: data?.path,
    fullPath: data?.fullPath,
    id: data?.id,
    authKind: access.kind,
  });
}

/**
 * Upload (overwrite) to Supabase Storage at {bucket}/{path}.
 *
 * Order:
 *   1. REST with explicit Authorization (primary — avoids FormData auth bugs)
 *   2. supabase-js client with ArrayBuffer + explicit headers (fallback)
 *   3. Hard list + download + public URL verification
 */
async function uploadObject(
  bucket: string,
  path: string,
  body: Blob,
  contentType: string,
  opts?: { fingerprint?: string; requirePublic?: boolean },
): Promise<UploadResult> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).",
    );
  }

  if (!getSupabase()) {
    throw new Error("Supabase client could not be created from env vars.");
  }

  const fullPath = `${bucket}/${path}`;
  const publicUrl = publicStorageUrl(bucket, path);
  const supabaseHost = getSupabaseUrl();
  const uploadApiUrl = `${supabaseHost}/storage/v1/object/${bucket}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  const session = await ensureFreshSession();
  const authStatus = await getAuthStatus();
  const access = await getAccessTokenForStorage();

  // Pre-flight: Authorization non-empty + bucket exists
  const authHeaders = await getStorageAuthHeaders();
  if (!authHeaders.Authorization || !bareToken(authHeaders.Authorization)) {
    throw new Error(
      "Cannot upload: Authorization header would be empty. Sign in or set a valid API key.",
    );
  }
  await assertStorageReady(bucket);

  console.info(LOG, "upload start → Supabase Storage", {
    supabaseHost,
    bucket,
    path,
    fullPath,
    uploadApiUrl,
    contentType,
    bytes: body.size,
    publicUrl,
    fingerprint: opts?.fingerprint?.slice(0, 48),
    auth: {
      signedIn: authStatus.signedIn,
      email: authStatus.email,
      userId: authStatus.userId,
      hasJwt: authStatus.hasJwt,
      tokenKind: access.kind,
      keyType: authStatus.keyType,
      sessionPresent: Boolean(session),
      expiresAt: authStatus.expiresAt,
      authorizationReady: true,
    },
  });

  if (!authStatus.signedIn) {
    console.info(LOG, "anonymous publish — Authorization uses API key", {
      fullPath,
      keyType: authStatus.keyType,
    });
  } else {
    console.info(LOG, "authenticated publish — Authorization uses session JWT", {
      email: authStatus.email,
      userId: authStatus.userId,
    });
  }

  const errors: string[] = [];

  // 0) Server path first (service role on server — works before anon INSERT RLS)
  try {
    await uploadViaServerFn(bucket, path, body, contentType);
  } catch (serverErr) {
    const serverMsg = serverErr instanceof Error ? serverErr.message : String(serverErr);
    errors.push(`server=${serverMsg}`);
    console.warn(LOG, "server upload unavailable/failed — trying client REST", { serverMsg });

    // 1) REST with explicit Authorization (anon / session JWT in browser)
    try {
      await uploadViaRest(bucket, path, body, contentType);
    } catch (restErr) {
      const restMsg = restErr instanceof Error ? restErr.message : String(restErr);
      errors.push(`REST=${restMsg}`);
      console.warn(LOG, "REST upload failed — trying client path", { restMsg });

      // 2) Client fallback with ArrayBuffer (not Blob) + explicit headers
      try {
        const buffer = await body.arrayBuffer();
        await uploadViaClient(bucket, path, buffer, contentType);
      } catch (clientErr) {
        const clientMsg = clientErr instanceof Error ? clientErr.message : String(clientErr);
        errors.push(`client=${clientMsg}`);
        throw new Error(
          `Supabase Storage upload failed at ${fullPath} (host ${supabaseHost}): ${errors.join(" | ")}. ` +
            `If RLS: run supabase/storage_buckets.sql. If server path: set SUPABASE_SERVICE_ROLE_KEY (no VITE_ prefix).`,
        );
      }
    }
  }

  // 3) HARD proof: list bucket → download content → public URL
  const proof = await assertUploadLanded(bucket, path, {
    fingerprint: opts?.fingerprint,
    requirePublic: opts?.requirePublic ?? bucket === MENU_DATA_BUCKET,
  });

  return {
    bucket,
    path,
    fullPath,
    publicUrl,
    verified: proof.verified,
    listedInBucket: proof.listedInBucket,
    listedBytes: proof.listedBytes,
    objectId: proof.objectId,
  };
}

function bareToken(authorization: string): string {
  return authorization.replace(/^Bearer\s+/i, "").trim();
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

  // Fingerprint forces list/download/public to match THIS publish, not a stale object
  const fingerprint = json.lastPublished || `truckId": "${id}"`;

  console.info(LOG, "═══ menu.json → Supabase Storage START ═══", {
    supabaseHost,
    truckId: id,
    bucket: MENU_DATA_BUCKET,
    objectPath: path,
    fullPath,
    publicUrl,
    uploadApi: `${supabaseHost}/storage/v1/object/${MENU_DATA_BUCKET}/${path}`,
    listApi: `${supabaseHost}/storage/v1/object/list/${MENU_DATA_BUCKET}`,
    menuItems: json.menu.length,
    scheduleDays: json.schedule.length,
    lastPublished: json.lastPublished,
    fingerprint,
    bytes: blob.size,
  });

  const result = await uploadObject(MENU_DATA_BUCKET, path, blob, "application/json", {
    fingerprint,
    requirePublic: true,
  });

  if (!result.listedInBucket || !result.verified) {
    throw new Error(
      `menu.json did not fully land at ${fullPath} (host ${supabaseHost}). ` +
        `listed=${result.listedInBucket} public=${result.verified}. ` +
        `Check bucket public=true + storage RLS (supabase/storage_buckets.sql).`,
    );
  }

  // Final explicit post-upload list (logged for debugging empty-bucket reports)
  const finalList = await verifyBucketListing(MENU_DATA_BUCKET, path);
  console.info(LOG, "═══ post-upload bucket list (required) ═══", {
    fullPath,
    found: finalList.found,
    objectId: finalList.objectId,
    listedBytes: finalList.listedBytes,
    folderEntries: finalList.folderEntries,
    rootEntries: finalList.rootEntries,
  });
  if (!finalList.ok) {
    throw new Error(
      `Post-upload bucket list empty for ${fullPath}. Entries: [${finalList.folderEntries.join(", ")}]`,
    );
  }

  console.info(LOG, "═══ menu.json publish SUCCESS (listed + public) ═══", {
    supabaseHost,
    fullPath: result.fullPath,
    publicUrl: result.publicUrl,
    objectId: result.objectId,
    listedBytes: result.listedBytes,
    menuItems: json.menu.length,
    scheduleDays: json.schedule.length,
    publicReadable: true,
    listedInBucket: true,
  });

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
