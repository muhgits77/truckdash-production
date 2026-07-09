/**
 * Smart geocoding for TruckDash Live Map
 * ─────────────────────────────────────
 * Lake Cumberland corridor (Wayne / Russell / Clinton / Pulaski counties, KY).
 *
 * Strategy (fast → accurate → network):
 *  1. Local landmark catalog (curated coords for known food-truck spots)
 *  2. localStorage cache of prior lookups
 *  3. OpenStreetMap Nominatim (viewbox-biased to south-central KY)
 *
 * Never invent pins outside Kentucky. Prefer authentic local matches.
 */

export type GeoPoint = {
  lat: number;
  lng: number;
  /** Human-readable matched place */
  label: string;
  /** landmark | nominatim | cache | fallback */
  source: "landmark" | "nominatim" | "cache" | "fallback";
};

const CACHE_KEY = "truckdash.geocode.v1";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

/** South-central KY focus (roughly Monticello → Somerset → lake) */
const KY_VIEWBOX = {
  west: -85.45,
  south: 36.65,
  east: -84.45,
  north: 37.25,
};

/** Map center when nothing is pinned */
export const KY_MAP_CENTER: [number, number] = [36.95, -84.95];
export const KY_MAP_ZOOM = 10;

/**
 * Curated landmarks — authentic Lake Cumberland / Bluegrass food-truck corridor.
 * Coordinates researched for real places in Wayne & Russell counties, KY.
 */
const LANDMARKS: { keys: string[]; lat: number; lng: number; label: string }[] = [
  // ── Monticello / Wayne County ──────────────────────────────────────────
  {
    keys: [
      "monticello",
      "downtown monticello",
      "courthouse square",
      "wayne county courthouse",
      "monticello market",
      "main street monticello",
    ],
    lat: 36.8298,
    lng: -84.8491,
    label: "Courthouse Square · Monticello, KY",
  },
  {
    keys: ["wayne county fairgrounds", "wayne county fair", "fairgrounds monticello"],
    lat: 36.8355,
    lng: -84.841,
    label: "Wayne County Fairgrounds · Monticello, KY",
  },
  {
    keys: ["monticello walmart", "walmart monticello"],
    lat: 36.842,
    lng: -84.862,
    label: "Walmart · Monticello, KY",
  },

  // ── Russell Springs ────────────────────────────────────────────────────
  {
    keys: [
      "russell springs",
      "downtown russell springs",
      "main st lot",
      "main street lot",
      "main st. lot",
      "by the bank",
      "food truck friday",
      "russell springs downtown",
    ],
    lat: 37.0567,
    lng: -85.0886,
    label: "Downtown Russell Springs · Main St, KY",
  },
  {
    keys: ["russell springs park", "city park russell"],
    lat: 37.0535,
    lng: -85.0915,
    label: "City Park · Russell Springs, KY",
  },

  // ── Jamestown / Lakeway ────────────────────────────────────────────────
  {
    keys: [
      "jamestown",
      "downtown jamestown",
      "lakeway",
      "lakeway shopping",
      "lakeway shopping center",
      "jamestown ky",
    ],
    lat: 36.9848,
    lng: -85.063,
    label: "Lakeway Shopping Center · Jamestown, KY",
  },
  {
    keys: ["russell county courthouse", "courthouse jamestown"],
    lat: 36.9845,
    lng: -85.0615,
    label: "Russell County Courthouse · Jamestown, KY",
  },

  // ── Lake Cumberland ────────────────────────────────────────────────────
  {
    keys: [
      "lake cumberland",
      "state dock",
      "state dock main ramp",
      "main ramp",
      "lake cumberland state dock",
      "state park dock",
    ],
    lat: 36.9205,
    lng: -84.9615,
    label: "State Dock · Lake Cumberland, KY",
  },
  {
    keys: ["wolf creek dam", "wolf creek", "dam overlook"],
    lat: 36.8705,
    lng: -85.1465,
    label: "Wolf Creek Dam · Lake Cumberland, KY",
  },
  {
    keys: ["burnside", "burnside marina", "general burnside"],
    lat: 36.9885,
    lng: -84.6015,
    label: "Burnside · Lake Cumberland, KY",
  },
  {
    keys: ["somerset", "downtown somerset"],
    lat: 37.092,
    lng: -84.6041,
    label: "Somerset, KY",
  },
  {
    keys: ["fall creek falls", "fall creek"],
    lat: 36.838,
    lng: -85.008,
    label: "Fall Creek area · Lake Cumberland, KY",
  },
  {
    keys: ["conley bottom", "conley bottoms"],
    lat: 36.905,
    lng: -84.875,
    label: "Conley Bottom · Lake Cumberland, KY",
  },
  {
    keys: ["alligator 2", "alligator ii", "alligator marina"],
    lat: 36.965,
    lng: -84.935,
    label: "Alligator II Marina · Lake Cumberland, KY",
  },
  {
    keys: ["lee's ford", "lees ford", "lee ford marina"],
    lat: 37.045,
    lng: -84.72,
    label: "Lee's Ford Marina · Lake Cumberland, KY",
  },

  // ── Nearby corridor ────────────────────────────────────────────────────
  {
    keys: ["albany", "clinton county"],
    lat: 36.6909,
    lng: -85.1347,
    label: "Albany, KY",
  },
  {
    keys: ["columbia ky", "columbia", "adair county"],
    lat: 37.1028,
    lng: -85.3064,
    label: "Columbia, KY",
  },
];

