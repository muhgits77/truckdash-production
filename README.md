# TruckDash

**Your mobile HQ for the food truck.**

Update where you are, what’s on the menu, and when you’re open — then hit **Publish** so customers always see the real story. Design social flyers with QR codes. Plan the week. Handle catering inquiries. All from your phone.

Welcome — this guide is for **paying customers** who are setting up and running TruckDash day to day. We’ll keep the tech light and the steps clear.

---

## What TruckDash does

| You do… | Customers get… |
|---------|----------------|
| Set location & hours | “Where are you today?” answered |
| Edit menu & specials | An up-to-date public menu |
| Plan **This Week** | A clear weekly schedule |
| Tap **Publish** | Your live website stays in sync |
| Design a flyer | Ready-to-post images with QR codes |

**Main tools:** Home dashboard · Menu · Flyer Studio · This Week · Live Map · Calendar · Listings · Catering  
**Public pages you can share:** `/website` · `/menu` · `/schedule` · `/catering`

---

## Quick start

You’ll need: a computer, [Node.js](https://nodejs.org) (LTS is fine), and about 10 minutes. If someone set this up for you, skip to [Customize for your truck](#customize-for-your-truck).

### 1. Install

Open a terminal in your TruckDash folder and run:

```bash
npm install
```

### 2. Connect your cloud (Supabase)

TruckDash saves your public menu and schedule so any phone can load your site — not just the one you edited on.

1. Create a free project at [supabase.com/dashboard](https://supabase.com/dashboard)  
2. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key  
   - **service_role** key (secret — keep this private)
3. In your TruckDash folder:

```bash
cp .env.example .env
```

4. Open the new `.env` file and fill in:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_public_key
VITE_DEFAULT_TRUCK_ID=my-food-truck
SUPABASE_SERVICE_ROLE_KEY=your_service_role_secret

# Full product for paying customers (recommended):
NEXT_PUBLIC_DEMO_MODE=false
```

**Truck ID tip:** use lowercase letters, numbers, and hyphens only — like `bluegrass-kitchen` or `cluckin-chaos`. This becomes your public slug.

### 3. One-command setup

```bash
npm run setup
```

This prepares storage for your menu data and food photos, and checks that **Publish** works.

If setup asks you to run SQL: open Supabase → **SQL Editor**, paste the contents of `supabase/storage_buckets.sql`, and click **Run**. Then run `npm run setup` again.

### 4. Run TruckDash

```bash
npm run dev
```

Open the address shown in the terminal (usually `http://localhost:3000`).

**First win:**

1. Set your truck name and location  
2. Add a couple of menu items  
3. Tap **Publish Updates to My Website**  
4. Open **Preview website** (or `/website`) to see what customers see  

You’re live on your machine. Next: put it on the internet with Vercel.

---

## Deploy to Vercel

Vercel hosts TruckDash so you (and customers) can use it from any phone or laptop.

### 1. Put your project on GitHub

If it isn’t already, push your TruckDash folder to a GitHub repository (private is fine).

### 2. Import into Vercel

1. Go to [vercel.com](https://vercel.com) and sign in  
2. **Add New Project** → import your GitHub repo  
3. Leave the default build settings unless we told you otherwise  

### 3. Add the same keys (important)

In Vercel → your project → **Settings → Environment Variables**, add:

| Name | Notes |
|------|--------|
| `VITE_SUPABASE_URL` | Same as in `.env` |
| `VITE_SUPABASE_ANON_KEY` | Same as in `.env` |
| `VITE_DEFAULT_TRUCK_ID` | Your truck slug (e.g. `bluegrass-kitchen`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret — **do not** prefix with `VITE_` |
| `NEXT_PUBLIC_DEMO_MODE` | Set to `false` for your full product |

Turn on **Production** (and **Preview** if you like) for each variable.

### 4. Deploy

Click **Deploy**. When it finishes, Vercel gives you a live URL (like `https://your-truck.vercel.app`).

**After changing any env vars:** redeploy so the new values take effect.

### 5. Optional: your own domain

In Vercel → **Settings → Domains**, add something like `app.yourtruck.com` and follow the DNS steps. Happy to help with this on a support call.

---

## Customize for your truck

Make TruckDash feel like *your* business — not a template.

### In the app (Settings)

Open **Settings** (gear icon on Home):

| Setting | What it does |
|---------|----------------|
| **Truck name** | Shows on flyers, public pages, and the header |
| **Hours** | Default open / close times |
| **Order-ahead URL** | Powers the order button and QR code (Square, your site, a form, etc.) |
| **Truck ID** | Public slug — must match `VITE_DEFAULT_TRUCK_ID` for a smooth setup |
| **App mode** | **Full Sync** = website + map + week tools front and center · **Social & Flyer Only** = focus on flyers, captions, and sharing |
| **Cloud website sync** | Keep this **on** so Publish reaches your live site from any device |

### Everyday content

| Where | Customize |
|-------|-----------|
| **Home** | Location, live status, today’s special |
| **Menu** (`/?tab=menu`) | Items, prices, descriptions |
| **This Week** | Stops and hours for Mon–Sun |
| **Flyer Studio** | Templates, backgrounds, formats (Post / Story / Square), QR |
| **Live Map** | Go Live, pin today’s spot, multi-stop days |
| **Calendar** | Festivals, markets, catering dates |
| **My Listings** | Tagline, cuisine, photos, live toggle |
| **Catering** | Packages, contact email, inquiry list |

### After you change something customers should see

Always tap **Publish Updates to My Website**.  
Until you Publish, edits stay on your device (great for drafting; not yet public).

### Share with hungry customers

| Link | What they see |
|------|----------------|
| `/website` or `/website?truck=your-truck-id` | Full menu + schedule hub |
| `/menu` | Live menu |
| `/schedule` | This week’s locations |
| `/catering` | Event booking form |

Use your live Vercel (or custom) domain in front of those paths.

---

## Demo Mode

Demo Mode is for **public showcases** (e.g. on a marketing site) — not for your everyday full product.

| Mode | When to use | What happens |
|------|-------------|--------------|
| **Full product** (`NEXT_PUBLIC_DEMO_MODE=false`) | **You, the paying customer** | Everything unlocked: high-res flyers, website publish, full live-map editing |
| **Demo** (`NEXT_PUBLIC_DEMO_MODE=true`) | Letting others *try* the product | Banner + locked premium actions; “Contact for Sales” points to our contact form |

### Turn Demo Mode **off** (recommended for you)

In `.env` **and** in Vercel environment variables:

```env
NEXT_PUBLIC_DEMO_MODE=false
```

Then:

- Locally: restart `npm run dev`  
- On Vercel: save the variable and **redeploy**

### Turn Demo Mode **on** (optional showcase)

```env
NEXT_PUBLIC_DEMO_MODE=true
```

When on:

- A top banner explains it’s a demo  
- High-res flyer export, website publish, and full map editing stay locked  
- Sales buttons open [bluegrassdigitalforge.com/contact](https://bluegrassdigitalforge.com/contact) (secure form — no email app)

**Rule of thumb:** your production TruckDash should run with Demo Mode **off**.

---

## A simple daily rhythm

1. Open TruckDash on your phone  
2. Update location / go **Live** on the map if you’re out  
3. Fix today’s special if it changed  
4. Tap **Publish**  
5. Optional: make a flyer and post it with the QR code  

That’s the whole loop. No website login. No waiting on a developer.

---

## If something doesn’t work

| What you notice | Try this |
|-----------------|----------|
| “Supabase not configured” | Check `.env` (or Vercel) URL + anon key, then restart / redeploy |
| Publish fails or 403 | Run `npm run setup` again, or run `supabase/storage_buckets.sql` in Supabase |
| Works on your laptop, not on Vercel | Add `SUPABASE_SERVICE_ROLE_KEY` on Vercel (**without** `VITE_`) and redeploy |
| Wrong truck on the public site | Match **Truck ID** in Settings, `VITE_DEFAULT_TRUCK_ID`, and `?truck=` in the URL |
| Still seeing the demo banner | Set `NEXT_PUBLIC_DEMO_MODE=false` and restart / redeploy |

More technical detail lives in [docs/CONNECT.md](docs/CONNECT.md) if you or your web person want it.

---

## Support

We’re glad you’re running TruckDash. Reach out anytime — setup help, training, custom domains, or “it broke at lunch.”

| Need | Contact |
|------|---------|
| **Sales, licensing, onboarding** | [Contact form](https://bluegrassdigitalforge.com/contact) |
| **Website & brand partner** | [Bluegrass Digital Forge](https://bluegrassdigitalforge.com) |
| **Setup / connect docs** | [docs/CONNECT.md](docs/CONNECT.md) |

Please include:

- Your **truck name** and **Truck ID**  
- Whether the issue is **local** (`npm run dev`) or **live on Vercel**  
- A short description (and a screenshot if you can)

We’ll get you rolling.

---

## Handy commands

| Command | What it does |
|---------|----------------|
| `npm install` | Installs TruckDash |
| `npm run setup` | Prepares cloud storage + checks Publish |
| `npm run dev` | Runs TruckDash on your computer |
| `npm run build` | Production build (used by Vercel) |

---

**You’re all set.**  
Name the truck. Load the menu. Publish. Feed people.

— The TruckDash / Bluegrass Digital Forge team
