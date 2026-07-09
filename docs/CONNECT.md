# Connect your food truck website (Supabase)

TruckDash publishes menu + schedule to **Supabase Storage**. Your public site (or `/website`) loads:

```text
{SUPABASE_URL}/storage/v1/object/public/menu-data/{truckId}/menu.json
```

Example: `menu-data/bluegrass-kitchen/menu.json`

---

## Quick start (about 5 minutes)

### 1. Create a free Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Wait until the project is ready

### 2. Copy API keys

**Project Settings → API**

| What | Env var | Safe in browser? |
|------|---------|------------------|
| Project URL | `VITE_SUPABASE_URL` | Yes |
| `anon` `public` key | `VITE_SUPABASE_ANON_KEY` | Yes |
| `service_role` `secret` | `SUPABASE_SERVICE_ROLE_KEY` | **No** — server only |

### 3. Configure TruckDash

```bash
cp .env.example .env
# edit .env — paste URL + keys + your truck id
```

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_DEFAULT_TRUCK_ID=my-food-truck
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # service_role secret
```

### 4. One-command setup

```bash
npm run setup
```

This creates public buckets `menu-data` + `menu-images` and verifies Publish.

If setup asks you to run SQL, open **SQL Editor** in Supabase, paste  
`supabase/storage_buckets.sql`, and click **Run**.

### 5. Run the app

```bash
npm run dev
```

1. Update your menu / schedule / special  
2. Tap **Publish Updates to My Website**  
3. Open **Preview website** or `/website?truck=my-food-truck`

---

## Vercel deploy

Add the **same** env vars in Vercel → Project → **Settings → Environment Variables**:

| Name | Environments |
|------|----------------|
| `VITE_SUPABASE_URL` | Production, Preview |
| `VITE_SUPABASE_ANON_KEY` | Production, Preview |
| `VITE_DEFAULT_TRUCK_ID` | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview (**not** exposed as `VITE_`) |

Redeploy after saving.

---

## How Publish works

```text
Dashboard  →  Publish button
               │
               ├─ server (preferred): service role → Storage write
               └─ browser fallback: anon key (needs storage_buckets.sql RLS)
               │
               ▼
         menu-data/{truckId}/menu.json   (public)
               │
               ▼
         /website  ·  /menu  ·  your own site
```

- **Truck ID** is set in Settings (or `VITE_DEFAULT_TRUCK_ID`).
- Customers can use `?truck=your-slug` on the public pages.
- Offline: Publish saves locally and retries when back online.

---

## Multi-truck / multi-site

One Supabase project can host many trucks:

| Truck | Path |
|-------|------|
| `bluegrass-kitchen` | `menu-data/bluegrass-kitchen/menu.json` |
| `cluckin-chaos` | `menu-data/cluckin-chaos/menu.json` |

Each TruckDash install (or Settings truck id) publishes to its own folder.

---

## Checklist when something fails

| Symptom | Fix |
|---------|-----|
| “Supabase not configured” | Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, restart `npm run dev` |
| RLS / 403 on upload | Run `npm run setup` with service role, or run `storage_buckets.sql` |
| Public URL 400/404 | Ensure bucket `public = true` (setup / SQL does this) |
| Works locally, not on Vercel | Add `SUPABASE_SERVICE_ROLE_KEY` (no `VITE_`) on Vercel and redeploy |
| Wrong truck on site | Match Settings **Truck ID** with `?truck=` and `VITE_DEFAULT_TRUCK_ID` |

---

## Commands

```bash
npm run setup          # create buckets + verify Publish
npm run setup:test     # live upload smoke test
npm run setup:e2e      # full app-module publish e2e
npm run dev            # start TruckDash
```

---

## Security

- **Never** put `SUPABASE_SERVICE_ROLE_KEY` in `VITE_*` vars or client code.
- **Never** commit `.env` (gitignored).
- The `anon` key is public by design; Storage RLS + public buckets control access.
- Rotate `service_role` if it was ever shared or committed.
