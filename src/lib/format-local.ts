/**
 * Locale date helpers for TruckDash.
 *
 * IMPORTANT: Do not call these during the SSR / first-client render path unless
 * the result is only shown after `useHydrated()` is true (or after a client-only
 * data load). Server and browser can differ in timezone and locale.
 */

const LOCALE = "en-US";

export function formatPublishedShort(iso: string): string {
  return new Date(iso).toLocaleString(LOCALE, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatPublishedDay(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, {
    month: "long",
    day: "numeric",
  });
}

export function formatPublishedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatWeekOf(date: Date = new Date()): string {
  return date.toLocaleDateString(LOCALE, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** MON, TUE, … matching schedule day keys */
export function getTodayWeekdayAbbr(date: Date = new Date()): string {
  return date.toLocaleDateString(LOCALE, { weekday: "short" }).toUpperCase().slice(0, 3);
}
