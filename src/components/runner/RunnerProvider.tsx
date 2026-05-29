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
import {
  currentEvent,
  findRacerByBib,
  prices,
  type BibSuggest,
  type Cart,
  type CartItem,
  type FaceSuggest,
  type Order,
  type Photo,
  type Racer,
} from "@/lib/data";

/**
 * Server contract: POST /api/photos/face-search returns the same Photo
 * shape as the catalog plus a `faceSimilarity` annotation (0–100).
 */
type FaceSearchResponse = {
  photos: (Photo & { faceSimilarity?: number })[];
  matchCount: number;
};

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
};

type RunnerCtx = {
  // catalog (real photos fetched from /api/photos)
  catalog: Photo[];
  catalogLoading: boolean;
  // results state
  resultPhotos: Photo[];
  matchedRacer: Racer | null;
  searchedBib: string | null;
  /** Last search returned 0 direct matches and we fell back to showing the
   *  whole event. Lets the results screen avoid claiming "N photos found"
   *  for a bib that didn't actually match. */
  searchFellBack: boolean;
  faceSuggest: FaceSuggest | null;
  bibSuggest: BibSuggest | null;
  faceDone: boolean;
  // selection + cart
  selected: Set<string>;
  cart: Cart;
  bundleInCart: boolean;
  cartCappedToBundle: boolean;
  // lightbox
  lightbox: Photo | null;
  // order
  order: Order;
  // toast
  toast: string;
  // actions
  runSearch: (s: { kind: "bib" | "face" | "browse"; value?: string }) => void;
  acceptFaceSuggest: () => void;
  dismissFaceSuggest: () => void;
  acceptBibSuggest: () => void;
  dismissBibSuggest: () => void;
  addBib: (bib: string) => void;
  /** Network face-search: send the file to /api/photos/face-search, replace
   *  resultPhotos with the matches. Resolves on completion; no return. */
  runFaceSearch: (file: File) => Promise<void>;
  /** True while runFaceSearch's network call is in flight — UI can show a
   *  spinner or disable the button. */
  faceScanning: boolean;
  /** Last face-search outcome — "none" before a scan, "matched" when we
   *  got hits, "empty" when the scan completed but found no faces. The
   *  ResultsScreen reads this to render an empty-state nudge. */
  faceScanStatus: "none" | "matched" | "empty";
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
  /** Confirm a face cluster: re-issues the bib search with ?cluster=<id>
   *  so the server returns the cross-link-expanded set. Pass null to
   *  un-confirm (rarely needed; useful for "actually no, that's not me"). */
  confirmFaceCluster: (clusterId: string | null) => Promise<void>;
  toggleSel: (id: string) => void;
  clearSel: () => void;
  addSelToCart: () => void;
  addOneToCart: (p: Photo) => void;
  addBundle: () => void;
  removeFromCart: (uid: string) => void;
  upgradeToBundle: () => void;
  openLightbox: (p: Photo) => void;
  closeLightbox: () => void;
  lbPrev: () => void;
  lbNext: () => void;
  flashToast: (msg: string) => void;
  beginOrder: (total: number) => void;
  finalizeOrder: (amount: number) => Order;
  resetAll: () => void;
};

const Ctx = createContext<RunnerCtx | null>(null);
const STORAGE_KEY = "mikian.runner.v2"; // bumped (v1 stored photo objects directly)

type Persisted = {
  resultPhotoIds: string[];
  searchedBib: string | null;
  matchedRacerBib: number | null;
  faceSuggest: FaceSuggest | null;
  bibSuggest: BibSuggest | null;
  faceDone: boolean;
  cart: Cart;
  order: Order;
};

function loadPersisted(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Persisted;
  } catch {
    return null;
  }
}

