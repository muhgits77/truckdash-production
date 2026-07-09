/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_DEFAULT_TRUCK_ID?: string;
  /** Public demo showcase toggle (true/false). Alias: VITE_DEMO_MODE */
  readonly NEXT_PUBLIC_DEMO_MODE?: string;
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
