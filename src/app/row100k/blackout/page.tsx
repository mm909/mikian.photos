import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEffectiveActor } from "@/lib/permissions";
import { isRow100kAdmin, nowMs } from "@/lib/row100k";
import { listBlackouts, type BlackoutWindow } from "@/lib/blackout";
import { ELITE_LABEL, ELITE_N, fmtPacificStamp } from "@/lib/blackoutRules";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { Blocks } from "../Blackout";
import { BlackoutAdmin, type AdminWindow } from "./BlackoutAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blackout — 100K September",
  robots: { index: false, follow: false },
};

/* Page-local styles — .bo- prefix, theme.ts untouched beyond the shared
 * .bo blocks. Rendered as the text child of a style tag, so no double
 * quotes, no angle brackets and no apostrophes anywhere in the string (see
 * the note in theme.ts). The datetime-local inputs take the same underline
 * as the text inputs in .panel, which the shared selector list does not
 * cover. */
const boCss = `
.row100k .panel input[type=datetime-local]{width:100%;background:transparent;border:none;border-bottom:2px solid var(--line);color:var(--ink);font-family:var(--row-archivo),sans-serif;font-size:17px;padding:8px 2px;border-radius:0;appearance:none}
.row100k .bo-lede{font-size:15px;color:var(--ink-soft);max-width:60ch;margin-bottom:6px;line-height:1.6}
.row100k .bo-lede + .bo-lede{margin-top:8px}
.row100k .bo-state{display:inline-block;font-size:10px;padding:1px 6px;font-family:var(--row-mono),monospace;letter-spacing:.08em;border:1px solid var(--gray);color:var(--gray);white-space:nowrap}
.row100k .bo-state.on{background:var(--ink);border-color:var(--ink);color:#fff}
.row100k .bo-state.next{border-color:var(--water);color:var(--water)}
`;

/* Admin-only: set blackout windows. While one is open, the top fifteen on
 * the board show digit blocks instead of meters (blackoutRules.ts). The
 * rest of the world gets a 404, same gate as /row100k/signups. */
export default async function BlackoutPage() {
  const actor = await getEffectiveActor();
  if (!actor || !isRow100kAdmin(actor.email, actor.roles)) notFound();

  // Uncached on purpose — this page wants the truth right after a write.
  // A missing table (not pushed yet) is the one failure worth naming.
  let windows: BlackoutWindow[] = [];
  let tableMissing = false;
  try {
    windows = await listBlackouts();
  } catch (err) {
    console.error("row100k blackout: failed to list windows", err);
    tableMissing = true;
  }

  const at = nowMs();
  const rows: AdminWindow[] = windows.map((w) => {
    const s = Date.parse(w.startsAt);
    const e = Date.parse(w.endsAt);
    return {
      id: w.id,
      startsAt: w.startsAt,
      endsAt: w.endsAt,
      reason: w.reason,
      state: at < s ? "upcoming" : at >= e ? "past" : "active",
    };
  });
  const current = rows.find((w) => w.state === "active");

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{boCss}</style>
      <RowBar />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>Blackout</h2>
            <span className="mono">
              {current
                ? `ACTIVE NOW — UNTIL ${fmtPacificStamp(current.endsAt).toUpperCase()}`
                : "NOT ACTIVE"}
            </span>
          </div>

          <p className="bo-lede">
            While a window is open, the top {ELITE_N} on the board — {ELITE_LABEL} — have their
            meters hidden from the public: <Blocks digits={6} /> m instead of the number, on the
            board and on the share stickers. Sixteenth down stays visible. Admins and each rower
            looking at their own row still see the real total.
          </p>
          <p className="bo-lede">
            Times are Pacific. A window takes effect on the next page load — no deploy, no
            cache to wait out.
          </p>

          {tableMissing && (
            <p className="form-err">
              THE ROWBLACKOUT TABLE IS NOT IN THE DATABASE YET — RUN npm run prisma:push FROM THE
              REPO, THEN RELOAD. UNTIL THEN THE BOARD SHOWS EVERYTHING.
            </p>
          )}

          <BlackoutAdmin windows={rows} />
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
