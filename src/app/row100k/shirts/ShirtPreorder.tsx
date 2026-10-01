"use client";

import { useState } from "react";
import Link from "next/link";
import { COLORS, COLOR_LABEL, SIZES, type Color, type Counts, type Mine, type Size } from "../shirtPreorder";
import { ShirtCarousel, type ShirtPhoto } from "./ShirtCarousel";

/* THE TWO SHIRTS (owner, 2026-09-30, the pre-order page). Each half of the
 * bar is one shirt: the photographs (a carousel the owner posts into —
 * ShirtCarousel.tsx; the drawn tee came off on 2026-10-01: "instead of the
 * graphic of the T, give me a carousel"), the name, the public count, then — for a
 * signed-in rower on the board — the sizes as words and ONE action word
 * by state:
 *   nothing reserved     RESERVE, grey until a size is picked
 *   reserved, same size  LET IT GO
 *   reserved, other size CHANGE TO L (tapping the reserved size again
 *                        puts LET IT GO back)
 * One of each colour at most; the server enforces it. A visitor sees the
 * counts and one word under the bar: SIGN IN where the rest of the site
 * sends people, or OPT IN for an account that has not joined. The table
 * under the bar is the same numbers per size.
 *
 * The counts come in from the page and are replaced by whatever the route
 * answers, so a change is on the page the moment it lands. */

const PATH = "/row100k/shirts";
const SIGN_IN = `/row100k/sign-in?callbackUrl=${encodeURIComponent(PATH)}`;

type Reply = { ok?: boolean; error?: string; counts?: Counts; mine?: Mine | null };

export function ShirtPreorder({
  counts: initialCounts,
  mine: initialMine,
  signedIn,
  joined,
  photos,
  admin,
}: {
  counts: Counts;
  mine: Mine | null;
  signedIn: boolean;
  joined: boolean;
  /* The owner's photographs of each shirt (shirtPhotos.ts), oldest first. */
  photos: Record<Color, ShirtPhoto[]>;
  /* The owner: ADD PHOTOS and REMOVE under each carousel. */
  admin: boolean;
}) {
  const [counts, setCounts] = useState(initialCounts);
  const [mine, setMine] = useState<Mine>(initialMine ?? { black: null, cream: null });
  /* The size under the pointer, per shirt: the reserved one until the
   * rower picks another. */
  const [pick, setPick] = useState<Mine>({ black: initialMine?.black ?? null, cream: initialMine?.cream ?? null });
  const [busy, setBusy] = useState<Color | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canAct = signedIn && joined;

  const send = async (color: Color, method: "POST" | "DELETE", body: object) => {
    setBusy(color);
    setError(null);
    try {
      const res = await fetch("/api/row100k/shirts", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as Reply;
      if (res.ok && data.ok && data.counts) {
        setCounts(data.counts);
        const m = data.mine ?? { black: null, cream: null };
        setMine(m);
        setPick({ black: m.black, cream: m.cream });
      } else setError(data.error ?? "Couldn't take that — try again.");
    } catch {
      setError("Couldn't take that — try again.");
    }
    setBusy(null);
  };

  const reserve = (color: Color) => {
    const size = pick[color];
    if (size) void send(color, "POST", { color, size });
  };
  const letGo = (color: Color) => void send(color, "DELETE", { color });

  /* The one word for a shirt, by state (see the note at the top). */
  const action = (color: Color) => {
    const have = mine[color];
    const p = pick[color];
    const wait = busy === color;
    if (have && p === have) {
      return (
        <button type="button" className="sp-go" disabled={wait} onClick={() => letGo(color)}>
          {wait ? "…" : "Let it go"}
        </button>
      );
    }
    if (have && p) {
      return (
        <button type="button" className="sp-go" disabled={wait} onClick={() => reserve(color)}>
          {wait ? "…" : `Change to ${p}`}
        </button>
      );
    }
    return (
      <button type="button" className="sp-go" disabled={wait || !p} onClick={() => reserve(color)}>
        {wait ? "…" : "Reserve"}
      </button>
    );
  };

  return (
    <>
      <div className="sp-two">
        {COLORS.map((color) => (
          <div className="sp-shirt" key={color}>
            <ShirtCarousel color={color} photos={photos[color]} admin={admin} />
            <h3 className="sp-name">{COLOR_LABEL[color]}</h3>
            <p className="sp-count">
              <b>{counts[color].total}</b> reserved
            </p>
            {canAct && (
              <>
                <div className="sp-sizes" role="radiogroup" aria-label={`${COLOR_LABEL[color]} size`}>
                  {SIZES.map((size: Size) => {
                    const on = pick[color] === size;
                    const isMine = mine[color] === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className={`sp-size${on ? " on" : ""}${isMine ? " mine" : ""}`}
                        disabled={busy === color}
                        onClick={() => {
                          setPick((v) => ({ ...v, [color]: size }));
                          setError(null);
                        }}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
                <div className="sp-act">{action(color)}</div>
              </>
            )}
          </div>
        ))}
      </div>
      {error && <p className="sp-err">{error}</p>}

      {!signedIn && (
        <p className="sp-visitor">
          <Link className="sp-go" href={SIGN_IN}>
            Sign in
          </Link>
        </p>
      )}
      {signedIn && !joined && (
        <p className="sp-visitor">
          <Link className="sp-go" href="/row100k#join">
            Opt in
          </Link>
        </p>
      )}

      <table className="sp-table">
        <thead>
          <tr>
            <th>Size</th>
            {COLORS.map((c) => (
              <th className="n" key={c}>
                {COLOR_LABEL[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SIZES.map((size) => (
            <tr key={size}>
              <td className="k">{size}</td>
              {COLORS.map((c) => (
                <td className="n" key={c}>
                  {counts[c].bySize[size]}
                </td>
              ))}
            </tr>
          ))}
          <tr className="all">
            <td className="k">All</td>
            {COLORS.map((c) => (
              <td className="n" key={c}>
                {counts[c].total}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </>
  );
}
