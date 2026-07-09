/**
 * Shared chrome for operator tools (Live Map, Calendar, Listings).
 * Theme-aware: cream light / warm forest dark.
 */
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppBottomNav } from "./app-bottom-nav";
import { ThemeToggle } from "@/hooks/use-theme";

export function PageShell({
  title,
  eyebrow,
  children,
  live,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  /** Show LIVE pill in header */
  live?: boolean;
}) {
  return (
    <div className="min-h-screen bg-brand-sand text-brand-green pb-28 transition-colors duration-200">
      <header className="sticky top-0 z-30 bg-brand-sand/90 backdrop-blur-xl border-b border-brand-green/8 dark:border-white/8">
        <div className="mx-auto max-w-md px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link
              to="/"
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-orange hover:underline"
            >
              ← TruckDash
            </Link>
            {eyebrow && (
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-green/40 dark:text-brand-green/45 mt-1">
                {eyebrow}
              </p>
            )}
            <h1 className="font-display text-[1.35rem] truncate leading-snug mt-0.5 tracking-tight">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {live != null && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                  live
                    ? "bg-brand-orange text-white shadow-md shadow-brand-orange/25"
                    : "bg-surface text-brand-green/50 border border-brand-green/10 dark:border-white/10"
                }`}
              >
                {live && (
                  <span className="size-1.5 rounded-full bg-white animate-pulse" aria-hidden />
                )}
                {live ? "Live" : "Offline"}
              </span>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 pt-5 space-y-5">{children}</main>
      <AppBottomNav />
    </div>
  );
}

/** Consistent tip / how-to card used on tool screens */
export function TipCard({ children }: { children: ReactNode }) {
  return (
    <div className="td-card td-card-pad text-sm text-brand-green/70 dark:text-brand-green/65 leading-relaxed">
      {children}
    </div>
  );
}
