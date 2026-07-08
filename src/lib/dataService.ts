/**
 * Data Abstraction Layer for TruckDash Catering feature.
 *
 * This provides a clean interface for all catering-related data operations.
 * Currently implemented with localStorage for demo / offline mode.
 *
 * === FUTURE SUPABASE MIGRATION NOTES ===
 * To switch to Supabase (or any backend):
 *   1. Import your Supabase client here (e.g. from '@/lib/supabase')
 *   2. Replace the localStorage logic in each function with async Supabase calls:
 *        - saveInquiry -> supabase.from('catering_inquiries').insert(...)
 *        - getInquiries -> supabase.from('catering_inquiries').select(...).order(...)
 *        - saveProfile / getProfile -> use a 'catering_profiles' table (or user metadata / a single row per truck)
 *   3. Add error handling / RLS as needed.
 *   4. The public API (function signatures + return types) should stay the same
 *      so the rest of the app doesn't need changes.
 *
 * All functions are async to make the future transition seamless.
 */

import type { CateringInquiry, CateringSettings } from "./truck-state";

// Re-export types for convenience so consumers only need to import from here if desired.
export type { CateringInquiry, CateringSettings };

// Separate "profile" shape for the data service (focused on what the task asks for).
// This maps closely to the legacy CateringSettings but is now independently persisted.
export interface CateringProfile {
  notificationEmail: string; // Owner notification / "simulate send to" email
  serviceArea: string;
  introMessage: string;
  signaturePackages: CateringSettings["signaturePackages"];
}

const PROFILE_KEY = "truckdash.catering.profile";
const INQUIRIES_KEY = "truckdash.catering.inquiries";

// Default profile (used when nothing is saved yet)
const DEFAULT_PROFILE: CateringProfile = {
  notificationEmail: "hello@bluegrasskitchen.example.com",
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

/**
 * Load the catering profile.
 * Falls back to sensible defaults if nothing has been saved.
 */
export async function getProfile(): Promise<CateringProfile> {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Defensive merge in case shape changes over time
      return { ...DEFAULT_PROFILE, ...parsed };
    }
  } catch (err) {
    console.warn("[dataService] Failed to read profile from localStorage", err);
  }
  return { ...DEFAULT_PROFILE };
}

/**
 * Persist the catering profile.
 * In a real backend this would be an upsert for the current truck/user.
 */
export async function saveProfile(profile: CateringProfile): Promise<void> {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error("[dataService] Failed to save profile", err);
    throw err;
  }
}

/**
 * Save a new inquiry.
 * Returns the created inquiry (with id + timestamp).
 */
export async function saveInquiry(
  inquiryData: Omit<CateringInquiry, "id" | "submittedAt" | "status">,
): Promise<CateringInquiry> {
  const newInquiry: CateringInquiry = {
    ...inquiryData,
    id: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
    status: "new",
  };

  try {
    const raw = localStorage.getItem(INQUIRIES_KEY);
    const list: CateringInquiry[] = raw ? JSON.parse(raw) : [];
    // newest first
    const updated = [newInquiry, ...list].slice(0, 100); // keep a reasonable cap
    localStorage.setItem(INQUIRIES_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("[dataService] Failed to save inquiry", err);
    throw err;
  }

  return newInquiry;
}

/**
 * Get all inquiries (newest first).
 */
export async function getInquiries(): Promise<CateringInquiry[]> {
  try {
    const raw = localStorage.getItem(INQUIRIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("[dataService] Failed to read inquiries", err);
    return [];
  }
}

/**
 * (Optional helper for owner) Mark an inquiry as contacted.
 * You can expand this later with more status updates.
 */
export async function markInquiryContacted(id: string): Promise<void> {
  try {
    const raw = localStorage.getItem(INQUIRIES_KEY);
    if (!raw) return;
    const list: CateringInquiry[] = JSON.parse(raw);
    const updated = list.map((inq) =>
      inq.id === id ? { ...inq, status: "contacted" as const } : inq,
    );
    localStorage.setItem(INQUIRIES_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("[dataService] Failed to mark inquiry contacted", err);
  }
}

// Utility: seed defaults the first time (useful for demo resets)
export async function resetCateringDemoData(): Promise<void> {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(DEFAULT_PROFILE));
    localStorage.removeItem(INQUIRIES_KEY);
  } catch {
    /* ignore reset errors in demo */
  }
}
