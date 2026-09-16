import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEffectiveActor } from "@/lib/permissions";
import { isRow100kAdmin, nowMs } from "@/lib/row100k";
import { listBlackouts, type BlackoutWindow } from "@/lib/blackout";
import { ELITE_LABEL, fmtPacificStamp, policyLabel } from "@/lib/blackoutRules";
import { siteSettings } from "@/lib/rowSettings";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { Blocks } from "../Blackout";
import { readBlackoutPreview } from "@/lib/row100kViewer";
import { BlackoutAdmin, type AdminWindow } from "./BlackoutAdmin";
import { PolicyPanel } from "./PolicyPanel";
import { PreviewSwitch } from "./PreviewSwitch";

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
.row100k .bo-prev-note{font-size:11px;letter-spacing:.12em;color:var(--gray);text-transform:uppercase;line-height:1.7;margin:0 0 12px}
.row100k .bo-prev .tabs{margin:0 0 12px}
.row100k .bo-policy{margin:24px 0}
.row100k .bo-policy .tabs{margin:0 0 12px}
.row100k .bo-policy .send{margin-top:26px;font-size:18px;padding:16px}
.row100k .bo-ramp{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.08em;color:var(--gray)}
.row100k .bo-how{margin-top:44px;border-top:2px solid var(--ink);padding-top:18px}
`;

/* Admin-only: set blackout windows and say who they hide. While one is
 * open, THE ELITE — the top N of each board or the top N overall, as the
 * policy says (rowSettings.ts) — show digit blocks instead of meters
 * (blackoutRules.ts). The rest of the world gets a 404, same gate as
 * /row100k/signups.
 *
 * Order (owner, 2026-09-16): the state line, the test switch, the policy,
 * the window form, the windows, and the explanation LAST — he knows how
 * it works; the controls come first. */
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
  // Never throws: the defaults (ten per division) when the settings table
  // is not there. The panel says so on the first save.
  const settings = await siteSettings();

  const at = nowMs();
  const rows: AdminWindow[] = windows.map((w) => {
    const s = Date.parse(w.startsAt);
    const e = Date.parse(w.endsAt);
    return {
      id: w.id,
      startsAt: w.startsAt,
      endsAt: w.endsAt,
      reason: w.reason,
      rampDays: w.rampDays,
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
                ? `ACTIVE NOW — UNTIL ${fmtPacificStamp(current.endsAt).toUpperCase()} · ${policyLabel(settings.blackout)}`
                : `NOT ACTIVE · ${policyLabel(settings.blackout)}`}
            </span>
          </div>

          <PreviewSwitch active={readBlackoutPreview(true)} />

          <PolicyPanel policy={settings.blackout} />

          {tableMissing && (
            <p className="form-err">
              THE ROWBLACKOUT TABLE IS NOT IN THE DATABASE YET — RUN npm run prisma:push FROM THE
              REPO, THEN RELOAD. UNTIL THEN THE BOARD SHOWS EVERYTHING.
            </p>
          )}

          <BlackoutAdmin windows={rows} />

          <div className="bo-how">
            <p className="rec-eyebrow">How it works</p>
            <p className="bo-lede">
              While a window is open, {ELITE_LABEL} — the top N of each board, or the top N
              overall, whichever the policy above says (right now {policyLabel(settings.blackout)})
              — have their meters hidden from the public: <Blocks digits={6} /> m instead of the
              number, on the board, in the feed and on the share stickers, with no place and their
              average split for a tag. Everyone else stays visible. Admins and each rower looking
              at their own row still see the real total.
            </p>
            <p className="bo-lede">
              Times are Pacific. A window, an edit to one, or a change of policy takes effect on
              the next page load — no deploy, no cache to wait out.
            </p>
            <p className="bo-lede">
              A run-up dims them toward the day instead of snapping shut on it. The number is HOW
              MANY DAYS it takes, and the digits are spread over them (owner, 2026-09-11): six days
              is one digit a day, three days is two digits a step, two days is three. Announce late
              and shorten it rather than starting it in the past. Set it to four and, four days
              out, the elite lose the ones digit, then the tens, then the hundreds, then the
              thousands — and the window covers the rest.
            </p>
          </div>
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
