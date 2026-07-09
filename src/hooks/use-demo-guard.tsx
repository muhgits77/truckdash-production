/**
 * Hook for gating premium actions in Demo Mode with a lightweight toast.
 */
import { useCallback, useEffect, useState } from "react";
import {
  DEMO_BUY_URL,
  DEMO_FEATURE_MESSAGES,
  DEMO_SALES_EMAIL,
  isDemoMode,
  type DemoLockedFeature,
} from "@/lib/demo-mode";

export function useDemoGuard() {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const block = useCallback((feature: DemoLockedFeature) => {
    setToast(DEMO_FEATURE_MESSAGES[feature]);
  }, []);

  /**
   * Returns true if the action may proceed (demo off).
   * When demo is on, shows a toast and returns false.
   */
  const allowOrToast = useCallback(
    (feature: DemoLockedFeature): boolean => {
      if (!isDemoMode) return true;
      block(feature);
      return false;
    },
    [block],
  );

  const DemoToast = useCallback(() => {
    if (!toast) return null;
    return (
      <div
        role="status"
        className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[70] max-w-[min(92vw,24rem)] print:hidden"
      >
        <div className="rounded-2xl bg-brand-deep text-white shadow-2xl shadow-black/40 px-4 py-3 space-y-2.5">
          <p className="text-sm font-medium leading-snug text-center">{toast}</p>
          <a
            href={DEMO_BUY_URL}
            title={`Email ${DEMO_SALES_EMAIL}`}
            className="flex items-center justify-center w-full rounded-xl bg-brand-orange text-white text-xs font-bold py-2.5 active:scale-[0.98] transition"
          >
            Contact for Sales
          </a>
        </div>
      </div>
    );
  }, [toast]);

  return {
    isDemoMode,
    allowOrToast,
    block,
    toast,
    setToast,
    DemoToast,
  };
}
