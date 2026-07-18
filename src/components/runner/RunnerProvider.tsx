"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  findRacerByBib,
  prices,
  ROSTER_EVENT_ID,
  type Cart,
  type CartItem,
  type Order,
  type Photo,
  type Racer,
} from "@/lib/data";
import type { EventCapabilities } from "@/lib/eventConfig";

/** Display metadata for the event the runner flow is currently scoped to.
 *  Populated from the /api/photos response (multi-event: the event is derived
 *  from the /e/[slug] URL, not a hardcoded constant). */
export type RunnerEvent = {
  id: string;
  name: string;
  /** 3-slot accent-headline tuple (e.g. ["Lighthouse","Half","Marathon"]). */
  nameParts: [string, string, string];
  /** ISO date string. */
  date: string;
  city: string;
  /** Event type — "race" | "camp". Drives the runner UX (see capabilities). */
  type: string;
  /** Optional external "browse all" destination (e.g. a shared Google Photos
   *  album). When set, "Browse all photos" links out here instead of opening
   *  the in-app gallery. */
  externalBrowseUrl?: string | null;
  /** Optional owner-set override for the "Find your photos." headline. */
  searchHeadline?: string | null;
  /** Who may see the browse-everything Gallery: "public" | "owner". */
  galleryVisibility?: string | null;
};

/** Extract the event slug from a /e/[slug][/...] pathname; null elsewhere. */
function eventSlugFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(/^\/e\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// The runner cart/search/order is scoped to one event; remember which event the
// runner last engaged with so global surfaces (e.g. /checkout) know which event
// the cart belongs to.
const ACTIVE_EVENT_KEY = "mikian.activeEvent";
function readActiveEvent(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_EVENT_KEY);
  } catch {
    return null;
  }
}
function writeActiveEvent(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_EVENT_KEY, id);
  } catch {
    /* quota — ignore */
  }
}

/**
 * Server contract: POST /api/photos/face-search returns the same Photo
 * shape as the catalog plus a `faceSimilarity` annotation (0–100).
 */
type FaceSearchResponse = {
  photos: (Photo & { faceSimilarity?: number })[];
  matchCount: number;
  /** Camp color-group expansion: how many of the photos came from the runner's
   *  own face vs. their inferred color group, and the group itself. Present
   *  (non-null colorGroup) only for camp events with color grouping on. */
  faceMatchCount?: number;
  colorMatchCount?: number;
  colorGroup?: { key: string; label: string } | null;
};

/** The color group a camp face search inferred for the runner, plus how many
 *  extra teammates' photos it pulled in. null on race events / no inference. */
export type SearchColorGroup = { key: string; label: string; extraCount: number };

/** One portfolio-hero photo for the search landing (owner-featured or a random
 *  fill). `pinned` = genuinely owner-featured (vs a random fill), so the owner
 *  curation UI shows the right ★ state. */
export type FeaturedPhoto = { id: string; previewUrl: string; pinned?: boolean };

/** One row in the "Is this you?" candidate strip — a face cluster present
 *  in the bib's tagged photos, plus enough metadata for the UI to show
 *  the thumbnail and the "N more photos" promise. */
export type FaceCandidate = {
  clusterId: string;
  photoCountInBib: number;
  photoCountInEvent: number;
  /** Photo IDs (event-wide) that contain this face cluster. Used by the
   *  "Is this you?" strip to advertise "+N more photos" using only the
   *  ids NOT already in the runner's current result set. */
  photoIdsInEvent: string[];
  sampleFaceUrl: string;
  /** PhotoFace id of the sample face — sent to /api/photos/face-confirm so
   *  "This is me" searches Rekognition by this exact face (accurate + robust to
   *  clustering gaps), rather than filtering by the unreliable stored cluster. */
  sampleFaceId: string;
};

