/**
 * Top banner shown only when Demo Mode is ON.
 * Non-annoying: compact, dismissible for the session, always offers sales CTA.
 * Banner message is fixed; CTA opens the default email client.
 */
import { useEffect, useState } from "react";
import { DEMO_BANNER_MESSAGE, DEMO_BUY_LABEL, isDemoMode } from "@/lib/demo-mode";
import { BuyFullVersionButton } from "./buy-full-version-button";

const DISMISS_KEY = "truckdash.demo.banner.dismissed";

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(true); // true until hydrated → no flash mismatch

  useEffect(() => {
    if (!isDemoMode) return;
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!isDemoMode || dismissed) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* sessionStorage unavailable */
    }
    setDismissed(true);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="demo-banner print:hidden relative z-[60] border-b border-[#c48a3a]/35"
      style={{
        background: "linear-gradient(90deg, #1a3d2e 0%, #2a5240 55%, #1a3d2e 100%)",
      }}
    >
      <div className="mx-auto max-w-3xl px-3 sm:px-4 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <span
            className="mt-0.5 shrink-0 inline-flex items-center rounded-md bg-[#d4a437] text-[#1a3d2e] text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5"
            aria-hidden
          >
            Demo
          </span>
          <p className="text-[12px] sm:text-[13px] leading-snug text-white/95 font-medium">
            {DEMO_BANNER_MESSAGE}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <BuyFullVersionButton
            size="sm"
            className="!py-1.5 !px-3 !text-[11px] !rounded-xl shadow-none"
          />
          <button
            type="button"
            onClick={dismiss}
            className="text-white/70 hover:text-white text-[11px] font-semibold px-2 py-1.5 rounded-lg hover:bg-white/10 transition"
            aria-label="Dismiss demo banner for this session"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

/** Compact inline notice for locked premium panels (not the top banner). */
export function DemoInlineNotice({
  message,
  className = "",
}: {
  message?: string;
  className?: string;
}) {
  if (!isDemoMode) return null;
  return (
    <div
      className={`rounded-2xl border border-brand-orange/25 bg-brand-orange/8 px-4 py-3 text-sm text-[color:var(--td-ink)] leading-relaxed ${className}`}
    >
      <p className="font-semibold text-brand-orange text-[11px] uppercase tracking-wider mb-1">
        Demo mode
      </p>
      <p className="text-[13px] text-[color:var(--td-ink-muted)]">
        {message ??
          `Try the tools freely. Publishing, high-res exports, and full map editing unlock with the full version (${DEMO_BUY_LABEL}).`}
      </p>
      <div className="mt-3">
        <BuyFullVersionButton size="sm" />
      </div>
    </div>
  );
}
