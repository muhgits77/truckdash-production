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
  const inject = (mode: string) => {
    const env = loadEnv(mode, process.cwd(), "");
    let loaded = 0;
    for (const [key, value] of Object.entries(env)) {
      if (
        (key.startsWith("SUPABASE_") ||
          key === "DATABASE_URL" ||
          key.startsWith("VITE_SUPABASE_")) &&
        value
      ) {
        // Always refresh from .env so restarts pick up key changes
        process.env[key] = value;
        loaded++;
      }
    }
    const hasService = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
    console.info(
      `[vite] server env: loaded ${loaded} keys; SUPABASE_SERVICE_ROLE_KEY=${hasService ? "yes" : "MISSING"}`,
    );
  };

  return {
    name: "load-supabase-server-env",
    config(_config, { mode }) {
      inject(mode);
    },
    configureServer() {
      // Dev server: re-assert on boot (config hook can run before cwd is final)
      inject(process.env.NODE_ENV === "production" ? "production" : "development");
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
    // Keep service role available to SSR/server-fn process.env at runtime
    // (do NOT put SUPABASE_ in envPrefix — that would ship it to the browser).
  },
});
