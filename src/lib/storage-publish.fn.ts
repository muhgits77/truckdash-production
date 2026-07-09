/**
 * Server-side Storage publish (service role).
 *
 * Browser Publish → this server fn → Storage upsert with service_role.
 * Secrets load only inside the handler via `.server.ts` (never in the browser).
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
  keyKind: "service_role" | "anon";
};

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
    // Dynamic import: server-only module with fs .env fallback (not shipped to client)
    const { getServerSupabaseConfig } = await import("./supabase-server-config.server");
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
      bytes:
        typeof payload === "string"
          ? payload.length
          : (payload as Buffer).byteLength,
      host: url.replace(/^https?:\/\//, ""),
    });

    if (keyKind !== "service_role") {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is not available on the server. " +
          "Add it to .env (no VITE_ prefix), restart npm run dev, " +
          "and on Vercel add it under Environment Variables (server, not VITE_). " +
          "Or run supabase/storage_buckets.sql so anon can write.",
      );
    }

    let res = await fetch(uploadUrl, { method: "POST", headers, body: payload });
    if (!res.ok && (res.status === 400 || res.status === 409 || res.status === 405)) {
      const peek = (await res.clone().text().catch(() => "")).slice(0, 200);
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
      throw new Error(
        `Server storage upload failed (${res.status}, ${keyKind}): ${detail || res.statusText}`,
      );
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
      keyKind,
    };
  });
