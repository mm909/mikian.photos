"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { nowMs } from "@/lib/row100k";
import { ITEMS, STAMP, isSometimes, railItems, type NavKey } from "./barItems";
import { trackClick } from "./TrackedLink";

/* The nav rail: the section links on one strip, with ONE pill in the
 * accent resting under the current page. The pill is the whole show (owner
 * call, 2026-09-05): on desktop it slides to whatever the pointer is over
 * and settles back on leave; whichever item it sits under goes white, the
 * rest are the gray mono of a back-link.
 *
 * ROWTEMBER led the rail as the brand mark (Archivo Black, the pill
 * resting on it on the front page) until 2026-09-30, when the bar's own
 * wordmark became ROWTEMBER (RowBar.tsx, owner: never Mikian Musser) and
 * the rail copy went: two of the one word side by side. The "home" key
 * stays — the front page and the landing still pass it as `active` — but
 * no item answers to it, so on the front page the pill rests nowhere.
 *
 * Positions are measured, never assumed. The rail is one row at every
 * width since 2026-10-01 (owner: "look at the header. We need to condense
 * it into one line"): it no longer wraps at tablet widths and no longer
 * dissolves into a two-row phone bar, so the pill only ever moves in x —
 * but it is still measured, because a font swap or a resize moves the words.
 *
 * ON AN INK GROUND THE PILL IS A RULE (theme.ts, the dark() block): the
 * same element, the same slide, drawn as a 2px line of the accent under the
 * word instead of a slab behind it. Nothing here knows which.
 *
 * Cross-page slide: from a click until the page changes, the pill's live
 * position is stashed in sessionStorage every frame. The next page's rail
 * mounts, drops the pill at the stashed spot without animating, then lets it
 * slide onto that page's link — so the motion reads the same through a soft
 * navigation and a full document load, and a nav that lands mid-slide
 * continues from where the pill actually was instead of replaying.
 *
 * Server markup has to look right before any of this runs, so the active
 * link paints its own blue box (.on) until the webfonts are in and the first
 * real measurement lands (.live); the pill takes over in that same commit —
 * no flash, and no width correction a beat later from fallback-face metrics.
 *
 * A click pins the pill on the chosen item while the next page is fetched;
 * the pin lets go when the route changes, or on a timer if it never does.
 *
 * RACE DAY rides on this rail but not in the pill's world (owner, 2026-09-11:
 * "when this goes live I want a race day header link", "to be the left more
 * link in that white on black font"). It is the black of the race day page
 * dropped into the cream bar, so it carries its own indicator and is given no
 * ref — with nothing in itemRefs it gets no Box, and the pill can only move to
 * a box it has measured. It cannot land there by hover, by pin, by carry, or
 * by being the active page. Whether it is on the rail at all is
 * raceOpenFor(isAdmin) AND (raceAnnounced() OR the race has been run)
 * (raceday.ts), resolved by RowBar on the server, so the link and the page
 * can never disagree about whether there is a race (owner, 2026-09-25:
 * "RACE DAY should be hidden when no race day is announced"; 2026-10-01:
 * the results of a race that has been run keep it up).
 *
 * THE WORDS THAT ARE ONLY SOMETIMES THERE (barItems.ts isSometimes: the
 * stamp, and FEED and PARTNERS in September) wear .rail-x and leave the
 * rail under 900px, where one line cannot hold them beside the wordmark
 * and the chips. A signed-in rower finds them at the head of the account
 * menu (RowBar hands BarAccount the same list); a visitor has no menu, so
 * the rail grows the word MORE in their place — a button, with the words
 * in the account panel under it. From 900px MORE is not displayed.
 *
 * The items themselves, and the key type, live in barItems.ts so the
 * server half of the bar can read them too. */
export type { NavKey };

type Box = { left: number; top: number; width: number; height: number };
type Stash = { key: NavKey | null; box: Box; at: number };

const STASH_KEY = "row100k.pill";
/* A stash older than this is from some earlier wander (wordmark to the
 * landing and back, say) and would replay a slide nobody asked for. Wide
 * enough to outlast a slow full document load. */