/** Normalize for matching: lowercase, strip punctuation, collapse space */
export function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .replace(/[·•|/\\,.—–-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadCache(): Record<string, GeoPoint> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, GeoPoint>;
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, GeoPoint>) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota */
  }
}

/** Score how well a landmark matches the free-text query (higher = better) */
function landmarkScore(query: string, keys: string[]): number {
  const nq = normalizeQuery(query);
  if (!nq || nq === "—" || nq === "-" || nq === "off" || nq === "prep day") return 0;
  let best = 0;
  for (const k of keys) {
    const nk = normalizeQuery(k);
    if (nq === nk) best = Math.max(best, 100);
    else if (nq.includes(nk) && nk.length >= 4) best = Math.max(best, 80 + Math.min(nk.length, 15));
    else if (nk.includes(nq) && nq.length >= 5) best = Math.max(best, 60 + Math.min(nq.length, 10));
    else {
      // token overlap
      const qTokens = nq.split(" ").filter((t) => t.length > 2);
      const kTokens = nk.split(" ").filter((t) => t.length > 2);
      const hits = qTokens.filter((t) => kTokens.some((kt) => kt.includes(t) || t.includes(kt)));
      if (hits.length >= 2) best = Math.max(best, 40 + hits.length * 8);
      else if (hits.length === 1 && hits[0].length >= 6) best = Math.max(best, 30);
    }
  }
  return best;
}

/**
 * Instant landmark lookup (sync). Returns null if no confident local match.
 */
export function matchLandmark(query: string): GeoPoint | null {
  if (!query?.trim()) return null;
  let best: { score: number; hit: (typeof LANDMARKS)[0] } | null = null;
  for (const lm of LANDMARKS) {
    const score = landmarkScore(query, lm.keys);
    if (score >= 30 && (!best || score > best.score)) {
      best = { score, hit: lm };
    }
  }
  if (!best) return null;
  return {
    lat: best.hit.lat,
    lng: best.hit.lng,
    label: best.hit.label,
    source: "landmark",
  };
}

/** Build a search string from schedule fields */
export function buildScheduleQuery(neighborhood: string, spot: string): string {
  const parts = [neighborhood, spot]
    .map((p) => p?.trim())
    .filter((p) => p && p !== "—" && p !== "-" && !/^prep/i.test(p) && !/^off$/i.test(p));
  return parts.join(" · ");
}

/** Rate-limited Nominatim queue (1 req / ~1.1s per usage policy) */
let nominatimChain: Promise<void> = Promise.resolve();
let lastNominatimAt = 0;

