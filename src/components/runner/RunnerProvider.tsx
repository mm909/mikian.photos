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
  findRacerByBib,
  photos as ALL_PHOTOS,
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
  // results state
  resultPhotos: Photo[];
  matchedRacer: Racer | null;
  searchedBib: string | null;
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
const STORAGE_KEY = "mikian.runner.v1";

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

export function RunnerProvider({ children }: { children: React.ReactNode }) {
  const [resultPhotos, setResultPhotos] = useState<Photo[]>([]);
  const [matchedRacer, setMatchedRacer] = useState<Racer | null>(null);
  const [searchedBib, setSearchedBib] = useState<string | null>(null);
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

  // Hydrate from localStorage once on mount
  useEffect(() => {
    const p = loadPersisted();
    if (p) {
      setResultPhotos(ALL_PHOTOS.filter((ph) => p.resultPhotoIds.includes(ph.id)));
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

  // Persist on relevant changes
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

  /* --- Search flow ---------------------------------------------------- */
  function runSearch(s: { kind: "bib" | "face" | "browse"; value?: string }) {
    if (s.kind === "bib" && s.value) {
      const value = s.value;
      const racer = findRacerByBib(value) ?? null;
      const matches = ALL_PHOTOS.filter((p) => p.bib === Number(value));
      setMatchedRacer(racer);
      setSearchedBib(value);
      setResultPhotos(matches);
      // Face-suggest is meaningful when we have a real photo catalog to draw from.
      // Skip it in empty-catalog mode so we don't show fake stacked thumbs.
      if (matches.length > 0) {
        const sugg = ALL_PHOTOS.filter((p) => p.bib !== Number(value)).slice(0, 6);
        setFaceSuggest(
          sugg.length > 0
            ? {
                bib: value,
                count: sugg.length,
                tones: sugg.slice(0, 3).map((p) => p.tones),
                ids: sugg.map((p) => p.id),
              }
            : null
        );
      } else {
        setFaceSuggest(null);
      }
      setBibSuggest(null);
      setFaceDone(false);
    } else if (s.kind === "face") {
      const matches = ALL_PHOTOS.slice(0, 18);
      setMatchedRacer(null);
      setSearchedBib(null);
      setResultPhotos(matches);
      setFaceSuggest(null);
      setBibSuggest(
        matches.length > 0
          ? {
              bib: String(matches[0]?.bib ?? ""),
              count: 6,
              tones: ALL_PHOTOS.slice(18, 21).map((p) => p.tones),
              ids: ALL_PHOTOS.slice(18, 24).map((p) => p.id),
            }
          : null
      );
      setFaceDone(true);
    } else {
      const matches = ALL_PHOTOS;
      setMatchedRacer(null);
      setSearchedBib(null);
      setResultPhotos(matches);
      setFaceSuggest(null);
      setBibSuggest(null);
      setFaceDone(false);
    }
    setSelected(new Set());
  }

  function acceptFaceSuggest() {
    if (!faceSuggest) return;
    const adds = ALL_PHOTOS.filter(
      (p) => faceSuggest.ids.includes(p.id) && !resultPhotos.some((rp) => rp.id === p.id)
    );
    setResultPhotos([...resultPhotos, ...adds]);
    flashToast(`+${adds.length} photos from face match`);
    setFaceSuggest(null);
    setFaceDone(true);
  }

  function acceptBibSuggest() {
    if (!bibSuggest) return;
    const adds = ALL_PHOTOS.filter(
      (p) => bibSuggest.ids.includes(p.id) && !resultPhotos.some((rp) => rp.id === p.id)
    );
    setResultPhotos([...resultPhotos, ...adds]);
    flashToast(`+${adds.length} photos from bib #${bibSuggest.bib}`);
    setBibSuggest(null);
  }

  function addBib(extraBib: string) {
    const adds = ALL_PHOTOS.filter(
      (p) => p.bib % 7 === Number(extraBib) % 7 && !resultPhotos.some((rp) => rp.id === p.id)
    ).slice(0, 6);
    setResultPhotos([...resultPhotos, ...adds]);
    flashToast(`+${adds.length} photos from bib #${extraBib}`);
    // Re-prompt face every time a new bib lands (per Phase 1 spec).
    const sugg = ALL_PHOTOS.filter(
      (p) => !resultPhotos.some((rp) => rp.id === p.id) && !adds.some((a) => a.id === p.id)
    ).slice(0, 6);
    setFaceSuggest({
      bib: extraBib,
      count: sugg.length,
      tones: sugg.slice(0, 3).map((p) => p.tones),
      ids: sugg.map((p) => p.id),
    });
  }

  function scanFaceOnResults() {
    if (faceDone) return;
    const adds = ALL_PHOTOS.slice(20, 28).filter(
      (p) => !resultPhotos.some((rp) => rp.id === p.id)
    );
    setResultPhotos([...resultPhotos, ...adds]);
    flashToast(`+${adds.length} photos from face match`);
    setFaceSuggest(null);
    setFaceDone(true);
    // After a face scan, propose a likely bib.
    setBibSuggest({
      bib: "1248",
      count: 4,
      tones: ALL_PHOTOS.slice(28, 31).map((p) => p.tones),
      ids: ALL_PHOTOS.slice(28, 32).map((p) => p.id),
    });
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
        const p = ALL_PHOTOS.find((x) => x.id === id);
        if (!p) return null;
        return {
          uid: `u-${id}-${Date.now()}`,
          kind: "single",
          id,
          mile: p.mile,
          time: p.time,
          tones: p.tones,
          spot: p.spot,
          price: 10,
        };
      })
      .filter((x): x is CartItem => x !== null);
    const survivors = cart.items.filter(
      (i) => i.kind === "bundle" || !selected.has(i.id)
    );
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
    // Cart empties after a successful purchase.
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
      resultPhotos,
      matchedRacer,
      searchedBib,
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
    [resultPhotos, matchedRacer, searchedBib, faceSuggest, bibSuggest, faceDone, selected, cart, cartCappedToBundle, lightbox, order, toast]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRunner() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRunner outside RunnerProvider");
  return v;
}
