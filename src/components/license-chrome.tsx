/**
 * License chrome for the app shell:
 * - Valid key → subtle “Licensed to [Customer]” strip (header area)
 * - Missing / invalid key → prominent unlicensed banner (header)
 *
 * Hydration-safe: SSR + first client paint resolve env only; localStorage is
 * applied after mount (same pattern as DemoBanner).
 */
import { useEffect, useState } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  LICENSE_CONTACT_URL,
  LICENSE_PURCHASE_MESSAGE,
  resolveLicense,
  type LicenseStatus,
} from "@/lib/license";

function useLicenseStatus(): LicenseStatus | null {
  const hydrated = useHydrated();
  const [status, setStatus] = useState<LicenseStatus>(() =>
    resolveLicense({ includeLocalStorage: false }),
  );

  useEffect(() => {
    setStatus(resolveLicense({ includeLocalStorage: true }));
  }, []);

  // Avoid painting localStorage-dependent UI until after hydrate.
  if (!hydrated) return null;
  return status;
}

/**
 * Root-level license chrome: unlicensed banner or licensed strip.
 * Mount once inside the root layout (e.g. next to DemoBanner).
 */
export function LicenseChrome() {
  const status = useLicenseStatus();
  if (!status) return null;

  if (status.valid && status.customer) {
    return (
      <div
        role="status"
        aria-label={`Licensed to ${status.customer}`}
        className="license-licensed print:hidden relative z-[55] border-b border-[color:var(--border)]"
        style={{
          background: "color-mix(in srgb, var(--surface) 94%, transparent)",
        }}
      >
        <div className="mx-auto max-w-3xl px-3 sm:px-4 py-1.5 flex items-center justify-center gap-2">
          <span
            className="inline-flex items-center rounded bg-brand-orange/15 text-brand-orange text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5"
            aria-hidden
          >
            Licensed
          </span>
          <p className="text-[11px] sm:text-[12px] font-medium text-[color:var(--td-ink-muted)]">
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
      aria-live="assertive"
      className="license-unlicensed print:hidden relative z-[55] border-b border-red-900/30"
      style={{
        background: "linear-gradient(90deg, #7f1d1d 0%, #991b1b 50%, #7f1d1d 100%)",
      }}
    >
      <div className="mx-auto max-w-3xl px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <span
            className="mt-0.5 shrink-0 inline-flex items-center rounded-md bg-white text-red-900 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5"
            aria-hidden
          >
            Unlicensed
          </span>
          <div className="min-w-0">
            <p className="text-[13px] sm:text-sm font-semibold text-white leading-snug">
              This copy is unlicensed
            </p>
            <p className="mt-0.5 text-[12px] text-white/90 leading-snug">
              {LICENSE_PURCHASE_MESSAGE} Unauthorized resale or redistribution is not permitted.
            </p>
          </div>
        </div>
        <a
          href={LICENSE_CONTACT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 self-end sm:self-center inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[12px] font-bold text-red-900 shadow-sm hover:bg-white/95 active:scale-[0.98] transition"
        >
          Contact to purchase
        </a>
      </div>
    </div>
  );
}
