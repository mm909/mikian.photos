"use client";

import { useRouter } from "next/navigation";
import { LOOK_COOKIE, VIEW_COOKIE, type Look, type View } from "../look";

/* The two choices, written straight into cookies and re-rendered on the
 * server (router.refresh), so the whole site of pages — this one, the
 * main page, the donor page — flips at once with no flash and no client
 * state to keep in sync. */

const YEAR = 60 * 60 * 24 * 365;

function set(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=${YEAR};samesite=lax`;
}

export function LookPicker({ look, view }: { look: Look; view: View }) {
  const router = useRouter();

  const pick = (name: string, value: string) => {
    set(name, value);
    router.refresh();
  };

  return (
    <>
      <section>
        <div className="dd-head">
          <h2>Palette</h2>
          <span>both stay — pick a mood</span>
        </div>
        <label className="dd-opt">
          <input
            type="radio"
            name="dd-look"
            checked={look === "survey"}
            onChange={() => pick(LOOK_COOKIE, "survey")}
          />
          <span>
            <span className="t">Survey ink</span>
            <span className="d"> — blueprint blue on paper cream, orange pops. The vintage chart.</span>
          </span>
        </label>
        <label className="dd-opt">
          <input
            type="radio"
            name="dd-look"
            checked={look === "olive"}
            onChange={() => pick(LOOK_COOKIE, "olive")}
          />
          <span>
            <span className="t">Topo olive</span>
            <span className="d"> — cream line work on dark olive, the national-park poster.</span>
          </span>
        </label>
      </section>

      <section>
        <div className="dd-head">
          <h2>Projection</h2>
          <span>how the chart sits</span>
        </div>
        <label className="dd-opt">
          <input type="radio" name="dd-view" checked={view === "iso"} onChange={() => pick(VIEW_COOKIE, "iso")} />
          <span>
            <span className="t">Isometric</span>
            <span className="d"> — the tilted panorama, canyon walls raised off the sheet.</span>
          </span>
        </label>
        <label className="dd-opt">
          <input type="radio" name="dd-view" checked={view === "top"} onChange={() => pick(VIEW_COOKIE, "top")} />
          <span>
            <span className="t">Top down</span>
            <span className="d"> — straight overhead, the tall chart, north up.</span>
          </span>
        </label>
      </section>
    </>
  );
}
