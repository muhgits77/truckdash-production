/**
 * The app is shelved for now. Public builds show a holding page instead of the app.
 *
 * - Local dev (`npm run dev`) always shows the app.
 * - To bring the app back on a deployment, set VITE_APP_ENABLED=true and redeploy.
 *
 * No app code or Supabase data is changed by this gate.
 */
export const APP_ENABLED: boolean =
  import.meta.env.DEV || String(import.meta.env.VITE_APP_ENABLED ?? "").toLowerCase() === "true";
