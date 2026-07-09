# TruckDash

Mobile HQ for food truck owners — update location, hours, menu & schedule, design flyers, then **Publish** so your website stays live.

## Plug-and-play website sync

TruckDash writes one public JSON file in Supabase Storage:

```text
menu-data/{your-truck-id}/menu.json
```

Your site (or TruckDash `/website`) loads that URL with cache busting.

### New truck setup

```bash
# 1) Install
npm install

# 2) Env
cp .env.example .env
# Fill VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
# and VITE_DEFAULT_TRUCK_ID (e.g. bluegrass-kitchen)

# 3) Create buckets + verify Publish
npm run setup

# 4) Run
npm run dev
```

Full walkthrough: **[docs/CONNECT.md](docs/CONNECT.md)**

### Minimal env

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_SUPABASE_URL` | Browser + server | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Browser + server | Public API key |
| `VITE_DEFAULT_TRUCK_ID` | Browser | Storage folder slug |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Reliable Publish + `npm run setup` |
| `NEXT_PUBLIC_DEMO_MODE` | Browser | `true` = public demo (banner + locked premium actions). Default/off = full product |
| `NEXT_PUBLIC_DEMO_BUY_URL` | Browser | Optional checkout link for “Buy Full Version – $597” |

### Demo Mode (safe public showcase)

Set in `.env` and restart the dev server:

```bash
NEXT_PUBLIC_DEMO_MODE=true
# optional:
# NEXT_PUBLIC_DEMO_BUY_URL=https://yoursite.com/buy-truckdash
```

When on: demo banner, buy CTAs, and locks on high-res flyer export, website publish, and full live-map editing. Set `false` (or omit) for the full product.

## Scripts

| Command | What it does |
|---------|----------------|
| `npm run setup` | One-command Supabase storage bootstrap |
| `npm run setup:test` | Upload smoke test |
| `npm run setup:e2e` | Full publish path e2e |
| `npm run dev` | Local app |
| `npm run build` | Production build |

## Public pages

| Route | Purpose |
|-------|---------|
| `/` | Owner dashboard + Publish |
| `/website?truck=…` | Customer-facing menu & schedule |
| `/menu` | Live menu |
| `/schedule` | Weekly schedule |

## Stack

- TanStack Start + React + Vite  
- Supabase Storage (menu JSON + food photos)  
- Deploy: Vercel (or any Node host)

## License

Private / project use unless otherwise noted.
