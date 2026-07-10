/**
 * License chrome for the app shell:
 * - Valid key → subtle “Licensed to [Customer]” strip (Pro polish when paid)
 * - Missing key → compact unlicensed banner with purchase link
 *
 * Key comes from build-time VITE_LICENSE_KEY only (no localStorage).
 * Layout stays compact so the rest of the app is never crowded.
 */
import { LICENSE_CONTACT_URL, LICENSE_PURCHASE_MESSAGE, resolveLicense } from "@/lib/license";
import { ProBadge } from "./pro-badge";

/**
 * Root-level license chrome. Mount once in the root layout.
 */
export function LicenseChrome() {
  const status = resolveLicense();

  if (status.valid && status.customer) {
    return (
      <div
        role="status"
        aria-label={`Licensed to ${status.customer} — TruckDash Pro`}
        className="license-licensed pro-licensed print:hidden relative z-[55] border-b border-[color:var(--border)]"
        style={{
          background:
            "linear-gradient(90deg, color-mix(in srgb, var(--surface) 96%, #d4a437) 0%, color-mix(in srgb, var(--surface) 94%, transparent) 40%, color-mix(in srgb, var(--surface) 96%, #1a3d2e) 100%)",
        }}
      >
        <div className="mx-auto max-w-3xl px-3 sm:px-4 py-1.5 flex items-center justify-center gap-2.5">
          <ProBadge size="xs" title="TruckDash Pro license" />
          <p className="text-[11px] sm:text-[12px] font-medium text-[color:var(--td-ink-muted)] truncate">
            Licensed to{" "}
            <span className="font-semibold text-[color:var(--td-ink)]">{status.customer}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="license-unlicensed print:hidden relative z-[55] border-b border-amber-900/20"
      style={{
        background:
          "color-mix(in srgb, #92400e 12%, color-mix(in srgb, var(--surface) 96%, transparent))",
      }}
    >
      <div className="mx-auto max-w-3xl px-3 sm:px-4 py-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className="shrink-0 inline-flex items-center rounded bg-amber-700/15 text-amber-800 dark:text-amber-200 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5"
            aria-hidden
          >
            Unlicensed
          </span>
          <p className="text-[12px] sm:text-[13px] text-[color:var(--td-ink-muted)] leading-snug">
            This copy is unlicensed. {LICENSE_PURCHASE_MESSAGE}
          </p>
        </div>
        <a
          href={LICENSE_CONTACT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 self-end sm:self-center inline-flex items-center justify-center rounded-lg border border-amber-800/25 bg-[color:var(--surface)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--td-ink)] hover:bg-amber-700/10 active:scale-[0.98] transition"
        >
          Contact to purchase
        </a>
      </div>
    </div>
  );
}