function savePersisted(p: Persisted) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
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
  const [catalog, setCatalog] = useState<Photo[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [resultPhotos, setResultPhotos] = useState<Photo[]>([]);
  const [matchedRacer, setMatchedRacer] = useState<Racer | null>(null);
  const [searchedBib, setSearchedBib] = useState<string | null>(null);
  const [searchFellBack, setSearchFellBack] = useState<boolean>(false);
  const [faceSuggest, setFaceSuggest] = useState<FaceSuggest | null>(null);
  const [bibSuggest, setBibSuggest] = useState<BibSuggest | null>(null);
  const [faceDone, setFaceDone] = useState(false);
  // In-flight + last-outcome state for runFaceSearch — surfaced via ctx so
  // the results screen can show "scanning…" / "no face found" states.
  const [faceScanning, setFaceScanning] = useState(false);
  const [faceScanStatus, setFaceScanStatus] = useState<"none" | "matched" | "empty">("none");
  // "Is this you?" disambiguation — the bib search returns up to N face
  // candidates; clicking one moves the user from "show photos with bib N"
  // to "show photos with bib N OR sharing the runner's face cluster."
  const [faceCandidates, setFaceCandidates] = useState<FaceCandidate[]>([]);
  const [confirmedClusterId, setConfirmedClusterId] = useState<string | null>(null);
  const [expandingCluster, setExpandingCluster] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cart, setCart] = useState<Cart>({ items: [] });
  const [cartCappedToBundle, setCartCapped] = useState<boolean>(false);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [order, setOrder] = useState<Order>({ id: "", amount: 0 });
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  const hydrated = useRef(false);
  const pendingResultIds = useRef<string[] | null>(null);

  // Fetch the event's catalog from the API on mount.
  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    fetch(`/api/photos?eventId=${encodeURIComponent(currentEvent.id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`/api/photos ${r.status}`))))
      .then((d: { photos: Parameters<typeof apiPhotoToUi>[0][] }) => {
        if (cancelled) return;
        const ui = (d.photos ?? []).map(apiPhotoToUi);
        setCatalog(ui);
      })
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
  }, []);

  // Hydrate non-photo state from localStorage once on mount. We can't rebuild
  // `resultPhotos` here because the catalog hasn't loaded yet; we stash the IDs
  // and apply them when the catalog arrives.
  useEffect(() => {
    const p = loadPersisted();
    if (p) {
      pendingResultIds.current = p.resultPhotoIds ?? null;
      setSearchedBib(p.searchedBib);
      setMatchedRacer(p.matchedRacerBib ? findRacerByBib(p.matchedRacerBib) ?? null : null);
      setFaceSuggest(p.faceSuggest);
      setBibSuggest(p.bibSuggest);
      setFaceDone(p.faceDone);
      setCart(p.cart);
      setOrder(p.order);
    }
    hydrated.current = true;
  }, []);

  // Once the catalog lands, rebuild resultPhotos from any stashed IDs.
  useEffect(() => {
    if (catalogLoading) return;
    const ids = pendingResultIds.current;
    if (!ids) return;
    pendingResultIds.current = null;
    setResultPhotos(catalog.filter((p) => ids.includes(p.id)));
  }, [catalogLoading, catalog]);

  // Persist relevant state.
  useEffect(() => {
    if (!hydrated.current) return;
    savePersisted({
      resultPhotoIds: resultPhotos.map((p) => p.id),
      searchedBib,
      matchedRacerBib: matchedRacer?.bib ?? null,
      faceSuggest,
      bibSuggest,
      faceDone,
      cart,
      order,
    });
  }, [resultPhotos, searchedBib, matchedRacer, faceSuggest, bibSuggest, faceDone, cart, order]);

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
    if (s.kind === "bib" && s.value) {
      const value = s.value;
      const n = Number(value);
      const racer = findRacerByBib(value) ?? null;
      // Optimistic client-side filter for instant feedback. The server
      // call below upgrades this with bib-tagged results + the
      // "Is this you?" face candidates the runner can then confirm to
      // pull in additional photos that only show their face.
      const matches = catalog.filter((p) => p.bibs?.includes(n));
      setMatchedRacer(racer);
      setSearchedBib(value);
      setSearchFellBack(matches.length === 0);
      setResultPhotos(matches);
      setFaceSuggest(null);
      setBibSuggest(null);
      setFaceDone(false);
      // New bib search → drop any prior confirmation; the candidate strip
      // will re-render against the new bib's face clusters.
      setConfirmedClusterId(null);
      setFaceCandidates([]);

      // Fire-and-forget server fetch — populates faceCandidates and
      // upgrades the bib-tagged photo set. On error we keep the client-
      // side fallback so the user isn't worse off.
      void fetch(
        `/api/photos?eventId=${encodeURIComponent(currentEvent.id)}&bib=${n}`
      )
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then(
          (d: {
            photos: Parameters<typeof apiPhotoToUi>[0][];
            faceCandidates?: FaceCandidate[];
          }) => {
            const ui = (d.photos ?? []).map(apiPhotoToUi);
            setResultPhotos(ui);
            setSearchFellBack(ui.length === 0);
            setFaceCandidates(d.faceCandidates ?? []);
        })
        .catch((e) => {
          // Keep optimistic client results on failure — don't disrupt UX.
          console.warn("bib server search failed:", e);
        });
    } else if (s.kind === "face") {
      // Face search isn't built yet — show the whole catalog so buyers can browse.
      setMatchedRacer(null);
      setSearchedBib(null);
      setSearchFellBack(true); // face match is a stub today
      setResultPhotos(catalog);
      setFaceSuggest(null);
      setBibSuggest(null);
      setFaceDone(true);
      setFaceCandidates([]);
      setConfirmedClusterId(null);
    } else {
      setMatchedRacer(null);
      setSearchedBib(null);
      setSearchFellBack(false);
      setResultPhotos(catalog);
      setFaceSuggest(null);
      setBibSuggest(null);
      setFaceDone(false);
      setFaceCandidates([]);
      setConfirmedClusterId(null);
    }
    setSelected(new Set());
  }

  /**
   * Confirm one of the "Is this you?" face candidates. Re-runs the bib
   * search with `?cluster=<id>` so the server returns the cross-link-
   * expanded result set (bib-tagged photos + every photo in the event
   * whose PhotoFaces share that cluster).
   *
   * Pass null to undo a prior confirmation — useful for an "actually
   * no" button.
   */
  async function confirmFaceCluster(clusterId: string | null): Promise<void> {
    if (!searchedBib) return;
    setConfirmedClusterId(clusterId);

    const n = Number(searchedBib);
    if (!Number.isFinite(n) || n <= 0) return;

    setExpandingCluster(true);
    try {
      const url = new URL("/api/photos", window.location.origin);
      url.searchParams.set("eventId", currentEvent.id);
      url.searchParams.set("bib", String(n));
      if (clusterId) url.searchParams.set("cluster", clusterId);
      const res = await fetch(url.pathname + "?" + url.searchParams.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as {
        photos: Parameters<typeof apiPhotoToUi>[0][];
        faceCandidates?: FaceCandidate[];
        crossLinked?: number;
      };
      const ui = (d.photos ?? []).map(apiPhotoToUi);
      setResultPhotos(ui);
      setSearchFellBack(ui.length === 0);
      // Refresh the strip from the server response, but ONLY overwrite
      // when the server returns a non-empty list. After a cluster confirm
      // the server occasionally returns 0 candidates (e.g. the bib's
      // photos are now all face-tagged via the expansion); clearing them
      // would yank the strip out from under the user mid-flow. The
      // existing candidates stay valid until they kick off a new bib
      // search.
      const fresh = d.faceCandidates ?? [];
      if (fresh.length > 0) setFaceCandidates(fresh);
      if (clusterId && d.crossLinked && d.crossLinked > 0) {
        flashToast(`+${d.crossLinked} more found by face match`);
      }
    } catch (e) {
      console.warn("cluster confirmation failed:", e);
      // Leave the prior result set in place; user can retry.
    } finally {
      setExpandingCluster(false);
    }
  }

  function acceptFaceSuggest() {
    if (!faceSuggest) return;
    const adds = catalog.filter(
      (p) => faceSuggest.ids.includes(p.id) && !resultPhotos.some((rp) => rp.id === p.id)
    );
    setResultPhotos([...resultPhotos, ...adds]);
    flashToast(`+${adds.length} photos from face match`);
    setFaceSuggest(null);
    setFaceDone(true);
  }

  function acceptBibSuggest() {
    if (!bibSuggest) return;
    const adds = catalog.filter(
      (p) => bibSuggest.ids.includes(p.id) && !resultPhotos.some((rp) => rp.id === p.id)
    );
    setResultPhotos([...resultPhotos, ...adds]);
    flashToast(`+${adds.length} photos from bib #${bibSuggest.bib}`);
    setBibSuggest(null);
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

    const dedupe = (extras: Photo[]) => {
      const seen = new Set(resultPhotos.map((rp) => rp.id));
      return extras.filter((p) => !seen.has(p.id));
    };

    try {
      const r = await fetch(
        `/api/photos?eventId=${encodeURIComponent(currentEvent.id)}&bib=${n}`
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as {
        photos: Parameters<typeof apiPhotoToUi>[0][];
        faceCandidates?: FaceCandidate[];
      };
      const ui = (d.photos ?? []).map(apiPhotoToUi);
      const adds = dedupe(ui);
      setResultPhotos([...resultPhotos, ...adds]);

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
      console.warn("addBib server fetch failed, falling back to catalog:", e);
      // Local fallback — won't return all photos when the catalog is
      // capped, but better than nothing.
      const adds = dedupe(catalog.filter((p) => p.bibs?.includes(n)));
      setResultPhotos([...resultPhotos, ...adds]);
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
    setFaceScanning(true);
    try {
      const form = new FormData();
      form.append("selfie", file);
      form.append("eventId", currentEvent.id);
      const res = await fetch("/api/photos/face-search", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const msg = await res
          .json()
          .then((j) => (j as { error?: string }).error ?? `HTTP ${res.status}`)
          .catch(() => `HTTP ${res.status}`);
        flashToast(`Face search failed: ${msg}`);
        setFaceScanStatus("empty");
        return;
      }
      const data = (await res.json()) as FaceSearchResponse;
      if (data.matchCount === 0) {
        setFaceScanStatus("empty");
        flashToast("No face matches yet — try a clearer photo.");
        return;
      }
      // Replace the results list with the matched photos. We deliberately
      // overwrite rather than append: the buyer asked for face matches,
      // not "bib results plus face matches glued together."
      setResultPhotos(data.photos);
      setMatchedRacer(null);
      setSearchedBib(null);
      setSearchFellBack(false);
      setFaceSuggest(null);
      setBibSuggest(null);
      setFaceDone(true);
      setFaceScanStatus("matched");
      flashToast(`${data.matchCount} photo${data.matchCount === 1 ? "" : "s"} matched.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      flashToast(`Face search failed: ${msg}`);
      setFaceScanStatus("empty");
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

  function addBundle() {
    if (cart.items.some((i) => i.kind === "bundle")) return;
    setCart({ items: [{ uid: `bundle-${Date.now()}`, kind: "bundle", price: prices.bundle }] });
    setCartCapped(true);
    flashToast("Bundle added to cart");
  }

  function removeFromCart(uid: string) {
    const next = { items: cart.items.filter((i) => i.uid !== uid) };
    setCart(next);
    if (!next.items.some((i) => i.kind === "bundle")) setCartCapped(false);
  }

  function upgradeToBundle() {
    setCart({ items: [{ uid: `bundle-${Date.now()}`, kind: "bundle", price: prices.bundle }] });
    setCartCapped(true);
    flashToast("Upgraded to bundle");
  }

  /* --- Lightbox helpers ---------------------------------------------- */
  const openLightbox = useCallback((p: Photo) => setLightbox(p), []);
  const closeLightbox = useCallback(() => setLightbox(null), []);
  const lbPrev = useCallback(() => {
    setLightbox((cur) => {
      if (!cur) return cur;
      const i = resultPhotos.findIndex((p) => p.id === cur.id);
      return resultPhotos[(i - 1 + resultPhotos.length) % resultPhotos.length];
    });
  }, [resultPhotos]);
  const lbNext = useCallback(() => {
    setLightbox((cur) => {
      if (!cur) return cur;
      const i = resultPhotos.findIndex((p) => p.id === cur.id);
      return resultPhotos[(i + 1) % resultPhotos.length];
    });
  }, [resultPhotos]);

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

  function resetAll() {
    setResultPhotos([]);
    setMatchedRacer(null);
    setSearchedBib(null);
    setSelected(new Set());
    setCart({ items: [] });
    setCartCapped(false);
    setFaceSuggest(null);
    setBibSuggest(null);
    setFaceDone(false);
    setLightbox(null);
    setOrder({ id: "", amount: 0 });
  }

  /* --- Keyboard ------------------------------------------------------ */
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (lightbox) {
        if (e.key === "Escape") closeLightbox();
        if (e.key === "ArrowLeft") lbPrev();
        if (e.key === "ArrowRight") lbNext();
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [lightbox, closeLightbox, lbPrev, lbNext]);

  const bundleInCart = cart.items.some((i) => i.kind === "bundle");

  const value = useMemo<RunnerCtx>(
    () => ({
      catalog,
      catalogLoading,
      resultPhotos,
      matchedRacer,
      searchedBib,
      searchFellBack,
      faceSuggest,
      bibSuggest,
      faceDone,
      selected,
      cart,
      bundleInCart,
      cartCappedToBundle,
      lightbox,
      order,
      toast,
      runSearch,
      acceptFaceSuggest,
      dismissFaceSuggest: () => setFaceSuggest(null),
      acceptBibSuggest,
      dismissBibSuggest: () => setBibSuggest(null),
      addBib,
      runFaceSearch,
      faceScanning,
      faceScanStatus,
      faceCandidates,
      confirmedClusterId,
      expandingCluster,
      confirmFaceCluster,
      toggleSel,
      clearSel,
      addSelToCart,
      addOneToCart,
      addBundle,
      removeFromCart,
      upgradeToBundle,
      openLightbox,
      closeLightbox,
      lbPrev,
      lbNext,
      flashToast,
      beginOrder,
      finalizeOrder,
      resetAll,
    }),
    // We intentionally rebuild on every state change — context update is cheap here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog, catalogLoading, resultPhotos, matchedRacer, searchedBib, searchFellBack, faceSuggest, bibSuggest, faceDone, faceScanning, faceScanStatus, faceCandidates, confirmedClusterId, expandingCluster, selected, cart, cartCappedToBundle, lightbox, order, toast]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRunner() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRunner outside RunnerProvider");
  return v;
}
