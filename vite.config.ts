// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv, type Plugin } from "vite";

/**
 * Lovable config only loadEnv(..., "VITE_"), so SUPABASE_SERVICE_ROLE_KEY never
 * reaches process.env for SSR / server functions. Load SUPABASE_* into process.env
 * at config time (server only — do NOT add SUPABASE_ to envPrefix or it ships to the browser).
 */
function loadSupabaseServerEnvPlugin(): Plugin {
  return {
    name: "load-supabase-server-env",
    config(_config, { mode }) {
      const env = loadEnv(mode, process.cwd(), "");
      for (const [key, value] of Object.entries(env)) {
        if (
          (key.startsWith("SUPABASE_") || key === "DATABASE_URL") &&
          value &&
          !process.env[key]
        ) {
          process.env[key] = value;
        }
      }
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [loadSupabaseServerEnvPlugin()],
  },
});
