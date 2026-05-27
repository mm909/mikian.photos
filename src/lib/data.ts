import type { DistanceKey } from "./gpx";
import { LIGHTHOUSE_RACERS, racerByBib } from "./lighthouseRoster";

export type EventStatus = "live" | "recent";

export type CurrentEvent = {
  id: string;
  org: string;
  name: [string, string, string];
  date: string;
  city: string;
  photoCount: number;
  photographers: number;
  status: EventStatus;
};

export type Role = "runner" | "photographer" | "race_director" | "admin";

export type User = {
  id: string;
  name: string;
  email: string;
  picture?: string;
  roles: Role[];
};

export type Photographer = {
  id: string;
  name: string;
  email: string;
};

export type Racer = {
  id: string;
  name: string;
  email: string;
  bib: number;
  distance: DistanceKey;
  finishTime: string;
};

export type Photo = {
  id: string;
  bib: number;
  mile: number;
  time: string;
  photographer: string;
  photographerId?: string;
  tones: [string, string, string];
  spot: [number, number];
  price: number;
  gps?: [number, number];
  takenAt?: string;
  hidden?: boolean;
};

export type Prices = {
  single: number;
  bundle: number;
  stripeRate: number;
  stripeFlat: number;
};

export type SingleCartItem = {
  uid: string;
  kind: "single";
  id: string;
  mile: number;
  time: string;
  tones: [string, string, string];
  spot: [number, number];
  price: number;
};

export type BundleCartItem = {
  uid: string;
  kind: "bundle";
  price: number;
};

export type CartItem = SingleCartItem | BundleCartItem;

export type Cart = { items: CartItem[] };

export type FaceSuggest = {
  bib: string;
  count: number;
  tones: [string, string, string][];
  ids: string[];
};

export type Order = {
  id: string;
  amount: number;
  items?: CartItem[];
  paidAt?: number;
  email?: string;
};

export type BibSuggest = {
  bib: string;
  count: number;
  tones: [string, string, string][];
  ids: string[];
};

export const currentEvent: CurrentEvent = {
  id: "lighthouse-half-2026",
  org: "Elite Sports California",
  name: ["Lighthouse", "Half", "Marathon"],
  date: "05.24.26",
  city: "Long Beach, CA",
  photoCount: 1248,
  photographers: 4,
  status: "live",
};

export const photographersRoster: Photographer[] = [
  { id: "pg-mara",  name: "Mara K.",  email: "mara@mikian.photos"  },
  { id: "pg-jules", name: "Jules C.", email: "jules@mikian.photos" },
  { id: "pg-devon", name: "Devon L.", email: "devon@mikian.photos" },
  { id: "pg-sam",   name: "Sam P.",   email: "sam@mikian.photos"   },
];

export const prices: Prices = {
  single: 10,
  bundle: 1,
  stripeRate: 0.029,
  stripeFlat: 0.3,
};

const TONES: [string, string, string][] = [
  ["#d6c3a2", "#8b7960", "#5c4f3e"],
  ["#e8d5b0", "#a08766", "#6b5a45"],
  ["#c4a886", "#7a6850", "#4a3f30"],
  ["#dcc8a4", "#92805f", "#5e4e3c"],
  ["#e0c9a0", "#aa8e69", "#705e48"],
  ["#cab39a", "#8c7a5e", "#54483a"],
];

const MILES = [3, 6, 10, 13, 18, 21, 24, 26];

// Approximate Long Beach shoreline bbox (Lions Lighthouse → eastern turnaround)
// for synthetic GPS positions in DEMO_PHOTOS only. Real photos arrive with EXIF GPS.
const COURSE_LAT_RANGE: [number, number] = [33.7574, 33.7600];
const COURSE_LNG_RANGE: [number, number] = [-118.1905, -118.1430];
function photoGps(i: number): [number, number] {
  const t = (i % 36) / 35;
  const lat = COURSE_LAT_RANGE[0] + (COURSE_LAT_RANGE[1] - COURSE_LAT_RANGE[0]) * t;
  const lng = COURSE_LNG_RANGE[0] + (COURSE_LNG_RANGE[1] - COURSE_LNG_RANGE[0]) * t;
  // jitter
  return [lat + (i % 7 - 3) * 0.0006, lng + (i % 11 - 5) * 0.0009];
}

// Real photo catalog for the event. Empty until photographer uploads land.
// When you drop a real Photo[] in here (or wire an API), bib search + face
// search will return matches automatically — no other code change needed.
export const photos: Photo[] = [];

// Kept around as a demo fallback. Pre-generated procedural photos against
// the real Lighthouse bib pool — useful for previewing the results / lightbox /
// checkout UI when no real photos exist yet. Not exposed by default; opt in by
// importing { DEMO_PHOTOS } from "@/lib/data" and substituting at the call site.
export const DEMO_PHOTOS: Photo[] = LIGHTHOUSE_RACERS.slice(0, 36).map((r, i) => {
  const t = TONES[i % TONES.length];
  const sx = 20 + ((i * 17) % 60);
  const sy = 25 + ((i * 11) % 30);
  const pg = photographersRoster[i % photographersRoster.length];
  return {
    id: `p${i + 1}`,
    bib: r.bib,
    mile: MILES[i % MILES.length],
    time: r.chipTime,
    photographer: pg.name,
    photographerId: pg.id,
    tones: t,
    spot: [sx, sy],
    price: 10,
    gps: photoGps(i),
    takenAt: `2026-05-24T${String(10 + Math.floor(i / 12)).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}:00Z`,
    hidden: false,
  };
});

export function photoBg(p: { tones: [string, string, string]; spot: [number, number] }): string {
  const [c1, c2, c3] = p.tones;
  const [sx, sy] = p.spot;
  return `radial-gradient(ellipse 60% 40% at ${sx}% ${sy}%, ${c1} 0%, transparent 60%), linear-gradient(180deg, ${c2} 0%, ${c3} 100%)`;
}

/* ----------------------------------------------------------------
   Racer roster — real 2026 Lighthouse Half Marathon finishers
   (loaded from src/lib/lighthouseRoster.ts). All entries are the
   half distance; 5K and 10K rosters not yet wired.
   ---------------------------------------------------------------- */
export const racers: Racer[] = LIGHTHOUSE_RACERS.map((r) => ({
  id: `r-${r.bib}`,
  name: r.name,
  email: "", // not collected publicly; comes from the racer's account when they sign in
  bib: r.bib,
  distance: "half" as DistanceKey,
  finishTime: r.chipTime,
}));

export function findRacerByBib(bib: number | string): Racer | undefined {
  const r = racerByBib(bib);
  if (!r) return undefined;
  return {
    id: `r-${r.bib}`,
    name: r.name,
    email: "",
    bib: r.bib,
    distance: "half",
    finishTime: r.chipTime,
  };
}

// Bib that face-search "matches" — the seeded face-suggest banner proposes this bib.
// Pick a real Lighthouse runner so it lands credibly.
export const FACE_SEED_BIB = 288;
