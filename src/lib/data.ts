import type { DistanceKey } from "./gpx";

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
  id: "long-beach-half-2026",
  org: "Long Beach Marathon",
  name: ["Long Beach", "Half", "Marathon"],
  date: "10.12.26",
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
  bundle: 30,
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

// Approximate Boston Marathon course bbox for synthetic GPS per photo (Hopkinton → Copley).
const COURSE_LAT_RANGE: [number, number] = [42.2284, 42.3496];
const COURSE_LNG_RANGE: [number, number] = [-71.5197, -71.0779];
function photoGps(i: number): [number, number] {
  const t = (i % 36) / 35;
  const lat = COURSE_LAT_RANGE[0] + (COURSE_LAT_RANGE[1] - COURSE_LAT_RANGE[0]) * t;
  const lng = COURSE_LNG_RANGE[0] + (COURSE_LNG_RANGE[1] - COURSE_LNG_RANGE[0]) * t;
  // jitter
  return [lat + (i % 7 - 3) * 0.0006, lng + (i % 11 - 5) * 0.0009];
}

export const photos: Photo[] = Array.from({ length: 36 }, (_, i) => {
  const t = TONES[i % TONES.length];
  const sx = 20 + ((i * 17) % 60);
  const sy = 25 + ((i * 11) % 30);
  const pg = photographersRoster[i % photographersRoster.length];
  return {
    id: `p${i + 1}`,
    bib: 1240 + (i % 12),
    mile: MILES[i % MILES.length],
    time: `${2 + Math.floor(i / 12)}:${String(15 + ((i * 7) % 40)).padStart(2, "0")}:${String((i * 13) % 60).padStart(2, "0")}`,
    photographer: pg.name,
    photographerId: pg.id,
    tones: t,
    spot: [sx, sy],
    price: 10,
    gps: photoGps(i),
    takenAt: `2025-04-21T${String(10 + Math.floor(i / 12)).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}:00Z`,
    hidden: false,
  };
});

export function photoBg(p: { tones: [string, string, string]; spot: [number, number] }): string {
  const [c1, c2, c3] = p.tones;
  const [sx, sy] = p.spot;
  return `radial-gradient(ellipse 60% 40% at ${sx}% ${sy}%, ${c1} 0%, transparent 60%), linear-gradient(180deg, ${c2} 0%, ${c3} 100%)`;
}

/* ----------------------------------------------------------------
   Racer roster — used by face/bib search and (later) RD stats
   ---------------------------------------------------------------- */
const FIRST = ["Alex", "Sam", "Jamie", "Riley", "Casey", "Morgan", "Drew", "Jordan", "Taylor", "Avery", "Quinn", "Hayden"];
const LAST = ["Nguyen", "Kim", "Patel", "Garcia", "Smith", "O'Connor", "Park", "Singh", "Lee", "Brown"];
const DISTANCES_PER_BUCKET: { distance: DistanceKey; count: number; baseTime: string }[] = [
  { distance: "5k",   count: 30, baseTime: "0:24:00" },
  { distance: "10k",  count: 30, baseTime: "0:51:00" },
  { distance: "half", count: 30, baseTime: "1:52:00" },
  { distance: "full", count: 30, baseTime: "3:42:00" },
];

export const racers: Racer[] = (() => {
  const out: Racer[] = [];
  let bibCounter = 1000;
  for (const bucket of DISTANCES_PER_BUCKET) {
    for (let i = 0; i < bucket.count; i++) {
      const f = FIRST[(bibCounter * 7) % FIRST.length];
      const l = LAST[(bibCounter * 13) % LAST.length];
      out.push({
        id: `r-${bibCounter}`,
        name: `${f} ${l}`,
        email: `${f.toLowerCase()}.${l.toLowerCase().replace(/\W/g, "")}@example.com`,
        bib: bibCounter,
        distance: bucket.distance,
        finishTime: bucket.baseTime,
      });
      bibCounter++;
    }
  }
  return out;
})();

// Bib that face-search "matches" — the seeded face-suggest banner proposes this bib.
// In production this comes from the face-recognition pipeline; for the demo we just pick one.
export const FACE_SEED_BIB = 1248;
