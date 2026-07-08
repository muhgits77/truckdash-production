import { useEffect, useState } from "react";

/**
 * False on the server and on the first client render (must match SSR HTML).
 * True after mount — safe to read localStorage, window, or locale-format dates.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