type RunnerCtx = {
  // catalog (real photos fetched from /api/photos)
  catalog: Photo[];
  catalogLoading: boolean;
  /** True (uncapped) total of the event's visible photos. The `catalog` array
   *  is capped by the API's cost guardrail, so use this for "N photos live". */
  catalogTotal: number | null;
  /** Portfolio-hero photos for the search landing — owner-featured first, then
   *  a random fill (all random when nothing is featured). */
  featuredPhotos: FeaturedPhoto[];
  /** Optimistic set of the owner's genuinely-pinned photo ids — the ★ toggle
   *  reads this for its filled/empty state. */
  featuredIds: Set<string>;
  /** Owner-only: toggle a photo's featured state (persists via the admin API)
   *  and optimistically reflect it in `featuredIds`. Rolls back + toasts on
   *  error (e.g. the column isn't migrated yet). Returns the new state. */
  toggleFeatured: (photoId: string, next: boolean) => Promise<boolean>;
  /** True when persisted state on mount indicated a prior search, so the
   *  flow can resume on the "all photos" step instead of flashing search. */
  hasHydratedSearch: boolean;
  /** True once the localStorage hydrate effect has run (whether or not it
   *  found anything) — lets the flow defer its initial-step decision until
   *  persisted state is available, avoiding a wrong "search" flash. */
  didHydrate: boolean;
  // results state
  resultPhotos: Photo[];
  /** Uncapped count of the current matched set (bib total, or face match
   *  count) — drives the teaser's "showing 6 of 142". null until known. */
  resultTotal: number | null;
  /** FULL matched-set photo ids (server-ordered, uncapped) — resultPhotos is
   *  bounded by the API display cap, so this is what a bundle covers. */
  resultIds: string[];
  /** True while a bib search's server fetch is in flight — the teaser shows a
   *  loading screen instead of the optimistic (often undercounted) results. */
  searchLoading: boolean;
  matchedRacer: Racer | null;
  searchedBib: string | null;
  /** Last search returned 0 direct matches and we fell back to showing the
   *  whole event. Lets the results screen avoid claiming "N photos found"
   *  for a bib that didn't actually match. */
  searchFellBack: boolean;
  faceDone: boolean;
  // selection + cart
  selected: Set<string>;
  cart: Cart;
  bundleInCart: boolean;
  cartCappedToBundle: boolean;
  // order
  order: Order;
  // toast
  toast: string;
  // actions
  runSearch: (s: { kind: "bib" | "face" | "browse"; value?: string }) => void;
  /** Reset to a pristine search state so the runner can search again. Clears
   *  results, matched racer, face candidates + scan status; keeps catalog,
   *  cart, and order. */
  clearSearch: () => void;
  addBib: (bib: string) => void;
  /** Network face-search: send the file to /api/photos/face-search, replace
   *  resultPhotos with the matches. Resolves on completion; no return. */
  runFaceSearch: (file: File) => Promise<void>;
  /** Additive face-search for friends/family: merges matches into the
   *  current result set instead of replacing it. */
  addFaceSearch: (file: File) => Promise<void>;
  /** True while runFaceSearch's network call is in flight — UI can show a
   *  spinner or disable the button. */
  faceScanning: boolean;
  /** Last face-search outcome — "none" before a scan, "matched" when we
   *  got hits, "empty" when the scan completed but found no faces. The
   *  ResultsScreen reads this to render an empty-state nudge. */
  faceScanStatus: "none" | "matched" | "empty";
  /** Camp only: the color group the last face search inferred for the runner,
   *  and the count of extra same-group photos folded into the results. null
   *  when the event isn't a color-grouped camp or no group could be inferred. */
  searchColorGroup: SearchColorGroup | null;
  /** Top face clusters from the most recent bib search. The "Is this you?"
   *  strip renders one tile per candidate; clicking confirms the cluster
   *  and re-runs the search with expansion enabled. Empty when the search
   *  wasn't a bib search or the bib produced no face-bearing photos. */
  faceCandidates: FaceCandidate[];
  /** The cluster the runner has confirmed as theirs (via confirmFaceCluster).
   *  When set, results are expanded with that cluster's other photos in the
   *  same event. null means "no confirmation yet" — the candidate strip
   *  stays visible. */
  confirmedClusterId: string | null;
  /** True while the post-confirmation refetch is in flight. */
  expandingCluster: boolean;
  /** True once a bib search auto-confirmed a single confident face cluster —
   *  the teaser hides the "Is this you?" prompt when this is set. */
  autoConfirmed: boolean;
  /** Owner-set bundle price (dollars) for the current event; the static
   *  default until the server reports one via /api/photos. */
  bundlePrice: number;
  /** The event this runner flow is scoped to (derived from the /e/[slug] URL).
   *  null on non-event surfaces or before the catalog fetch resolves it. */
  event: RunnerEvent | null;
  /** The event's capability set (search modes, roster, sells) — drives which
   *  flow the runner sees. null until the catalog fetch resolves it. */
  capabilities: EventCapabilities | null;
  /** The active event's id — known from the URL (or persisted for /checkout)
   *  even before `event` metadata loads. null when not scoped to an event. */
  activeEventId: string | null;
  /** True when the active event is free — checkout skips PayPal and claims the
   *  photos directly via /api/orders/free-claim. */
  isFree: boolean;
  /** "This is me" — confirm a face candidate. Searches Rekognition by the
   *  picked face and REPLACES results with every photo containing that person
   *  (drops bib photos that don't show them, adds face photos where the bib
   *  wasn't readable). Robust to clustering gaps; see the face-confirm route. */
  confirmFace: (candidate: FaceCandidate) => Promise<void>;
  /** Undo a face confirm: restore the plain bib result set. */
  clearFaceConfirm: () => Promise<void>;
  toggleSel: (id: string) => void;
  clearSel: () => void;
  addSelToCart: () => void;
  addOneToCart: (p: Photo) => void;
  addBundle: () => void;
  /** Replace the cart with a bundle covering exactly these photo ids. */
  addBundleIds: (photoIds: string[]) => void;
  removeFromCart: (uid: string) => void;
  upgradeToBundle: () => void;
  flashToast: (msg: string) => void;
  beginOrder: (total: number) => void;
  finalizeOrder: (amount: number) => Order;
  resetAll: () => void;
};

const Ctx = createContext<RunnerCtx | null>(null);
// Cart/search state is per-event (v2 multi-event) so a cart built on one event
// never bleeds into another. v2 bumped from v1 (which stored photo objects).
function storageKey(eventId: string | null): string {
  return `mikian.runner.v2.${eventId ?? "none"}`;
}

type Persisted = {
  resultPhotoIds: string[];
  searchedBib: string | null;
  matchedRacerBib: number | null;
  faceDone: boolean;
  cart: Cart;
  order: Order;
};

function loadPersisted(key: string): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as Persisted;
  } catch {
    return null;
  }
}

function savePersisted(key: string, p: Persisted) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(p));
  } catch {
    /* quota — ignore */
  }
}

/**
 * Cart "cap" used to silently rewrite singles into a bundle once their total
 * crossed the bundle price. That was a buyer-friendly nudge at production
 * pricing ($30 bundle, $10 single — three singles == bundle, give them all
 * the photos for the same money), but it backfires at test pricing where
 * bundle == $1 — the first single you add silently converts to bundle and
 * checkout buys all 1200+ photos.
 *
 * For now the cap is disabled: singles stay singles, bundle stays bundle.
 * `upgradeToBundle()` still exists for an explicit "upgrade to bundle"
 * affordance from the cart screen.
 *
 * Kept as a no-op (rather than deleted) so the upstream call site doesn't
 * have to be rewritten, and so re-enabling at launch is a one-line change.
 */
function applyBundleCap(cart: Cart): { cart: Cart; capped: boolean } {
  return { cart, capped: false };
}

/**
 * Normalize an API photo row into the UI Photo shape. The API doesn't ship
 * tones/spot (real photos don't need the gradient) and may omit photographer
 * fields, so we provide sane defaults.
 */
function apiPhotoToUi(p: {
  id: string;
  bib?: number;
  bibs?: number[];
  mile: number | null;
  gps?: [number, number] | null;
  takenAt?: string | Date | null;
  photographer?: string;
  photographerId?: string;
  previewUrl?: string;
}): Photo {
  return {
    id: p.id,
    previewUrl: p.previewUrl,
    bibs: p.bibs ?? [],
    bib: p.bib ?? p.bibs?.[0] ?? 0,
    mile: p.mile ?? 0,
    time: "",
    photographer: p.photographer ?? "",
    photographerId: p.photographerId,
    // No tones/spot for real photos — PhotoThumb falls back to gradient only
    // when previewUrl is absent.
    tones: ["#d6c3a2", "#8b7960", "#5c4f3e"],
    spot: [50, 50],
    price: 10,
    gps: p.gps ?? undefined,
    takenAt: typeof p.takenAt === "string" ? p.takenAt : p.takenAt?.toISOString?.(),
    hidden: false,
  };
}