async function nominatimSearch(query: string): Promise<GeoPoint | null> {
  const q = `${query}, Kentucky, USA`;
  const run = async (): Promise<GeoPoint | null> => {
    const wait = Math.max(0, 1100 - (Date.now() - lastNominatimAt));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastNominatimAt = Date.now();

    const params = new URLSearchParams({
      q,
      format: "json",
      limit: "1",
      countrycodes: "us",
      viewbox: `${KY_VIEWBOX.west},${KY_VIEWBOX.north},${KY_VIEWBOX.east},${KY_VIEWBOX.south}`,
      bounded: "0",
      addressdetails: "0",
    });

    try {
      const res = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: {
          Accept: "application/json",
          // Nominatim requires a valid identifying User-Agent / app name
          "Accept-Language": "en-US",
        },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Array<{
        lat: string;
        lon: string;
        display_name?: string;
      }>;
      if (!data?.length) return null;
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      // Reject results far outside our service region
      if (
        lat < KY_VIEWBOX.south - 0.8 ||
        lat > KY_VIEWBOX.north + 0.8 ||
        lng < KY_VIEWBOX.west - 0.8 ||
        lng > KY_VIEWBOX.east + 0.8
      ) {
        return null;
      }
      return {
        lat,
        lng,
        label: data[0].display_name?.split("," ).slice(0, 3).join(",") || query,
        source: "nominatim",
      };
    } catch {
      return null;
    }
  };

  // Serialize requests
  const result = nominatimChain.then(run, run);
  nominatimChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/**
 * Resolve a free-text place to coordinates.
 * Prefer landmarks → cache → Nominatim. Optional fallback near map center.
 */
export async function geocodePlace(
  query: string,
  opts?: { allowFallback?: boolean; fallback?: { lat: number; lng: number } },
): Promise<GeoPoint | null> {
  const raw = query?.trim();
  if (!raw || raw === "—" || raw === "-") return null;

  const key = normalizeQuery(raw);

  // 1) Landmark catalog
  const lm = matchLandmark(raw);
  if (lm) return lm;

  // 2) Cache
  const cache = loadCache();
  if (cache[key]?.lat != null) {
    return { ...cache[key], source: "cache" };
  }

  // 3) Nominatim (OSM)
  const nom = await nominatimSearch(raw);
  if (nom) {
    cache[key] = nom;
    saveCache(cache);
    return nom;
  }

  // 4) Optional soft fallback (e.g. town centroid)
  if (opts?.allowFallback && opts.fallback) {
    return {
      lat: opts.fallback.lat,
      lng: opts.fallback.lng,
      label: raw,
      source: "fallback",
    };
  }

  return null;
}

/**
 * Geocode a schedule day (neighborhood + spot).
 * Uses stored lat/lng if present and still matching query fingerprint.
 */
export async function geocodeScheduleDay(day: {
  neighborhood: string;
  spot: string;
  lat?: number | null;
  lng?: number | null;
  geoQuery?: string | null;
}): Promise<GeoPoint | null> {
  const q = buildScheduleQuery(day.neighborhood, day.spot);
  if (!q) return null;

  // Reuse saved coords if query unchanged
  if (
    day.lat != null &&
    day.lng != null &&
    day.geoQuery &&
    normalizeQuery(day.geoQuery) === normalizeQuery(q)
  ) {
    return {
      lat: day.lat,
      lng: day.lng,
      label: q,
      source: "cache",
    };
  }

  return geocodePlace(q, { allowFallback: true, fallback: townFallback(q) ?? undefined });
}

/** Soft town-level fallback when full string fails */
function townFallback(query: string): { lat: number; lng: number } | null {
  const nq = normalizeQuery(query);
  const towns: [string, number, number][] = [
    ["monticello", 36.8298, -84.8491],
    ["russell springs", 37.0567, -85.0886],
    ["jamestown", 36.9848, -85.063],
    ["lake cumberland", 36.92, -84.96],
    ["somerset", 37.092, -84.6041],
    ["albany", 36.6909, -85.1347],
  ];
  for (const [name, lat, lng] of towns) {
    if (nq.includes(name)) return { lat, lng };
  }
  return null;
}

/** Town anchors for map labels (subtle, not pins) */
export const KY_TOWNS: { name: string; lat: number; lng: number }[] = [
  { name: "Monticello", lat: 36.8298, lng: -84.8491 },
  { name: "Russell Springs", lat: 37.0567, lng: -85.0886 },
  { name: "Jamestown", lat: 36.9848, lng: -85.063 },
  { name: "Lake Cumberland", lat: 36.92, lng: -84.96 },
];

/** Batch geocode with sequential delay (Nominatim-friendly) */
export async function geocodeMany(
  queries: string[],
): Promise<(GeoPoint | null)[]> {
  const out: (GeoPoint | null)[] = [];
  for (const q of queries) {
    out.push(await geocodePlace(q));
  }
  return out;
}
