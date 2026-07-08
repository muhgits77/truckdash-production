import { useEffect, useState } from "react";

/**
 * Shared types and persistence for Bluegrass Kitchen TruckDash.
 * Used by dashboard (index) and dedicated /this-week schedule page.
 * Persists to localStorage for easy weekly updates.
 */

export type ScheduleDay = {
  id: string;
  day: string; // MON, TUE, ...
  neighborhood: string; // Location / Neighborhood (e.g. "Downtown Monticello")
  spot: string; // Specific Spot / address / venue
  hoursStart: string;
  hoursEnd: string;
  closed?: boolean;
  note?: string; // e.g. "Festival", "Prep day", "Closed", "Family day"
};

export type MenuItem = {
  id: string;
  name: string;
  price: string;
  description?: string;
  /** Local data/blob URL before publish; public storage URL after publish. */
  image?: string;
};

export type TemplateId =
  | "lakecumberland"
  | "festival"
  | "bourbonbarrel"
  | "bright"
  | "bbq"
  | "moody"
  | "minimal"
  | "boldbbq"
  | "rustic"
  | "clean";

export type ShareFormat = "portrait" | "story" | "square";
export type BackgroundId =
  "paper" | "cream-grid" | "kraft" | "sunset-gradient" | "sage-linen" | "charcoal-grain";

export type TruckState = {
  name: string;
  live: boolean;
  location: string;
  hoursStart: string;
  hoursEnd: string;
  special: string;
  menu: MenuItem[];
  orderUrl: string;
  qrUrl: string;
  template: TemplateId;
  heroPhoto?: string;
  shareFormat: ShareFormat;
  background: BackgroundId;
  phone: string;
  schedule: ScheduleDay[];
  // Catering feature (owner-configurable, used by public form + dashboard)
  catering: CateringSettings;
};

export type CateringSettings = {
  enabled: boolean;
  contactEmail: string;
  contactPhone: string;
  serviceArea: string;
  introMessage: string;
  signaturePackages: Array<{
    id: string;
    name: string;
    description: string;
    serves: string; // e.g. "Serves 25-40"
  }>;
};

export type CateringInquiry = {
  id: string;
  submittedAt: string; // ISO
  name: string;
  email: string;
  phone: string;
  eventDate: string;
  eventTime: string;
  guests: number;
  location: string;
  eventType: string;
  menuInterests: string;
  budget: string;
  notes: string;
  status: "new" | "contacted";
};

export const DEFAULT_SCHEDULE: ScheduleDay[] = [
  {
    id: "d1",
    day: "MON",
    neighborhood: "Prep Day",
    spot: "—",
    hoursStart: "",
    hoursEnd: "",
    closed: true,
    note: "Kitchen prep",
  },
  {
    id: "d2",
    day: "TUE",
    neighborhood: "Downtown Monticello",
    spot: "Courthouse Square",
    hoursStart: "11:00 AM",
    hoursEnd: "2:00 PM",
  },
  {
    id: "d3",
    day: "WED",
    neighborhood: "Russell Springs",
    spot: "Main St. Lot (by the bank)",
    hoursStart: "11:00 AM",
    hoursEnd: "2:00 PM",
  },
  {
    id: "d4",
    day: "THU",
    neighborhood: "Jamestown",
    spot: "Lakeway Shopping Center",
    hoursStart: "11:00 AM",
    hoursEnd: "2:00 PM",
  },
  {
    id: "d5",
    day: "FRI",
    neighborhood: "Food Truck Friday",
    spot: "Russell Springs · Downtown",
    hoursStart: "5:00 PM",
    hoursEnd: "9:00 PM",
  },
  {
    id: "d6",
    day: "SAT",
    neighborhood: "Lake Cumberland",
    spot: "State Dock · Main Ramp",
    hoursStart: "12:00 PM",
    hoursEnd: "8:00 PM",
  },
  {
    id: "d7",
    day: "SUN",
    neighborhood: "Off",
    spot: "—",
    hoursStart: "",
    hoursEnd: "",
    closed: true,
    note: "Family day",
  },
];

export const DEFAULT_CATERING: CateringSettings = {
  enabled: true,
  contactEmail: "hello@bluegrasskitchen.example.com",
  contactPhone: "(555) 123-4567",
  serviceArea:
    "Lake Cumberland, Russell Springs, Monticello, Jamestown & surrounding Central Kentucky",
  introMessage:
    "Bring authentic Bluegrass Kitchen flavors to your next gathering. From intimate private parties to large corporate events and festivals — we handle the food so you can enjoy the moment.",
  signaturePackages: [
    {
      id: "p1",
      name: "Bourbon BBQ Spread",
      description: "Pulled pork, brisket sliders, slaw, baked beans & sweet tea",
      serves: "Serves 25–40",
    },
    {
      id: "p2",
      name: "Southern Feast",
      description: "Fried chicken, mac & cheese, greens, cornbread & desserts",
      serves: "Serves 30–60",
    },
    {
      id: "p3",
      name: "Festival Package",
      description: "Build-your-own nachos & taco bar with all the fixings",
      serves: "Serves 50+",
    },
  ],
};

export const DEFAULT_STATE: TruckState = {
  name: "Bluegrass Kitchen",
  live: true,
  location: "Food Truck Friday · Russell Springs",
  hoursStart: "5:00 PM",
  hoursEnd: "9:00 PM",
  special: "Bourbon-Glazed Pulled Pork Nachos",
  menu: [
    { id: "1", name: "Pulled Pork Sandwich", price: "10" },
    { id: "2", name: "Bourbon Nachos", price: "12" },
    { id: "3", name: "Bluegrass Slaw", price: "4" },
    { id: "4", name: "Kettle Chips", price: "3" },
    { id: "5", name: "Sweet Tea", price: "3" },
  ],
  orderUrl: "https://order.example.com/bluegrass-kitchen",
  qrUrl: "",
  template: "lakecumberland",
  shareFormat: "portrait",
  background: "sage-linen",
  phone: "(555) 123-4567",
  schedule: DEFAULT_SCHEDULE,
  catering: DEFAULT_CATERING,
};

export const APP_VERSION = "0.5.0";
export const STORAGE_KEY = "truckdash.state.v1";
export const VERSION_KEY = "truckdash.version";
export const ONBOARD_KEY = "truckdash.onboarded.v5";

/**
 * Hook for loading/saving the full TruckState.
 * Auto-persists on change. Safe for multiple components/routes.
 * Schedule lives here so /this-week and dashboard stay in sync.
 */
export function useTruckState() {
  // Always start with defaults so SSR HTML matches the first client paint.
  // localStorage is applied only after mount (see useEffect below).
  const [state, setState] = useState<TruckState>(DEFAULT_STATE);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Merge defensively so new fields don't break old saved data
        setState({
          ...DEFAULT_STATE,
          ...parsed,
          schedule: parsed.schedule ?? DEFAULT_STATE.schedule,
          catering: parsed.catering ?? DEFAULT_STATE.catering,
        });
      }
    } catch {
      // ignore corrupt storage
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    // Don't persist until we've finished the initial localStorage read,
    // otherwise DEFAULT_STATE would overwrite the owner's real data.
    if (!storageReady) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full or blocked — non-fatal
    }
  }, [state, storageReady]);

  return [state, setState] as const;
}

/** Helper to update only the schedule portion while keeping full state in sync */
export function updateSchedule(state: TruckState, newSchedule: ScheduleDay[]): TruckState {
  return { ...state, schedule: newSchedule };
}