export function RunnerProvider({ children }: { children: React.ReactNode }) {
  // Which event the flow is scoped to. The slug in the /e/[slug] URL is the
  // source of truth; fall back to the last engaged event so global surfaces
  // (e.g. /checkout) still know which event the cart belongs to.
  const pathname = usePathname();
  const slugFromPath = eventSlugFromPath(pathname);
  // Derive the active event SYNCHRONOUSLY from the URL, falling back to the
  // last engaged event only off-event (e.g. /checkout). Deriving — rather than
  // syncing through an effect — means the very first render after navigating
  // to a different event is already scoped to it, so the previous event's
  // name/photos can't paint even for a frame.
  const [fallbackEventId, setFallbackEventId] = useState<string | null>(() =>
    readActiveEvent()
  );
  const activeEventId = slugFromPath ?? fallbackEventId;
  const [event, setEvent] = useState<RunnerEvent | null>(null);
  const [capabilities, setCapabilities] = useState<EventCapabilities | null>(null);
  const [isFree, setIsFree] = useState<boolean>(false);

  useEffect(() => {
    if (slugFromPath && slugFromPath !== fallbackEventId) {
      setFallbackEventId(slugFromPath);
      writeActiveEvent(slugFromPath);
    }
  }, [slugFromPath, fallbackEventId]);

  const [catalog, setCatalog] = useState<Photo[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogTotal, setCatalogTotal] = useState<number | null>(null);
  // Full id list of the event's visible photos (server `matchedIds`) — the
  // browse-all matched set, uncapped by the display guardrail.
  const [catalogAllIds, setCatalogAllIds] = useState<string[]>([]);
  // Portfolio-hero photos for the search landing (owner-featured or random).
  const [featuredPhotos, setFeaturedPhotos] = useState<FeaturedPhoto[]>([]);
  // Optimistic set of the owner's genuinely-pinned photo ids — drives the ★
  // toggle state in the gallery/results viewer. Seeded from the landing's
  // pinned subset; updated on every toggle.
  const [featuredIds, setFeaturedIds] = useState<Set<string>>(new Set());
  const [resultPhotos, setResultPhotos] = useState<Photo[]>([]);
  const [resultTotal, setResultTotal] = useState<number | null>(null);
  // FULL matched-set photo ids (server-ordered, uncapped). `resultPhotos` is
  // bounded by the API's display cap, so bundles snapshot THESE ids — the
  // capped list was the "60 photos matched but the order only had 50" bug.
  const [resultIds, setResultIds] = useState<string[]>([]);
  // Snapshot of the pure bib result set ("all photos with the searched bib"),
  // captured before any face filter is applied. Selecting a face FILTERS this
  // set (dropping bib photos that don't show the face); clearing/changing the
  // face restores this snapshot so the dropped photos come straight back.
  const [bibBasePhotos, setBibBasePhotos] = useState<Photo[]>([]);
  const [bibBaseTotal, setBibBaseTotal] = useState<number | null>(null);
  const [bibBaseIds, setBibBaseIds] = useState<string[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasHydratedSearch, setHasHydratedSearch] = useState(false);
  const [didHydrate, setDidHydrate] = useState(false);
  const [matchedRacer, setMatchedRacer] = useState<Racer | null>(null);
  const [searchedBib, setSearchedBib] = useState<string | null>(null);
  const [searchFellBack, setSearchFellBack] = useState<boolean>(false);
  const [faceDone, setFaceDone] = useState(false);
  // In-flight + last-outcome state for runFaceSearch — surfaced via ctx so
  // the results screen can show "scanning…" / "no face found" states.
  const [faceScanning, setFaceScanning] = useState(false);
  const [faceScanStatus, setFaceScanStatus] = useState<"none" | "matched" | "empty">("none");
  // Camp color-group expansion result from the last face search (null otherwise).
  const [searchColorGroup, setSearchColorGroup] = useState<SearchColorGroup | null>(null);
  // "Is this you?" disambiguation — the bib search returns up to N face
  // candidates; clicking one moves the user from "show photos with bib N"
  // to "show photos with bib N OR sharing the runner's face cluster."
  const [faceCandidates, setFaceCandidates] = useState<FaceCandidate[]>([]);
  const [confirmedClusterId, setConfirmedClusterId] = useState<string | null>(null);
  const [expandingCluster, setExpandingCluster] = useState(false);
  // True once a bib search auto-confirmed a single confident face cluster —
  // lets the teaser suppress the "Is this you?" prompt entirely.
  const [autoConfirmed, setAutoConfirmed] = useState(false);
  // Owner-set bundle price (dollars) for the current event, reported by the
  // server (/api/photos). Falls back to the static default until then.
  const [bundlePrice, setBundlePrice] = useState<number>(prices.bundle);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cart, setCart] = useState<Cart>({ items: [] });
  const [cartCappedToBundle, setCartCapped] = useState<boolean>(false);
  const [order, setOrder] = useState<Order>({ id: "", amount: 0 });
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  const hydrated = useRef(false);
  const pendingResultIds = useRef<string[] | null>(null);
  // Monotonic search token. Bumped on every NEW search and on every event
  // switch; each async search continuation captures the token at fire time and
  // bails if it no longer matches — so a slow response can't clobber a newer
  // search, and (critically) event A's in-flight response can't repopulate
  // results/resultIds/faceCandidates under event B and leak into the bundle.
  const searchSeq = useRef(0);
  // Which event the hydrate effect last completed for. The persist effect only
  // writes when this matches the active event — otherwise the render(s)
  // between an event switch and its hydration would persist the previous
  // event's (or freshly reset, empty) state under the NEW event's key.
  const hydratedEventRef = useRef<string | null>(null);

  // Event switch: reset ALL event-scoped state the moment the active event
  // changes, in the same render (React's adjust-state-during-render form) —
  // so one event's photos, name, results, or cart never paint under another
  // event's URL, not even for a frame. The hydrate effect below then restores
  // the NEW event's own persisted state.
  const [scopedEventId, setScopedEventId] = useState<string | null>(activeEventId);
  if (scopedEventId !== activeEventId) {
    setScopedEventId(activeEventId);
    // Invalidate any in-flight search from the previous event so its response
    // can't land under the new event.
    searchSeq.current++;
    setEvent(null);
    setCapabilities(null);
    setIsFree(false);
    setCatalog([]);
    setCatalogTotal(null);
    setCatalogAllIds([]);
    setFeaturedPhotos([]);
    setFeaturedIds(new Set());
    setBundlePrice(prices.bundle);
    setResultPhotos([]);
    setResultTotal(null);
    setResultIds([]);
    setBibBasePhotos([]);
    setBibBaseTotal(null);
    setBibBaseIds([]);
    setSearchLoading(false);
    setMatchedRacer(null);
    setSearchedBib(null);
    setSearchFellBack(false);
    setFaceDone(false);
    setFaceScanStatus("none");
    setSearchColorGroup(null);
    setFaceCandidates([]);
    setConfirmedClusterId(null);
    setAutoConfirmed(false);
    setSelected(new Set());
    setCart({ items: [] });
    setCartCapped(false);
    setOrder({ id: "", amount: 0 });
  }

  // Fetch the active event's catalog (+ its display metadata + pricing) from
  // the API whenever the scoped event changes. No active event (e.g. on the
  // marketing homepage) → nothing to fetch.
  useEffect(() => {
    if (!activeEventId) {
      setCatalog([]);
      setCatalogLoading(false);
      return;
    }
    let cancelled = false;
    setCatalogLoading(true);
    // Carry a secure-link token (?k=) on the first load, before SecureLinkCookie
    // persists it — so the catalog fetch passes the same access gate the page did.
    const catalogUrl = new URL("/api/photos", window.location.origin);
    catalogUrl.searchParams.set("eventId", activeEventId);
    const k = new URLSearchParams(window.location.search).get("k");
    if (k) catalogUrl.searchParams.set("k", k);
    fetch(catalogUrl.pathname + "?" + catalogUrl.searchParams.toString())
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`/api/photos ${r.status}`))))
      .then(
        (d: {
          photos: Parameters<typeof apiPhotoToUi>[0][];
          bundlePrice?: number;
          isFree?: boolean;
          total?: number;
          matchedIds?: string[] | null;
          featured?: FeaturedPhoto[];
          event?: RunnerEvent;
          capabilities?: EventCapabilities;
        }) => {
          if (cancelled) return;
          const ui = (d.photos ?? []).map(apiPhotoToUi);
          setCatalog(ui);
          // `total` is the true uncapped event count; the photos array is
          // capped. Use total for the live count, fall back to length.
          setCatalogTotal(typeof d.total === "number" ? d.total : ui.length);
          setCatalogAllIds(
            Array.isArray(d.matchedIds) ? d.matchedIds : ui.map((p) => p.id)
          );
          if (Array.isArray(d.featured)) {
            setFeaturedPhotos(d.featured);
            // Seed the pinned set from the truly-featured subset (random fills
            // carry pinned=false), so the ★ toggle starts in the right state.
            setFeaturedIds(new Set(d.featured.filter((f) => f.pinned).map((f) => f.id)));
          }
          if (typeof d.bundlePrice === "number") setBundlePrice(d.bundlePrice);
          if (typeof d.isFree === "boolean") setIsFree(d.isFree);
          if (d.event) setEvent(d.event);
          if (d.capabilities) setCapabilities(d.capabilities);
        }
      )
      .catch((e) => {
        console.warn("photo catalog fetch failed:", e);
        if (!cancelled) setCatalog([]);
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeEventId]);

  // Hydrate non-photo state from localStorage for the ACTIVE event. Re-runs when
  // the scoped event changes so switching events loads that event's own cart /
  // search (or an empty state) rather than bleeding one event's cart into
  // another. We can't rebuild `resultPhotos` here (catalog not loaded yet); we
  // stash the IDs and apply them when the catalog arrives.
  useEffect(() => {
    const p = activeEventId ? loadPersisted(storageKey(activeEventId)) : null;
    pendingResultIds.current = p?.resultPhotoIds ?? null;
    setHasHydratedSearch(Boolean(p?.resultPhotoIds?.length) || p?.searchedBib != null);
    // The persisted id list is the FULL matched set (see the persist effect),
    // so it doubles as the restored resultIds — bundles built after a reload
    // still cover every matched photo.
    setResultIds(p?.resultPhotoIds ?? []);
    setSearchedBib(p?.searchedBib ?? null);
    setMatchedRacer(
      p?.matchedRacerBib && activeEventId === ROSTER_EVENT_ID
        ? findRacerByBib(p.matchedRacerBib) ?? null
        : null
    );
    setFaceDone(p?.faceDone ?? false);
    setCart(p?.cart ?? { items: [] });
    setOrder(p?.order ?? { id: "", amount: 0 });
    hydratedEventRef.current = activeEventId;
    hydrated.current = true;
    setDidHydrate(true);
  }, [activeEventId]);

  // Once the catalog lands, rebuild resultPhotos from any stashed IDs.
  useEffect(() => {
    if (catalogLoading) return;
    const ids = pendingResultIds.current;
    if (!ids) return;
    pendingResultIds.current = null;
    const idSet = new Set(ids);
    setResultPhotos(catalog.filter((p) => idSet.has(p.id)));
  }, [catalogLoading, catalog]);

  // Persist relevant state.
  useEffect(() => {
    // Gate on the didHydrate *state*, not the hydrated *ref*. The ref flips
    // true mid-mount-commit (set in the hydrate effect just above), so the
    // old `!hydrated.current` guard let this effect run on the very first
    // commit with stale pre-hydration state and clobber the just-loaded
    // localStorage. The state only flips on the next render, by which point
    // searchedBib/cart/order are restored. Also wait for the catalog so we
    // never persist the transient empty resultPhotos before the id-rebuild
    // (the effect below) has run.
    if (!didHydrate || catalogLoading || !activeEventId) return;
    // Never write under an event we haven't hydrated yet — between an event
    // switch and its hydrate, this effect would otherwise clobber the new
    // event's saved cart/search with reset (empty) state.
    if (hydratedEventRef.current !== activeEventId) return;
    savePersisted(storageKey(activeEventId), {
      // Persist the FULL matched set (resultIds), not the display-capped
      // resultPhotos — the hydrate effect restores it into resultIds so a
      // post-reload bundle still covers every matched photo.
      resultPhotoIds: resultIds.length > 0 ? resultIds : resultPhotos.map((p) => p.id),
      searchedBib,
      matchedRacerBib: matchedRacer?.bib ?? null,
      faceDone,
      cart,
      order,
    });
  }, [didHydrate, catalogLoading, activeEventId, resultIds, resultPhotos, searchedBib, matchedRacer, faceDone, cart, order]);

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2400);
  }, []);

  function applyCap(next: Cart) {
    const { cart: capped, capped: didCap } = applyBundleCap(next);
    setCart(capped);
    setCartCapped(didCap || capped.items.some((i) => i.kind === "bundle"));
  }

  /* --- Search flow ----------------------------------------------------
   *
   * Bib search uses the multi-bib PhotoBib table (`p.bibs.includes(n)`).
   * If no photos match the typed bib, we fall back to showing the whole
   * catalog — better UX while OCR coverage is still patchy.
   * -------------------------------------------------------------------- */
  function runSearch(s: { kind: "bib" | "face" | "browse"; value?: string }) {
    // New search → bump the token so any older in-flight response (this event's
    // previous bib, or another event's) is discarded when it lands.
    const seq = ++searchSeq.current;
    // The event this search belongs to — the async continuation double-checks
    // it against the live activeEventId as a belt-and-suspenders alongside seq.
    const searchEventId = activeEventId;
    if (s.kind === "bib" && s.value) {
      const value = s.value;
      const n = Number(value);
      // Racer-name greeting only for the event that actually has roster data
      // (Lighthouse). Other race events don't borrow Lighthouse names — fixes
      // "bib 225 → Louis" on test-one / any non-roster event.
      const racer = activeEventId === ROSTER_EVENT_ID ? findRacerByBib(value) ?? null : null;
      // Optimistic client-side filter for instant feedback. The server
      // call below upgrades this with bib-tagged results + the
      // "Is this you?" face candidates the runner can then confirm to
      // pull in additional photos that only show their face.
      const matches = catalog.filter((p) => p.bibs?.includes(n));
      // Loading until the server returns the true set/count — the teaser shows
      // a loading screen rather than the optimistic (capped, undercounted) hits.
      setSearchLoading(true);
      setMatchedRacer(racer);
      setSearchedBib(value);
      setSearchFellBack(matches.length === 0);
      setResultPhotos(matches);
      setResultIds(matches.map((p) => p.id));
      // Snapshot the bib base optimistically; the server upgrades it below.
      setBibBasePhotos(matches);
      setBibBaseTotal(null);
      setBibBaseIds(matches.map((p) => p.id));
      // Clear the prior total so the teaser shows "…" rather than the last
      // bib's count until the server reports this bib's true total.
      setResultTotal(null);
      setFaceDone(false);
      // New bib search → drop any prior confirmation; the candidate strip
      // will re-render against the new bib's face clusters.
      setConfirmedClusterId(null);
      setAutoConfirmed(false);
      setFaceCandidates([]);

      // Fire-and-forget server fetch — populates faceCandidates and
      // upgrades the bib-tagged photo set. On error we keep the client-
      // side fallback so the user isn't worse off.
      void fetch(
        `/api/photos?eventId=${encodeURIComponent(activeEventId ?? "")}&bib=${n}`
      )
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then(
          (d: {
            photos: Parameters<typeof apiPhotoToUi>[0][];
            faceCandidates?: FaceCandidate[];
            total?: number;
            matchedIds?: string[] | null;
            autoConfirmClusterId?: string | null;
            bundlePrice?: number;
          }) => {
            // Stale/cross-event response → drop it. Either a newer search
            // superseded this one, or the user switched events mid-flight.
            if (seq !== searchSeq.current || searchEventId !== activeEventId) return;
            const ui = (d.photos ?? []).map(apiPhotoToUi);
            const ids = Array.isArray(d.matchedIds)
              ? d.matchedIds
              : ui.map((p) => p.id);
            setResultPhotos(ui);
            setResultTotal(d.total ?? ui.length);
            setResultIds(ids);
            // The authoritative bib base — this is "all photos with the bib"
            // and is what a face clear/change restores to.
            setBibBasePhotos(ui);
            setBibBaseTotal(d.total ?? ui.length);
            setBibBaseIds(ids);
            setSearchFellBack(ui.length === 0);
            setFaceCandidates(d.faceCandidates ?? []);
            if (typeof d.bundlePrice === "number") setBundlePrice(d.bundlePrice);
            setSearchLoading(false);
            // Bib search returns exactly the bib's photos — no silent face
            // expansion. The runner explicitly confirms their face via the
            // "Is this you?" prompt ("This is me"), which then searches by that
            // face. (autoConfirmed is kept false so the prompt always shows.)
            setAutoConfirmed(false);
        })
        .catch((e) => {
          if (seq !== searchSeq.current || searchEventId !== activeEventId) return;
          // Keep optimistic client results on failure — don't disrupt UX.
          console.warn("bib server search failed:", e);
          setSearchLoading(false);
        });
    } else if (s.kind === "face") {
      // Face search isn't built yet — show the whole catalog so buyers can browse.
      setMatchedRacer(null);
      setSearchedBib(null);
      setSearchFellBack(true); // face match is a stub today
      setResultPhotos(catalog);
      setResultTotal(catalogTotal ?? catalog.length);
      setResultIds(catalogAllIds.length > 0 ? catalogAllIds : catalog.map((p) => p.id));
      // No bib base for a face/browse search — face clear/restore only
      // applies to a bib search.
      setBibBasePhotos([]);
      setBibBaseTotal(null);
      setBibBaseIds([]);
      setFaceDone(true);
      setFaceCandidates([]);
      setConfirmedClusterId(null);
      setAutoConfirmed(false);
    } else {
      setMatchedRacer(null);
      setSearchedBib(null);
      setSearchFellBack(false);
      setResultPhotos(catalog);
      setResultTotal(catalogTotal ?? catalog.length);
      setResultIds(catalogAllIds.length > 0 ? catalogAllIds : catalog.map((p) => p.id));
      setBibBasePhotos([]);
      setBibBaseTotal(null);
      setBibBaseIds([]);
      setFaceDone(false);
      setFaceCandidates([]);
      setConfirmedClusterId(null);
      setAutoConfirmed(false);
    }
    setSelected(new Set());
  }

  /**
   * "This is me" — confirm a face candidate. Instead of filtering by the
   * (unreliable) stored cluster, we ask the server to search Rekognition by the
   * picked face (POST /api/photos/face-confirm) and REPLACE the results with
   * every photo containing that person:
   *   - bib photos that DON'T show the runner drop out,
   *   - photos that show the runner but whose bib wasn't readable are added.
   * This is what the runner means by "these are my photos", and it's robust to
   * clustering that over- or under-merged the face (see the face-confirm route).
   */
  async function confirmFace(candidate: FaceCandidate): Promise<void> {
    if (!activeEventId || !candidate.sampleFaceId) return;
    // Refinement of the CURRENT search — capture (don't bump) the token so a
    // newer search or an event switch invalidates this confirm's response.
    const seq = searchSeq.current;
    const searchEventId = activeEventId;
    const prevClusterId = confirmedClusterId;
    // Mark confirmed immediately (drives the UI's "face active" state); rolled
    // back on failure.
    setConfirmedClusterId(candidate.clusterId);
    setExpandingCluster(true);
    try {
      const k = new URLSearchParams(window.location.search).get("k");
      const res = await fetch("/api/photos/face-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: activeEventId,
          faceId: candidate.sampleFaceId,
          ...(k ? { k } : {}),
        }),
      });
      if (!res.ok) {
        const msg = await res
          .json()
          .then((j) => (j as { error?: string }).error ?? `HTTP ${res.status}`)
          .catch(() => `HTTP ${res.status}`);
        throw new Error(msg);
      }
      const d = (await res.json()) as {
        photos: Parameters<typeof apiPhotoToUi>[0][];
        matchCount: number;
      };
      // Superseded by a newer search / event switch while we awaited → drop it.
      if (seq !== searchSeq.current || searchEventId !== activeEventId) return;
      const ui = (d.photos ?? []).map(apiPhotoToUi);
      setResultPhotos(ui);
      setResultTotal(d.matchCount ?? ui.length);
      // Face confirm returns the FULL matched set, so these ids are what a
      // bundle covers.
      setResultIds(ui.map((p) => p.id));
      setSearchFellBack(ui.length === 0);
    } catch (e) {
      console.warn("face confirm failed:", e);
      if (seq === searchSeq.current && searchEventId === activeEventId) {
        setConfirmedClusterId(prevClusterId);
        flashToast("Couldn't confirm your face — try again.");
      }
    } finally {
      setExpandingCluster(false);
    }
  }

  /**
   * Undo a face confirm: drop the face-matched set and restore the plain bib
   * results (the cached bib base captured when the bib search ran).
   */
  async function clearFaceConfirm(): Promise<void> {
    setConfirmedClusterId(null);
    if (bibBasePhotos.length > 0) {
      setResultPhotos(bibBasePhotos);
      setResultTotal(bibBaseTotal ?? bibBasePhotos.length);
      setResultIds(bibBaseIds.length > 0 ? bibBaseIds : bibBasePhotos.map((p) => p.id));
      setSearchFellBack(false);
    }
  }

  /**
   * Pull in every photo for an additional bib and merge it into the
   * current result set.
   *
   * Used to filter the cached `catalog` and cap at 12 — which broke when
   * the catalog (cost-guardrail) doesn't include all of the event's
   * photos for the bib. Now we hit `/api/photos?bib=N` so we get the
   * full server-side match list, then de-dupe against what's already on
   * screen. Falls back to the cached catalog if the network call fails
   * so the action never silently no-ops.
   */
  async function addBib(extraBib: string) {
    const n = Number(extraBib);
    if (!Number.isFinite(n) || n <= 0) return;
    // Additive to the current search — invalidated by a newer search / event
    // switch (never merge event A's extra bib into event B's results).
    const seq = searchSeq.current;
    const searchEventId = activeEventId;

    const dedupe = (extras: Photo[]) => {
      const seen = new Set(resultPhotos.map((rp) => rp.id));
      return extras.filter((p) => !seen.has(p.id));
    };
    // Merge new ids onto an id list, preserving order and skipping dupes.
    const mergeIds = (prev: string[], extras: string[]) => {
      const seen = new Set(prev);
      const fresh = extras.filter((id) => !seen.has(id));
      return fresh.length === 0 ? prev : [...prev, ...fresh];
    };
    // Keep the bib base ("all my bib photos") in sync when another bib is
    // added, so clearing a face later restores BOTH bibs' photos.
    const mergeIntoBase = (extras: Photo[]) => {
      setBibBasePhotos((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const fresh = extras.filter((p) => !seen.has(p.id));
        if (fresh.length === 0) return prev;
        setBibBaseTotal((t) => (t == null ? null : t + fresh.length));
        return [...prev, ...fresh];
      });
    };

    try {
      const r = await fetch(
        `/api/photos?eventId=${encodeURIComponent(activeEventId ?? "")}&bib=${n}`
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as {
        photos: Parameters<typeof apiPhotoToUi>[0][];
        faceCandidates?: FaceCandidate[];
        matchedIds?: string[] | null;
      };
      if (seq !== searchSeq.current || searchEventId !== activeEventId) return;
      const ui = (d.photos ?? []).map(apiPhotoToUi);
      const adds = dedupe(ui);
      const addedIds = Array.isArray(d.matchedIds)
        ? d.matchedIds
        : ui.map((p) => p.id);
      setResultPhotos([...resultPhotos, ...adds]);
      setResultTotal((prev) => (prev == null ? null : prev + adds.length));
      setResultIds((prev) => mergeIds(prev, addedIds));
      setBibBaseIds((prev) => mergeIds(prev, addedIds));
      mergeIntoBase(ui);

      // Merge the added bib's face candidates into the existing "Is this
      // you?" strip so the runner can disambiguate against the expanded
      // result set too. De-dupe by clusterId (a face that shows up under
      // multiple bibs only needs one tile).
      if (d.faceCandidates && d.faceCandidates.length > 0) {
        setFaceCandidates((curr) => {
          const seen = new Set(curr.map((c) => c.clusterId));
          const fresh = d.faceCandidates!.filter((c) => !seen.has(c.clusterId));
          return [...curr, ...fresh];
        });
      }

      flashToast(`+${adds.length} photos from bib #${extraBib}`);
    } catch (e) {
      if (seq !== searchSeq.current || searchEventId !== activeEventId) return;
      console.warn("addBib server fetch failed, falling back to catalog:", e);
      // Local fallback — won't return all photos when the catalog is
      // capped, but better than nothing.
      const local = catalog.filter((p) => p.bibs?.includes(n));
      const adds = dedupe(local);
      setResultPhotos([...resultPhotos, ...adds]);
      setResultIds((prev) => mergeIds(prev, local.map((p) => p.id)));
      setBibBaseIds((prev) => mergeIds(prev, local.map((p) => p.id)));
      mergeIntoBase(local);
      flashToast(`+${adds.length} photos from bib #${extraBib}`);
    }
  }

  /**
   * Real face search — POSTs the buyer's selfie at /api/photos/face-search,
   * replaces resultPhotos with the (similarity-sorted) matches. Tracks
   * status for the UI: idle → matched/empty.
   *
   * Always resolves; errors surface as a toast + status="empty" so the UI
   * can prompt a retry. Re-entry while `faceScanning` is true is ignored
   * (button is also expected to be disabled).
   */
  async function runFaceSearch(file: File): Promise<void> {
    if (faceScanning) return;
    // No event scope → the server 400s anyway, and the doomed request would
    // still burn a slot of the caller's rate-limit quota. Bail early.
    if (!activeEventId) {
      flashToast("Open an event first, then scan your face.");
      return;
    }
    // New search → invalidate older in-flight responses; also pin the event so
    // a slow selfie match can't land under a different event.
    const seq = ++searchSeq.current;
    const searchEventId = activeEventId;
    setFaceScanning(true);
    try {
      const form = new FormData();
      form.append("selfie", file);
      form.append("eventId", activeEventId);
      // Carry the secure-link token (if we arrived via ?k=) so a face search on
      // a locked event authorizes even before the cookie is persisted.
      const k = new URLSearchParams(window.location.search).get("k");
      if (k) form.append("k", k);
      const res = await fetch("/api/photos/face-search", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const msg = await res
          .json()
          .then((j) => (j as { error?: string }).error ?? `HTTP ${res.status}`)
          .catch(() => `HTTP ${res.status}`);
        // 429 messages are already runner-friendly ("give it a few seconds…") —
        // show them verbatim rather than under a "Face search failed:" prefix.
        flashToast(res.status === 429 ? msg : `Face search failed: ${msg}`);
        setFaceScanStatus("empty");
        return;
      }
      const data = (await res.json()) as FaceSearchResponse;
      // Superseded by a newer search / event switch while we awaited → drop it
      // (but the finally still clears faceScanning below).
      if (seq !== searchSeq.current || searchEventId !== activeEventId) return;
      if (data.matchCount === 0) {
        setFaceScanStatus("empty");
        flashToast("No face matches yet — try a clearer photo.");
        return;
      }
      // Replace the results list with the matched photos. We deliberately
      // overwrite rather than append: the buyer asked for face matches,
      // not "bib results plus face matches glued together."
      setResultPhotos(data.photos);
      setResultTotal(data.matchCount);
      // Face search returns the full matched set (no display cap), so the
      // photos themselves are the bundle id list.
      setResultIds(data.photos.map((p) => p.id));
      setBibBasePhotos([]);
      setBibBaseTotal(null);
      setBibBaseIds([]);
      setMatchedRacer(null);
      setSearchedBib(null);
      setSearchFellBack(false);
      setFaceDone(true);
      setFaceScanStatus("matched");
      // Camp color-group expansion: remember the inferred group so the results
      // screen can explain that teammates' photos were folded in.
      if (data.colorGroup && (data.colorMatchCount ?? 0) > 0) {
        setSearchColorGroup({
          key: data.colorGroup.key,
          label: data.colorGroup.label,
          extraCount: data.colorMatchCount ?? 0,
        });
        flashToast(
          `${data.faceMatchCount ?? data.matchCount} of you · +${data.colorMatchCount} from your color group`
        );
      } else {
        setSearchColorGroup(null);
        flashToast(`${data.matchCount} photo${data.matchCount === 1 ? "" : "s"} matched.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      flashToast(`Face search failed: ${msg}`);
      setFaceScanStatus("empty");
    } finally {
      setFaceScanning(false);
    }
  }

  /**
   * Additive face search — like runFaceSearch but MERGES the matched photos
   * into the current result set (dedupe by id, mirroring addBib) instead of
   * replacing it, and leaves searchedBib/matchedRacer/faceCandidates intact.
   * Powers the Step-3 "add another face" affordance for friends/family, where
   * the runner is augmenting their set rather than starting a new search.
   */
  async function addFaceSearch(file: File): Promise<void> {
    if (faceScanning) return;
    if (!activeEventId) {
      flashToast("Open an event first, then scan your face.");
      return;
    }
    // Additive to the current search — invalidated by a newer search / event
    // switch so a friend's face never merges into a different event's set.
    const seq = searchSeq.current;
    const searchEventId = activeEventId;
    setFaceScanning(true);
    try {
      const form = new FormData();
      form.append("selfie", file);
      form.append("eventId", activeEventId);
      const k = new URLSearchParams(window.location.search).get("k");
      if (k) form.append("k", k);
      const res = await fetch("/api/photos/face-search", { method: "POST", body: form });
      if (!res.ok) {
        const msg = await res
          .json()
          .then((j) => (j as { error?: string }).error ?? `HTTP ${res.status}`)
          .catch(() => `HTTP ${res.status}`);
        flashToast(res.status === 429 ? msg : `Face search failed: ${msg}`);
        return;
      }
      const data = (await res.json()) as FaceSearchResponse;
      if (seq !== searchSeq.current || searchEventId !== activeEventId) return;
      if (data.matchCount === 0) {
        flashToast("No new photos from that face.");
        return;
      }
      // Merge against the current set (closure value, like addBib): keep
      // what's on screen, append only ids we don't already have.
      const seen = new Set(resultPhotos.map((p) => p.id));
      const fresh = data.photos.filter((p) => !seen.has(p.id));
      setResultPhotos([...resultPhotos, ...fresh]);
      setResultTotal((prev) => (prev == null ? null : prev + fresh.length));
      setResultIds((prev) => {
        const have = new Set(prev);
        const add = data.photos.map((p) => p.id).filter((id) => !have.has(id));
        return add.length === 0 ? prev : [...prev, ...add];
      });
      flashToast(`+${fresh.length} photo${fresh.length === 1 ? "" : "s"} from face match`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      flashToast(`Face search failed: ${msg}`);
    } finally {
      setFaceScanning(false);
    }
  }

  /* --- Selection / cart actions -------------------------------------- */
  function toggleSel(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }
  function clearSel() {
    setSelected(new Set());
  }

  function addSelToCart() {
    const newItems: CartItem[] = [...selected]
      .map<CartItem | null>((id) => {
        const p = catalog.find((x) => x.id === id);
        if (!p) return null;
        return {
          uid: `u-${id}-${Date.now()}`,
          kind: "single",
          id,
          mile: p.mile,
          time: p.time,
          previewUrl: p.previewUrl,
          tones: p.tones,
          spot: p.spot,
          price: 10,
        };
      })
      .filter((x): x is CartItem => x !== null);
    const survivors = cart.items.filter((i) => i.kind === "bundle" || !selected.has(i.id));
    const merged = { items: [...survivors, ...newItems] };
    applyCap(merged);
    setSelected(new Set());
    flashToast(`Added ${newItems.length} to cart`);
  }

  function addOneToCart(p: Photo) {
    if (cart.items.some((i) => i.kind === "single" && i.id === p.id)) return;
    const next: Cart = {
      items: [
        ...cart.items,
        {
          uid: `u-${p.id}-${Date.now()}`,
          kind: "single",
          id: p.id,
          mile: p.mile,
          time: p.time,
          previewUrl: p.previewUrl,
          tones: p.tones,
          spot: p.spot,
          price: 10,
        },
      ],
    };
    applyCap(next);
    flashToast("Added to cart");
  }

  /** The ids a bundle should cover: the FULL matched set (uncapped server
   *  list) when we have it, else whatever's on screen. Snapshotting the
   *  display-capped resultPhotos was the "60 matched, order had 50" bug. */
  function bundleCoverageIds(): string[] {
    return resultIds.length > 0 ? resultIds : resultPhotos.map((p) => p.id);
  }

  /** Replace the cart with a bundle covering exactly `photoIds`. Exposed so
   *  surfaces with their own id list (e.g. the event gallery) can build a
   *  bundle without round-tripping through resultPhotos. */
  function addBundleIds(photoIds: string[]) {
    setCart({
      items: [
        {
          uid: `bundle-${Date.now()}`,
          kind: "bundle",
          price: bundlePrice,
          photoIds,
        },
      ],
    });
    setCartCapped(true);
  }

  /**
   * Owner-only: toggle a photo's featured (portfolio-hero) state. Optimistic —
   * flips the local pinned set immediately, POSTs to the admin API, and rolls
   * back with a toast on failure (e.g. the column isn't migrated yet). Returns
   * the resulting featured state (or the prior state on failure).
   */
  async function toggleFeatured(photoId: string, next: boolean): Promise<boolean> {
    setFeaturedIds((prev) => {
      const s = new Set(prev);
      if (next) s.add(photoId);
      else s.delete(photoId);
      return s;
    });
    try {
      const res = await fetch(`/api/admin/photos/${encodeURIComponent(photoId)}/feature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: next }),
      });
      if (!res.ok) {
        const msg = await res
          .json()
          .then((j) => (j as { error?: string }).error ?? `HTTP ${res.status}`)
          .catch(() => `HTTP ${res.status}`);
        throw new Error(msg);
      }
      flashToast(next ? "Featured on the landing" : "Removed from featured");
      return next;
    } catch (e) {
      // Roll back the optimistic flip.
      setFeaturedIds((prev) => {
        const s = new Set(prev);
        if (next) s.delete(photoId);
        else s.add(photoId);
        return s;
      });
      flashToast(e instanceof Error ? e.message : "Couldn't update featured");
      return !next;
    }
  }

  function addBundle() {
    // Always (re)snapshot the matched set NOW (while it's in memory) and
    // REPLACE any existing bundle. A bundle carries the specific photo ids
    // it covers, so a stale bundle left over from an earlier attempt (or an
    // empty one created by the checkout auto-add before hydration) must be
    // overwritten — never kept — or checkout would deliver that old/empty set,
    // which the server then expands to the WHOLE event. (This is the "9 photos
    // came back as all 1,143" bug.) An empty snapshot only happens on a browse
    // with no search; that legitimately means "every photo".
    addBundleIds(bundleCoverageIds());
    // No toast — there's no cart surface in the bundle-only flow; the bundle
    // just carries straight to checkout.
  }

  function removeFromCart(uid: string) {
    const next = { items: cart.items.filter((i) => i.uid !== uid) };
    setCart(next);
    if (!next.items.some((i) => i.kind === "bundle")) setCartCapped(false);
  }

  function upgradeToBundle() {
    addBundleIds(bundleCoverageIds());
    flashToast("Upgraded to bundle");
  }

  /* --- Order --------------------------------------------------------- */
  function beginOrder(total: number) {
    setOrder((o) => ({ ...o, amount: total }));
  }
  function finalizeOrder(amount: number): Order {
    const o: Order = {
      id: `MK-${Math.floor(Math.random() * 90000) + 10000}`,
      amount,
      items: cart.items,
      paidAt: Date.now(),
    };
    setOrder(o);
    setCart({ items: [] });
    setCartCapped(false);
    setSelected(new Set());
    return o;
  }

  /**
   * Reset just the search — used by the "search again" / back affordances so
   * the runner can re-enter a bib (e.g. after a typo). Leaves catalog, cart,
   * and order untouched.
   */
  function clearSearch() {
    setResultPhotos([]);
    setResultTotal(null);
    setResultIds([]);
    setBibBasePhotos([]);
    setBibBaseTotal(null);
    setBibBaseIds([]);
    setSearchLoading(false);
    setMatchedRacer(null);
    setSearchedBib(null);
    setSearchFellBack(false);
    setFaceDone(false);
    setFaceCandidates([]);
    setConfirmedClusterId(null);
    setAutoConfirmed(false);
    setFaceScanStatus("none");
    setSearchColorGroup(null);
    setSelected(new Set());
  }

  function resetAll() {
    setResultPhotos([]);
    setResultTotal(null);
    setResultIds([]);
    setBibBasePhotos([]);
    setBibBaseTotal(null);
    setBibBaseIds([]);
    setMatchedRacer(null);
    setSearchedBib(null);
    setSelected(new Set());
    setCart({ items: [] });
    setCartCapped(false);
    setFaceDone(false);
    setOrder({ id: "", amount: 0 });
  }

  const bundleInCart = cart.items.some((i) => i.kind === "bundle");

  const value = useMemo<RunnerCtx>(
    () => ({
      catalog,
      catalogLoading,
      catalogTotal,
      featuredPhotos,
      featuredIds,
      toggleFeatured,
      hasHydratedSearch,
      didHydrate,
      resultPhotos,
      resultTotal,
      resultIds,
      searchLoading,
      matchedRacer,
      searchedBib,
      searchFellBack,
      faceDone,
      selected,
      cart,
      bundleInCart,
      cartCappedToBundle,
      order,
      toast,
      runSearch,
      clearSearch,
      addBib,
      runFaceSearch,
      addFaceSearch,
      faceScanning,
      faceScanStatus,
      searchColorGroup,
      faceCandidates,
      confirmedClusterId,
      expandingCluster,
      autoConfirmed,
      bundlePrice,
      event,
      capabilities,
      activeEventId,
      isFree,
      confirmFace,
      clearFaceConfirm,
      toggleSel,
      clearSel,
      addSelToCart,
      addOneToCart,
      addBundle,
      addBundleIds,
      removeFromCart,
      upgradeToBundle,
      flashToast,
      beginOrder,
      finalizeOrder,
      resetAll,
    }),
    // We intentionally rebuild on every state change — context update is cheap here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog, catalogLoading, catalogTotal, catalogAllIds, featuredPhotos, featuredIds, hasHydratedSearch, didHydrate, resultPhotos, resultTotal, resultIds, bibBasePhotos, bibBaseTotal, bibBaseIds, searchLoading, matchedRacer, searchedBib, searchFellBack, faceDone, faceScanning, faceScanStatus, searchColorGroup, faceCandidates, confirmedClusterId, expandingCluster, autoConfirmed, bundlePrice, event, capabilities, activeEventId, isFree, selected, cart, cartCappedToBundle, order, toast]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRunner() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRunner outside RunnerProvider");
  return v;
}
