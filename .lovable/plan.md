# TruckDash — Flyer polish (v0.3.0)

All work in `src/routes/index.tsx` + minor tokens in `src/styles.css`. Persistence via existing `useTruckState` (localStorage). No new dependencies — `qrcode` and `html-to-image` are already installed.

## 1. Extend persisted state

Add to `TruckState` + `DEFAULT_STATE`:

- `qrUrl: string` (blank means "fall back to orderUrl")
- `shareFormat: "portrait" | "story" | "square"` (default `portrait`)
- `background: BackgroundId` (default `paper`)

Loader already merges `{ ...DEFAULT_STATE, ...parsed }`, so existing users pick up defaults automatically. Bump `APP_VERSION` to `0.3.0` so the version-bump reload runs once, and rotate `ONBOARD_KEY` to `truckdash.onboarded.v3`.

## 2. Share format switcher

- New `SHARE_FORMATS` list: Post 4:5, Story 9:16, Square 1:1.
- Chip row above the flyer preview. Persists to `state.shareFormat`.
- The `Flyer` component accepts the format and applies `aspect-[4/5] | aspect-[9/16] | aspect-square` to its outer frame + adjusts hero height so the layout still fits (hero shrinks for square, expands for story).
- `captureBlob` / `downloadPng` render the same DOM node, so the exported PNG matches the selected aspect at 3x DPR.

## 3. One-tap Share

- Collapse the current 3-button share row into one primary "Share flyer" action (keep Download PNG + Copy Caption as secondary).
- Flow: render PNG → `navigator.share({ files })` if available → otherwise download the file + copy caption + toast "Saved to Photos — paste into Instagram / Facebook".
- Keep the desktop Facebook web-intent as a small secondary link when share API isn't available.

## 4. QR Preview + validation

New compact `QrPreviewCard` above the customizer:

- Shows the exact URL the QR encodes: `state.qrUrl || state.orderUrl || "https://truckdash.app"`.
- Inline input to edit `qrUrl` (placeholder: "Same as Order Ahead URL").
- Live validation via a pure `validateUrl(s)` helper — green check ("Valid link") or amber warning with reason ("Missing https://", "Not a valid URL"). Non-blocking.
- 96px mini QR rendered from the same value so what you see = what the flyer prints.

The main `Flyer` also reads from `qrUrl || orderUrl` so the encoded target stays in sync.

## 5. Background options

- New `BACKGROUNDS` registry with 6 warm presets: `paper`, `cream-grid`, `kraft` (noise), `sunset-gradient`, `sage-linen` (linen texture), `charcoal-grain`. Textures are inline SVG data URIs — no network, works offline, exports cleanly.
- Horizontal swatch picker in the customizer.
- Applied as the flyer paper background (behind body copy). Photo hero sits on top with a soft inner shadow so it blends into the chosen background.
- Dark backgrounds (`charcoal-grain`) flip body text color to `#f6efe1` via a per-preset `ink` override so contrast stays readable.

## 6. Onboarding + version

- Bump `APP_VERSION = "0.3.0"`; footer already shows it.
- Update onboarding bullets to mention Share formats (Post / Story / Square) and Backgrounds.

## Technical notes

- No new deps. No routes, no schema, no backend.
- All new state is optional so the migration is a no-op for existing localStorage payloads.
- `html-to-image` captures the same node the preview renders, so aspect + background are automatically baked into the PNG.
- Validation is a pure helper; no async, no network.
- Kill switch: existing version-bump `reload()` handles cache staleness.
