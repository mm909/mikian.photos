import type { Metadata } from "next";
import { activeBlackout } from "@/lib/blackout";
import { DEFAULT_POLICY, policyMax, type BlackoutPolicy } from "@/lib/blackoutRules";
import { siteSettings } from "@/lib/rowSettings";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { CHALLENGE, daysElapsed, nowMs } from "@/lib/row100k";
import { buildMonths, type MonthsModel } from "./months";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { AnalysisView, type ViewerKind } from "./AnalysisView";
import { buildModel, HIDE_TOP_DEFAULT, type Viewer } from "./compute";
import { analysisData, EMPTY_DATA, type RawData } from "./data";
import { analysisCss } from "./styles";
import type { Model } from "./model";
import { notFound } from "next/navigation";
import { isRow100kAdmin } from "@/lib/row100k";

export const metadata: Metadata = {
  title: "The numbers — Rowtember 2026",
  description:
    "Distributions, standard deviations and correlations across every Rowtember session — anonymised for everyone, with your own rows overlaid when you sign in.",
  // Not ready for the public yet (owner call, 2026-09-05): reachable from
  // the DEVELOPMENT menu only, and only by an admin.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/* The stat-analysis page (owner ask, 2026-09-05): the stats page keeps the
 * boards and records, this one is strictly the shape of the numbers. All
 * maths runs here on the server; the client component only holds the
 * EVERYONE | YOU chip. Whatever the viewer is entitled to see is decided
 * before anything is passed down: signed-out visitors get the anonymised
 * field, a joined rower additionally gets their own rows — never anyone
 * else's. Every load fails open to the anonymous view. */
export default async function AnalysisPage({ searchParams }: { searchParams?: { you?: string } }) {
  /* Development-only for now (owner call, 2026-09-05): the page is not
   * ready to go live, so it 404s for everyone but a challenge admin. */
  const gate = await getEffectiveActor().catch(() => null);
  if (!gate || !isRow100kAdmin(gate.email, gate.roles)) notFound();
  /* By construction true past the gate; passed explicitly so the forecast
   * table's names stay tied to the admin flag if the gate ever loosens. */
  const admin = isRow100kAdmin(gate.email, gate.roles);

  /* The blackout rides along with the rows: while a window is open the
   * board hides THE ELITE (blackoutRules.ts, as many as the saved policy
   * says — rowSettings.ts), so the per-rower charts here keep the same
   * elite off the page — for everyone, the admin included, since the field
   * view is one page for all. Neither lookup throws (both fail open). The
   * policy itself travels too (review, 2026-09-16): the top N OF EACH
   * BOARD is not the top 2N overall, and the elite set has to be the
   * board's own. */
  let raw: RawData = EMPTY_DATA;
  let hideTop = HIDE_TOP_DEFAULT;
  let policy: BlackoutPolicy = DEFAULT_POLICY;
  try {
    const [rows, blackout, settings] = await Promise.all([analysisData(), activeBlackout(), siteSettings()]);
    raw = rows;
    policy = settings.blackout;
    if (blackout.active) hideTop = Math.max(HIDE_TOP_DEFAULT, policyMax(settings.blackout));
  } catch (err) {
    console.error("row100k/analysis: failed to load rows", err);
  }

  /* Who is looking. The viewer's own rows are loaded fresh rather than
   * taken from the cached field, so a row logged a minute ago is already in
   * the blue (the same reason the home page reads its own rows directly). */
  let viewer: Viewer = { kind: "anon" };
  try {
    const actor = await getEffectiveActor();
    if (actor) {
      viewer = { kind: "unjoined" };
      const me = await db.rowParticipant.findUnique({
        where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
        select: { id: true, rowerNumber: true, division: true },
      });
      if (me) {
        const mine = await db.rowEntry.findMany({
          where: { challenge: CHALLENGE, participantId: me.id },
          select: { id: true, day: true, meters: true, seconds: true, createdAt: true },
          orderBy: [{ day: "asc" }, { createdAt: "asc" }],
        });
        viewer = {
          kind: "joined",
          id: me.id,
          rowerNumber: me.rowerNumber,
          division: me.division,
          entries: mine.map((e) => ({
            id: e.id,
            participantId: me.id,
            day: e.day,
            meters: e.meters,
            seconds: e.seconds,
            createdAtMs: e.createdAt.getTime(),
          })),
        };
      }
    }
  } catch (err) {
    console.error("row100k/analysis: failed to resolve viewer", err);
    viewer = { kind: "anon" };
  }

  /* The maths is the one step left that could throw on a shape of data
   * nobody foresaw; the empty field is verified NaN-free, so a bad day
   * renders that rather than a 500. */
  const today = daysElapsed();
  let model: Model;
  try {
    model = buildModel(raw.participants, raw.entries, viewer, today, hideTop, admin, policy);
  } catch (err) {
    console.error("row100k/analysis: buildModel failed", err);
    model = buildModel([], [], { kind: "anon" }, today, hideTop, admin, policy);
  }
  const kind: ViewerKind =
    viewer.kind === "joined" ? (model.you && model.you.sessions > 0 ? "ready" : "empty") : viewer.kind;

  /* THE MONTHS (owner ask, 2026-09-25): month against month at the same
   * day. Folded from the same cached load as everything else — every
   * entry in the challenge, not only this month's — on the challenge
   * clock. Its own try, so a bad row here costs the section, not the page. */
  let months: MonthsModel;
  try {
    months = buildMonths(raw.entries, nowMs());
  } catch (err) {
    console.error("row100k/analysis: buildMonths failed", err);
    months = buildMonths([], nowMs());
  }
  /* ?you=1 is the sign-in return trip: land with the blue layer already on. */
  const initialYou = searchParams?.you === "1" && kind === "ready";

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{analysisCss}</style>

      <RowBar active="stats" />

      <AnalysisView model={model} months={months} viewer={kind} initialYou={initialYou} />

      <RowFooter />
    </div>
  );
}
