/**
 * Server-side Storage publish (service role).
 *
 * Browser Publish calls this so writes work even before/without anon INSERT RLS.
 * Service role stays on the server only — never use a VITE_ prefix for it.
 *
 * Env loading (do not import node:fs here — this module is referenced from the client):
 *   - vite.config.ts plugin loads SUPABASE_* into process.env at startup
 *   - src/server.ts calls loadServerEnv() for SSR
 *   - Vercel/host injects SUPABASE_SERVICE_ROLE_KEY into process.env in production
 */
import { createServerFn } from "@tanstack/react-start";

export type ServerStorageUploadInput = {
  bucket: string;
  path: string;
  /** UTF-8 text or base64 for binary */
  body: string;
  contentType: string;
  /** When true, `body` is base64 (images). Default: UTF-8 text (menu.json). */
  base64?: boolean;
};

export type ServerStorageUploadResult = {
  ok: true;
  bucket: string;
  path: string;
  fullPath: string;
  status: number;
};

function readServerEnv(name: string): string {
  if (typeof process === "undefined" || !process.env) return "";
  return (process.env[name] ?? "").trim();
}

function getServerSupabaseConfig(): { url: string; key: string; keyKind: string } {
  const url = (
    readServerEnv("VITE_SUPABASE_URL") ||
    readServerEnv("SUPABASE_URL")
  ).replace(/\/+$/, "");

  // Prefer service role (bypasses RLS). Fall back to anon so misconfig is obvious.
  const service = readServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anon =
    readServerEnv("VITE_SUPABASE_ANON_KEY") ||
    readServerEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    readServerEnv("SUPABASE_ANON_KEY") ||
    readServerEnv("SUPABASE_PUBLISHABLE_KEY");

  const key = service || anon;
  if (!url || !key) {
    throw new Error(
      "Server Storage upload misconfigured. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (preferred) or VITE_SUPABASE_ANON_KEY.",
    );
  }

  if (!service) {
    console.warn(
      "[storage-publish.fn] SUPABASE_SERVICE_ROLE_KEY missing — server upload will use anon and may hit RLS. " +
        "Add it to .env (no VITE_ prefix) and Vercel server env. Restart dev server after adding.",
    );
  }

  return {
    url,
    key,
    keyKind: service ? "service_role" : "anon",
  };
}

/**
 * Upload (upsert) an object using the server's Supabase key.
 * Intended for Publish: menu-data/{truckId}/menu.json and menu-images.
 */
export const serverUploadStorageObject = createServerFn({ method: "POST" })
  .validator((input: ServerStorageUploadInput) => {
    if (!input?.bucket?.trim()) throw new Error("bucket required");
    if (!input?.path?.trim()) throw new Error("path required");
    if (typeof input.body !== "string") throw new Error("body required");
    if (!input.contentType?.trim()) throw new Error("contentType required");
    return {
      bucket: input.bucket.trim(),
      path: input.path.trim().replace(/^\/+/, ""),
      body: input.body,
      contentType: input.contentType.trim(),
      base64: Boolean(input.base64),
    };
  })
  .handler(async ({ data }): Promise<ServerStorageUploadResult> => {
    const { url, key, keyKind } = getServerSupabaseConfig();
    const encodedPath = data.path.split("/").map(encodeURIComponent).join("/");
    const uploadUrl = `${url}/storage/v1/object/${encodeURIComponent(data.bucket)}/${encodedPath}`;

    const payload: BodyInit = data.base64
      ? Buffer.from(data.body, "base64")
      : data.body;

    const headers: Record<string, string> = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": data.contentType,
      "x-upsert": "true",
      "cache-control": "30",
    };

    console.info("[storage-publish.fn] server upload", {
      bucket: data.bucket,
      path: data.path,
      keyKind,
      contentType: data.contentType,
      bytes: typeof payload === "string" ? payload.length : (payload as Buffer).byteLength,
    });

    let res = await fetch(uploadUrl, { method: "POST", headers, body: payload });
    if (!res.ok && (res.status === 400 || res.status === 409 || res.status === 405)) {
      const peek = (await res.clone().text().catch(() => "")).slice(0, 200);
      // Retry PUT for upsert variants
      if (!/authorization/i.test(peek) || !/required property/i.test(peek)) {
        res = await fetch(uploadUrl, { method: "PUT", headers, body: payload });
      }
    }

    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 400);
      console.error("[storage-publish.fn] upload failed", {
        status: res.status,
        keyKind,
        detail,
      });
      if (/row-level security|violates row-level/i.test(detail) && keyKind === "anon") {
        throw new Error(
          `Storage RLS blocked server upload (using anon key). ` +
            `Set SUPABASE_SERVICE_ROLE_KEY on the server, or run supabase/storage_buckets.sql. Detail: ${detail}`,
        );
      }
      throw new Error(`Server storage upload failed (${res.status}): ${detail || res.statusText}`);
    }

    console.info("[storage-publish.fn] upload OK", {
      bucket: data.bucket,
      path: data.path,
      status: res.status,
      keyKind,
    });

    return {
      ok: true,
      bucket: data.bucket,
      path: data.path,
      fullPath: `${data.bucket}/${data.path}`,
      status: res.status,
    };
  });
