/**
 * Shared chrome for operator tools (Live Map, Calendar, Listings).
 * Theme-aware with high-contrast ink tokens, spacing, and soft motion.
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
  live?: boolean;
}) {
  return (
    <div className="min-h-screen bg-brand-sand pb-28 transition-colors duration-200">
      <header
        className="sticky top-0 z-30 backdrop-blur-xl border-b border-[color:var(--border)] transition-colors duration-200"
        style={{ background: "color-mix(in srgb, var(--brand-sand) 92%, transparent)" }}
      >
        <div className="mx-auto max-w-md px-4 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link
              to="/"
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-orange hover:underline"
            >
              ← TruckDash
            </Link>
            {eyebrow && (
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--td-ink-muted)] mt-1.5">
                {eyebrow}
              </p>
            )}
            <h1 className="font-display text-[1.4rem] truncate leading-snug mt-0.5 tracking-tight text-[color:var(--td-ink)]">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {live != null && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
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
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 pt-5 space-y-5 pb-2 td-rise">{children}</main>
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
