/**
 * Shared chrome for operator tools (Live Map, Calendar, Listings).
 * Theme-aware with high-contrast ink tokens, spacing, and soft motion.
 * Pro pages get a subtle badge + airier stack — Starter routes stay unchanged.
 */
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppBottomNav } from "./app-bottom-nav";
import { BuyFullVersionButton } from "./buy-full-version-button";
import { ProBadge } from "./pro-badge";
import { ThemeToggle } from "@/hooks/use-theme";
import { isDemoMode } from "@/lib/demo-mode";

export function PageShell({
  title,
  eyebrow,
  children,
  live,
  pro = false,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  live?: boolean;
  /** Show Pro badge + premium spacing for advanced tools. */
  pro?: boolean;
}) {
  return (
    <div className="min-h-screen bg-brand-sand pb-28 transition-colors duration-200">
      <header
        className="sticky top-0 z-30 backdrop-blur-xl border-b border-[color:var(--border)] transition-colors duration-200"
        style={{
          background: pro
            ? "linear-gradient(180deg, color-mix(in srgb, var(--brand-sand) 88%, #d4a437) 0%, color-mix(in srgb, var(--brand-sand) 92%, transparent) 100%)"
            : "color-mix(in srgb, var(--brand-sand) 92%, transparent)",
        }}
      >
        <div
          className={`mx-auto max-w-md px-4 flex items-center justify-between gap-3 ${
            pro ? "py-[1.05rem]" : "py-4"
          }`}
        >
          <div className="min-w-0 flex-1">
            <Link
              to="/"
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-orange hover:underline transition-opacity hover:opacity-90"
            >
              ← TruckDash
            </Link>
            {eyebrow && (
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--td-ink-muted)] mt-1.5 flex items-center gap-2">
                {eyebrow}
                {pro && <ProBadge size="xs" />}
              </p>
            )}
            <h1 className="font-display text-[1.4rem] truncate leading-snug mt-0.5 tracking-tight text-[color:var(--td-ink)] flex items-center gap-2">
              <span className="truncate">{title}</span>
              {pro && !eyebrow && <ProBadge size="xs" />}
            </h1>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {live != null && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${
                  live
                    ? "bg-brand-orange text-white shadow-md shadow-brand-orange/25"
                    : "bg-[color:var(--surface)] text-[color:var(--td-ink-muted)] border border-[color:var(--border)]"
                }`}
              >
                {live && (
                  <span className="size-1.5 rounded-full bg-white animate-pulse" aria-hidden />
                )}
                {live ? "Live" : "Offline"}
              </span>
            )}
            {isDemoMode && <BuyFullVersionButton size="sm" className="!hidden sm:!inline-flex" />}
            <ThemeToggle />
          </div>
        </div>
        {pro && (
          <div
            className="h-px w-full"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--brand-gold) 55%, transparent) 50%, transparent 100%)",
            }}
            aria-hidden
          />
        )}
      </header>
      <main
        className={`mx-auto max-w-md px-4 pt-5 pb-2 td-rise ${
          pro ? "space-y-[1.35rem] pro-page-main" : "space-y-5"
        }`}
      >
        {children}
      </main>
      <AppBottomNav />
    </div>
  );
}

export function TipCard({ children }: { children: ReactNode }) {
  return (
    <div className="td-card td-card-pad text-sm text-[color:var(--td-ink)] leading-relaxed">
      {children}
    </div>
  );
}
