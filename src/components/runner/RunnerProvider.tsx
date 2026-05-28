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
  scanFaceOnResults: () => void;
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
 * If singles-only subtotal hits the bundle price, auto-replace singles with
 * a single BundleCartItem. Idempotent.
 */
function applyBundleCap(cart: Cart): { cart: Cart; capped: boolean } {
  if (cart.items.some((i) => i.kind === "bundle")) return { cart, capped: false };
  const singlesTotal = cart.items.reduce((s, i) => s + i.price, 0);
  if (singlesTotal >= prices.bundle && cart.items.length > 0) {
    return {
      cart: { items: [{ uid: `bundle-${Date.now()}`, kind: "bundle", price: prices.bundle }] },
      capped: true,
    };
  }
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
      const matches = catalog.filter((p) => p.bibs?.includes(n));
      // Bib search with no hits → do NOT fall back to the whole catalog;
      // the user prefers to be prompted into a face search instead. The
      // ResultsScreen empty state surfaces a "Scan your face" CTA.
      const noMatches = matches.length === 0;
      setMatchedRacer(racer);
      setSearchedBib(value);
      setSearchFellBack(noMatches);
      setResultPhotos(matches);
      setFaceSuggest(null);
      setBibSuggest(null);
      setFaceDone(false);
    } else if (s.kind === "face") {
      // Face search isn't built yet — show the whole catalog so buyers can browse.
      setMatchedRacer(null);
      setSearchedBib(null);
      setSearchFellBack(true); // face match is a stub today
      setResultPhotos(catalog);
      setFaceSuggest(null);
      setBibSuggest(null);
      setFaceDone(true);
    } else {
      setMatchedRacer(null);
      setSearchedBib(null);
      setSearchFellBack(false);
      setResultPhotos(catalog);
      setFaceSuggest(null);
      setBibSuggest(null);
      setFaceDone(false);
    }
    setSelected(new Set());
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

  function addBib(extraBib: string) {
    const n = Number(extraBib);
    const adds = catalog
      .filter((p) => p.bibs?.includes(n) && !resultPhotos.some((rp) => rp.id === p.id))
      .slice(0, 12);
    setResultPhotos([...resultPhotos, ...adds]);
    flashToast(`+${adds.length} photos from bib #${extraBib}`);
  }

  function scanFaceOnResults() {
    if (faceDone) return;
    setFaceDone(true);
    setFaceSuggest(null);
    // Face match isn't built yet; this is now a no-op for the data layer.
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
      scanFaceOnResults,
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
    [catalog, catalogLoading, resultPhotos, matchedRacer, searchedBib, searchFellBack, faceSuggest, bibSuggest, faceDone, selected, cart, cartCappedToBundle, lightbox, order, toast]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRunner() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRunner outside RunnerProvider");
  return v;
}
