/**
 * Basic license protection — discourages unauthorized reselling.
 *
 * This is a lightweight client-side check, not hard DRM. Keys are validated
 * offline in the browser so a determined party can bypass them; the goal is
 * clear ownership labeling and a prominent unlicensed notice.
 *
 * Key format:  TD1.<base64url(customerName)>.<fnv1a-hex>
 *
 * Sources (first valid wins):
 *   1. Env: VITE_LICENSE_KEY or NEXT_PUBLIC_LICENSE_KEY  (per-deploy builds)
 *   2. localStorage: truckdash.license.key               (runtime unlock)
 *
 * Issue a key for a customer (Node / browser console):
 *   import { issueLicenseKey } from "@/lib/license";
 *   issueLicenseKey("Acme Food Trucks LLC");
 */

export const LICENSE_STORAGE_KEY = "truckdash.license.key";

/**
 * Contact form for purchase (same destination as demo / full-version sales).
 * Keep inlined so this module stays free of demo-mode / import.meta side effects.
 */
export const LICENSE_CONTACT_URL = "https://bluegrassdigitalforge.com/contact";

export const LICENSE_PURCHASE_MESSAGE =
  "Purchase a licensed copy from Bluegrass Digital Forge.";

/** Public salt baked into the client — deterrent only, not a secret. */
const LICENSE_SALT = "truckdash-bdf-license-v1";
const KEY_PREFIX = "TD1";

export type LicenseStatus = {
  valid: boolean;
  customer: string | null;
  /** Where the accepted key came from, or null if none. */
  source: "env" | "localStorage" | null;
};

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const b64 =
    typeof btoa !== "undefined"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string | null {
  try {
    const pad = s + "=".repeat((4 - (s.length % 4)) % 4);
    const b64 = pad.replace(/-/g, "+").replace(/_/g, "/");
    const binary =
      typeof atob !== "undefined"
        ? atob(b64)
        : Buffer.from(b64, "base64").toString("binary");
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** FNV-1a 32-bit → 8-char hex. */
function checksum(customer: string): string {
  let h = 0x811c9dc5;
  const str = `${customer}|${LICENSE_SALT}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Create a license key for a paying customer.
 * Run once when selling; put the result in their .env or hand it for localStorage.
 */
export function issueLicenseKey(customerName: string): string {
  const customer = customerName.trim();
  if (!customer) {
    throw new Error("Customer name is required to issue a license key");
  }
  return `${KEY_PREFIX}.${toBase64Url(customer)}.${checksum(customer)}`;
}

/**
 * Validate a raw key string. Returns customer name when valid.
 */
export function parseAndValidateLicenseKey(
  key: string | null | undefined,
): { valid: true; customer: string } | { valid: false; customer: null } {
  if (key == null || !String(key).trim()) {
    return { valid: false, customer: null };
  }
  const parts = String(key).trim().split(".");
  if (parts.length !== 3 || parts[0] !== KEY_PREFIX) {
    return { valid: false, customer: null };
  }
  const customer = fromBase64Url(parts[1]!);
  if (!customer || !customer.trim()) {
    return { valid: false, customer: null };
  }
  const expected = checksum(customer.trim());
  if (parts[2]!.toLowerCase() !== expected) {
    return { valid: false, customer: null };
  }
  return { valid: true, customer: customer.trim() };
}

/** Build-time / deploy-time key (Vite injects on server and client). */
export function getEnvLicenseKey(): string {
  const raw =
    import.meta.env.VITE_LICENSE_KEY ??
    import.meta.env.NEXT_PUBLIC_LICENSE_KEY ??
    "";
  return String(raw).trim();
}

/** Runtime key from the browser only. */
export function readStoredLicenseKey(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return (localStorage.getItem(LICENSE_STORAGE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

export function writeStoredLicenseKey(key: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LICENSE_STORAGE_KEY, key.trim());
}

export function clearStoredLicenseKey(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(LICENSE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Resolve license status.
 * Prefer env (per-customer deploy), then localStorage.
 *
 * Pass `includeLocalStorage: false` during SSR / first paint so HTML matches
 * until the client can read localStorage (see LicenseChrome).
 */
export function resolveLicense(options?: {
  includeLocalStorage?: boolean;
}): LicenseStatus {
  const includeLs = options?.includeLocalStorage !== false;

  const envKey = getEnvLicenseKey();
  if (envKey) {
    const parsed = parseAndValidateLicenseKey(envKey);
    if (parsed.valid) {
      return { valid: true, customer: parsed.customer, source: "env" };
    }
  }

  if (includeLs) {
    const stored = readStoredLicenseKey();
    if (stored) {
      const parsed = parseAndValidateLicenseKey(stored);
      if (parsed.valid) {
        return { valid: true, customer: parsed.customer, source: "localStorage" };
      }
    }
  }

  return { valid: false, customer: null, source: null };
}

/** Convenience: true when a valid key is present (env or storage). */
export function isLicensed(options?: { includeLocalStorage?: boolean }): boolean {
  return resolveLicense(options).valid;
}