const STASH_TTL_MS = 4000;
/* Keep re-stashing after a click for the whole hover-to-rest slide (220ms)
 * plus a margin, so the stash always holds the pill's last real position. */
const STASH_FOR_MS = 320;
/* A pin is meant to outlive a page fetch, not a cancelled one: if the route
 * has not changed by now (a prevented Link click, a navigation the browser
 * dropped) the pin lets go so the pill follows the pointer again. Longer
 * than a cold Neon page fetch, short enough that a stuck pill is not the
 * rest of the visit. */
const PIN_FOR_MS = 5000;

const isKey = (v: unknown): v is NavKey => ITEMS.some((i) => i.key === v);

function boxOf(el: Element, within: Element): Box {
  const a = el.getBoundingClientRect();
  const b = within.getBoundingClientRect();
  return { left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height };
}

function readStash(): Stash | null {
  try {
    const raw = sessionStorage.getItem(STASH_KEY);
    sessionStorage.removeItem(STASH_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Stash>;
    if (!s.box || typeof s.at !== "number" || nowMs() - s.at > STASH_TTL_MS) return null;
    return { key: isKey(s.key) ? s.key : null, box: s.box, at: s.at };
  } catch {
    return null;
  }
}

function writeStash(s: Stash) {
  try {
    sessionStorage.setItem(STASH_KEY, JSON.stringify(s));
  } catch {
    /* private mode or full storage — the slide just starts fresh next page */
  }
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function BarNav({
  active,
  raceOpen = false,
  signedIn = false,
}: {
  active?: NavKey;
  raceOpen?: boolean;
  /* Whether there is an account menu to carry the overflow words on a
   * narrow screen. Without one the rail shows MORE. */
  signedIn?: boolean;
}) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const railRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<NavKey, HTMLAnchorElement>());
  /* Item boxes relative to the pill's containing block; refreshed by
   * measure(), which re-renders through the bump. */
  const boxes = useRef(new Map<NavKey, Box>());
  const [, bump] = useState(0);
  const [live, setLive] = useState(false);
  /* .jump turns every rail transition off for one painted frame — used to
   * drop the pill somewhere new without it flying in from wherever it was. */
  const [jump, setJump] = useState(false);
  /* One-frame override at mount: the pill sits where the previous page left
   * it and that item is the lit one, then everything transitions to `active`. */
  const [carry, setCarry] = useState<Stash | null>(null);
  const [hot, setHot] = useState<NavKey | null>(null);
  /* Clicked and en route: holds the pill on the chosen item even if the
   * pointer wanders while the next page is fetched. */
  const [pinned, setPinned] = useState<NavKey | null>(null);
  const lastBox = useRef<Box | null>(null);
  const jumpRaf = useRef<number[]>([]);
  const stashRaf = useRef(0);
  const pinTimer = useRef(0);
  /* The previous page's stash, read once per mount and kept here: readStash
   * consumes sessionStorage, so a StrictMode double-run of the mount effect
   * would otherwise see it on the first pass and nothing on the second. */
  const stashRef = useRef<Stash | null | undefined>(undefined);

  /* Release .jump only after the browser has painted the jumped state — the
   * first frame callback can still run ahead of that paint, hence two. */
  const kickJump = useCallback(() => {
    setJump(true);
    jumpRaf.current.forEach(cancelAnimationFrame);
    const a = requestAnimationFrame(() => {
      const b = requestAnimationFrame(() => {
        setJump(false);
        setCarry(null);
      });
      jumpRaf.current = [b];
    });
    jumpRaf.current = [a];
  }, []);

  const measure = useCallback(() => {
    const pill = pillRef.current;
    const base = (pill?.offsetParent as HTMLElement | null) ?? railRef.current;
    if (!base) return;
    const next = new Map<NavKey, Box>();
    itemRefs.current.forEach((el, key) => next.set(key, boxOf(el, base)));
    boxes.current = next;
    bump((t) => t + 1);
  }, []);

  useLayoutEffect(() => {
    measure();
    if (stashRef.current === undefined) stashRef.current = reducedMotion() ? null : readStash();
    if (stashRef.current) setCarry(stashRef.current);
    /* Hand over from the server box to the pill only once the webfonts are
     * in. Measured against the fallback face the pill would visibly correct
     * its width a beat after paint (ROWTEMBER most of all: Archivo Black is
     * wider than anything it falls back to). next/font preloads both faces,
     * so on a warm cache this resolves right after mount; on a cold one the
     * .on box is the link's own layout and simply reflows with the swap. */
    let gone = false;
    const go = () => {
      if (gone) return;
      measure();
      setLive(true);
      kickJump();
    };
    const ready = document.fonts?.ready;
    if (ready) ready.then(go, go);
    else go();
    return () => {
      gone = true;
      jumpRaf.current.forEach(cancelAnimationFrame);
      cancelAnimationFrame(stashRaf.current);
      window.clearTimeout(pinTimer.current);
    };
  }, [measure, kickJump]);

  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (railRef.current) ro.observe(railRef.current);
    if (pillRef.current?.offsetParent) ro.observe(pillRef.current.offsetParent);
    /* Each link too: a late font swap changes their widths without
     * necessarily changing the rail box (and on a phone the rail has no box
     * at all). */
    itemRefs.current.forEach((el) => ro.observe(el));
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  /* The route changed underneath us without a remount (same segment): the
   * click is over, let the pill follow the pointer again. */
  useEffect(() => {
    window.clearTimeout(pinTimer.current);
    setPinned(null);
    setMore(false);
  }, [pathname]);

  const rest: NavKey | null = pinned ?? hot ?? active ?? null;
  /* Before the handover the server box is the only colour on the rail, so
   * only its link may go white: a carried key lit early would read as a link
   * gone missing (white on cream) while the fonts load. */
  const lit: NavKey | null = !live ? (active ?? null) : carry ? carry.key : rest;
  const target: Box | null = carry ? carry.box : rest ? (boxes.current.get(rest) ?? null) : null;
  const shown = target ?? lastBox.current;
  /* First appearance on a page with no resting item (a profile, say): the
   * pill has nowhere to slide from, so it is placed, not flown in. Decided
   * here, in render, so the very first paint already carries .jump; the
   * ref itself is only written after commit, so a StrictMode double render
   * reads the same answer twice. */
  const placing = live && target !== null && lastBox.current === null;

  useLayoutEffect(() => {
    /* Only once the pill is real: a hover before the fonts handover would
     * otherwise leave a stale box for the first appearance to slide from. */
    if (live && target) lastBox.current = target;
  });

  useEffect(() => {
    if (placing && !jump) kickJump();
  }, [placing, jump, kickJump]);

  const onClick = (key: NavKey, href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    /* The owner counts PARTNERS clicks (TrackedLink.tsx). Before the
     * modifier check so a new-tab click counts too; not when already on the
     * page, which is a scroll-to-top, not a visit. Fire-and-forget. */
    if (key === "partners" && key !== active && href !== pathname) trackClick("partners");
    /* The stamp has no box to pin the pill to and nothing worth stashing:
     * clicking RACE DAY leaves the pill on the page you are leaving, and the
     * next rail mounts with no carry, so the blue light goes out as you cross
     * into the black. That is the point of it, not a gap. */
    if (key === STAMP) return;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    /* Clicking the page you are already on (ROWTEMBER as a scroll-to-top,
     * mostly) changes no route, so nothing would ever release the pin and
     * the hover slide would be dead until the next real navigation. No pin,
     * and no stash either: there is no next rail to replay it. */
    if (key === active || href === pathname) return;
    setPinned(key);
    window.clearTimeout(pinTimer.current);
    pinTimer.current = window.setTimeout(() => setPinned((p) => (p === key ? null : p)), PIN_FOR_MS);
    const pill = pillRef.current;
    const base = pill?.offsetParent;
    /* Not live yet means the pill is still the unstyled 0 by 0 div: stashing
     * that would fly the next page's pill in from the rail corner. */
    if (!live || !pill || !base || !shown) return;
    /* Stash the pill where it actually is, every frame, until the page is
     * gone: on a phone (no hover) that is the slide from the old page onto
     * the tapped link, on desktop it is already sitting on it. */
    const started = nowMs();
    const tickStash = () => {
      const now = nowMs();
      writeStash({ key, box: boxOf(pill, base), at: now });
      if (now - started < STASH_FOR_MS) stashRaf.current = requestAnimationFrame(tickStash);
    };
    cancelAnimationFrame(stashRaf.current);
    tickStash();
  };

  /* What the rail carries right now (barItems.ts): the stamp only while
   * the race is open and announced, September's two only in September. */
  const items = railItems(raceOpen);
  const overflow = items.filter((it) => isSometimes(it.key));

  const railClass = ["rail", live ? "live" : "", jump || placing ? "jump" : ""].filter(Boolean).join(" ");
  const pillStyle: React.CSSProperties | undefined =
    live && shown
      ? {
          left: shown.left,
          top: shown.top,
          width: shown.width,
          height: shown.height,
          opacity: target ? 1 : 0,
        }
      : undefined;

  return (
    <nav ref={railRef} className={railClass} aria-label="Rowtember" onPointerLeave={() => setHot(null)}>
      {/* .rail-pill, not .pill: that name is already the join form radio chip. */}
      <div ref={pillRef} className="rail-pill" aria-hidden="true" style={pillStyle} />
      {items.map((it) => {
        const stamp = it.key === STAMP;
        /* The stamp takes neither .lit nor .on: it is already white on black
         * and carries its own indicator. .on is the one that would actually
         * bite — .rail:not(.live) a.on is four classes to the stamp rule's
         * three, so it would paint water-blue straight over the black on every
         * cold load of the race day page until the fonts land. The stamp needs
         * no handover at all; its look is server-known and never measured. */
        const cls = [
          it.key === "home" ? "brand" : "",
          stamp ? "rail-stamp" : "",
          isSometimes(it.key) ? "rail-x" : "",
          !stamp && lit === it.key ? "lit" : "",
          !stamp && !live && active === it.key ? "on" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <Fragment key={it.key}>
            <Link
              href={it.href}
              className={cls || undefined}
              aria-current={active === it.key ? "page" : undefined}
              /* No ref for the stamp, and that omission IS the rule: nothing in
               * itemRefs means no Box in measure(), and the pill only ever
               * moves to a box it has measured. A late font swap still
               * re-measures everything to its right, because its mono
               * neighbours swap in the same breath and they are observed. */
              ref={
                stamp
                  ? undefined
                  : (el) => {
                      if (el) itemRefs.current.set(it.key, el);
                      else itemRefs.current.delete(it.key);
                    }
              }
              /* The stamp tells the pill nothing. Crossing it on the way down
               * the rail leaves the pill where it was and the black simply
               * passes over the blue; parking on it is the same as parking in
               * the 4px gap between two links, which is how the rail has always
               * behaved. Its own inversion is the pointer feedback. */
              onPointerEnter={(e) => {
                if (!stamp && e.pointerType !== "touch") setHot(it.key);
              }}
              onFocus={() => {
                if (!stamp) setHot(it.key);
              }}
              onBlur={() => setHot((h) => (h === it.key ? null : h))}
              onClick={onClick(it.key, it.href)}
            >
              {it.label}
            </Link>
          </Fragment>
        );
      })}
      {/* MORE, under 900px, for a visitor (theme.ts .rail-more): the words
       * above that wear .rail-x are not displayed there, and with no
       * account menu to carry them this is their place. The pill never
       * addresses it — no ref, the same omission as the stamp. */}
      {!signedIn && overflow.length > 0 && (
        <span className="rail-more">
          <button
            type="button"
            className="rail-more-btn"
            aria-expanded={more}
            aria-haspopup="menu"
            onClick={() => setMore((v) => !v)}
          >
            More ▾
          </button>
          {more && (
            <>
              <div className="acct-overlay" onClick={() => setMore(false)} aria-hidden="true" />
              <div className="acct-panel" role="menu">
                {overflow.map((it) => (
                  <Link
                    key={it.key}
                    className="acct-item"
                    href={it.href}
                    onClick={(e) => {
                      setMore(false);
                      onClick(it.key, it.href)(e);
                    }}
                  >
                    {it.label} →
                  </Link>
                ))}
              </div>
            </>
          )}
        </span>
      )}
    </nav>
  );
}
