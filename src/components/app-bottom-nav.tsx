/**
 * Shared mobile bottom navigation — premium, cohesive with dark mode.
 * High-contrast ink tokens (never washed-out green-on-green).
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";

type NavItem = {
  id: string;
  label: string;
  to?: string;
  match?: (path: string) => boolean;
  icon: React.ReactNode;
};

const PRIMARY: NavItem[] = [
  {
    id: "home",
    label: "Home",
    to: "/",
    match: (p) => p === "/",
    icon: <IconHome />,
  },
  {
    id: "week",
    label: "Week",
    to: "/this-week",
    match: (p) => p.startsWith("/this-week"),
    icon: <IconWeek />,
  },
  {
    id: "live",
    label: "Live",
    to: "/live-map",
    match: (p) => p.startsWith("/live-map"),
    icon: <IconLive />,
  },
  {
    id: "cal",
    label: "Calendar",
    to: "/calendar",
    match: (p) => p.startsWith("/calendar"),
    icon: <IconCal />,
  },
];

const MORE_LINKS: { label: string; to: string; hint: string; emoji: string }[] = [
  { label: "Menu", to: "/?tab=menu", hint: "Edit items & prices", emoji: "🍽" },
  { label: "Flyer Studio", to: "/?tab=flyer", hint: "Social posts & QR", emoji: "✦" },
  { label: "My Listings", to: "/listings", hint: "Public profile card", emoji: "★" },
  { label: "Catering", to: "/?tab=catering", hint: "Inquiries & packages", emoji: "◇" },
  { label: "Public website", to: "/website", hint: "Customer preview", emoji: "↗" },
  { label: "Live menu", to: "/menu", hint: "Customer menu page", emoji: "☰" },
];

export function AppBottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-50 print:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-[5.25rem] inset-x-0 mx-auto max-w-md px-4 pb-1">
            <div
              className="rounded-[1.5rem] border border-[color:var(--border)] overflow-hidden"
              style={{
                background: "var(--surface)",
                boxShadow: "var(--shadow-elevated)",
              }}
            >
              <div className="px-5 pt-5 pb-3.5 border-b border-[color:var(--border)]">
                <p className="td-section-label">More tools</p>
                <p className="text-sm text-[color:var(--td-ink-muted)] mt-1.5 leading-snug">
                  Menu, flyers, listings & catering — your Kentucky command center
                </p>
              </div>
              <ul>
                {MORE_LINKS.map((l, i) => (
                  <li
                    key={l.to}
                    className={
                      i < MORE_LINKS.length - 1
                        ? "border-b border-[color:var(--border)]"
                        : ""
                    }
                  >
                    <Link
                      to={l.to}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-[color:var(--surface-2)] transition active:scale-[0.99]"
                    >
                      <span
                        className="size-10 shrink-0 grid place-items-center rounded-2xl text-sm bg-[color:var(--surface-2)] border border-[color:var(--border)]"
                        aria-hidden
                      >
                        {l.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-[color:var(--td-ink)] tracking-tight">
                          {l.label}
                        </span>
                        <span className="text-[11px] text-[color:var(--td-ink-muted)]">
                          {l.hint}
                        </span>
                      </span>
                      <span className="text-brand-orange text-base font-semibold">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <nav
        className="fixed bottom-0 inset-x-0 z-40 border-t border-[color:var(--border)] px-2 pt-2.5 pb-[max(0.85rem,env(safe-area-inset-bottom))] print:hidden"
        style={{
          background: "color-mix(in srgb, var(--surface) 94%, transparent)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <div className="max-w-md mx-auto flex justify-around items-stretch gap-0.5">
          {PRIMARY.map((it) => {
            const active = it.match ? it.match(path) : false;
            return (
              <Link
                key={it.id}
                to={it.to!}
                className={`flex flex-1 flex-col items-center gap-1 py-2 px-1 rounded-2xl transition min-w-0 ${
                  active
                    ? "text-brand-orange bg-brand-orange/10 dark:bg-brand-orange/15"
                    : "text-[color:var(--td-ink-muted)] hover:text-brand-orange"
                }`}
              >
                <span className={active ? "scale-105" : ""}>{it.icon}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider truncate max-w-full">
                  {it.label}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={`flex flex-1 flex-col items-center gap-1 py-2 px-1 rounded-2xl transition min-w-0 ${
              moreOpen
                ? "text-brand-orange bg-brand-orange/10 dark:bg-brand-orange/15"
                : "text-[color:var(--td-ink-muted)] hover:text-brand-orange"
            }`}
          >
            <IconMore />
            <span className="text-[9px] font-bold uppercase tracking-wider">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5z" />
    </svg>
  );
}
function IconWeek() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
function IconLive() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="7" opacity="0.45" />
      <circle cx="12" cy="12" r="10" opacity="0.25" />
    </svg>
  );
}
function IconCal() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  );
}
function IconMore() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}
