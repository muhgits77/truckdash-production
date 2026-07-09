/**
 * TruckDash theme — light (cream/bluegrass) or warm dark (deep green / stone / amber).
 * Persists to localStorage; applies `class="dark"` on <html>.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "truckdash.theme";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  /** True after client has read storage (avoid flash of wrong icon) */
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyDomTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  // Browser chrome (address bar) — warm amber light, deep green dark
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0f2419" : "#b8722c");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Default light for SSR match; hydrate from storage after mount
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (stored === "dark" || stored === "light") {
        setThemeState(stored);
        applyDomTheme(stored);
      } else {
        applyDomTheme("light");
      }
    } catch {
      applyDomTheme("light");
    }
    setReady(true);
  }, []);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
    applyDomTheme(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, ready }),
    [theme, setTheme, toggleTheme, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback when outside provider (tests / partial mounts)
    return {
      theme: "light",
      setTheme: () => {},
      toggleTheme: () => {},
      ready: false,
    };
  }
  return ctx;
}

/** Compact moon/sun toggle — for headers */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme, ready } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={`shrink-0 size-10 grid place-items-center rounded-full border transition-colors ${
        isDark
          ? "bg-white/5 border-white/10 text-brand-gold hover:bg-white/10"
          : "bg-white border-brand-green/10 text-brand-green hover:bg-brand-sand"
      } ${className}`}
    >
      {!ready ? (
        <span className="size-4 rounded-full bg-current/20" />
      ) : isDark ? (
        <SunIcon className="size-4.5" />
      ) : (
        <MoonIcon className="size-4.5" />
      )}
    </button>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}
