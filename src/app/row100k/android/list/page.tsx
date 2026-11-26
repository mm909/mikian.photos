import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { board100kCss } from "../../board/board100kCss";
import { m2dCss } from "../../m2d/m2dCss";
import { db } from "@/lib/db";
import { androidTesters, testerCount } from "../testers";
import { SendLink } from "./SendLink";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Android testers (admin) — Rowtember",
  robots: { index: false, follow: false },
};

/* WHO HAS SIGNED UP TO TEST (owner, 2026-11-25: "give me a page where I can
 * see who is signed up"). The owner's alone: an admin, or nothing is here.
 * Names, emails and when, newest last, and the emails in one line to paste
 * into the Play Console's tester list. */
export default async function AndroidListPage() {
  const viewer = await resolveViewer();
  if (!viewer.isAdmin) notFound();
  const list = await androidTesters();
  const { have, goal } = testerCount(list.length);
  const unsent = list.filter((t) => !t.sent).length;
  /* DID THEY GET IT (owner, the same day: "how do I know if they download
   * it"): Play shows only a count of who opted in. Here, per tester, by the
   * email they gave: a ROW account under it, and an Android phone that has
   * turned on ROW notifications (the only sure sign of the Android app; the
   * bell starts off, so its absence proves nothing). */
  const people = await db.photographer
    .findMany({ where: { email: { in: list.map((t) => t.email), mode: "insensitive" } }, select: { id: true, email: true } })
    .catch(() => [] as { id: string; email: string }[]);
  const droid = await db.rowPushToken
    .findMany({ where: { userId: { in: people.map((p) => p.id) }, platform: "android" }, select: { userId: true } })
    .catch(() => [] as { userId: string }[]);
  const idOf = new Map(people.map((p) => [p.email.toLowerCase(), p.id]));
  const onAndroid = new Set(droid.map((d) => d.userId));
  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{board100kCss}</style>
      <style>{m2dCss}</style>
      <RowBar {...barProps(viewer)} />
      <main className="bd m2 m2-give">
        <div className="wrap front">
          <h1 className="bd-date">
            <b>Android testers</b>
            <span>
              {have} of {goal} shown
            </span>
          </h1>
          <section className="m2-worth" aria-label="Who signed up">
            <div className="m2-worth-h">
              <h2>{list.length} signed up</h2>
            </div>
            <p className="m2-give-small">
              Add each email to the Play Console list ROW testers first, then send them the link.{" "}
              <a href="/android/list/email" style={{ color: "var(--ink)" }}>
                See the email
              </a>
              {unsent ? (
                <>
                  {" "}
                  <SendLink unsent={unsent} label={`Send to all ${unsent} not sent`} />
                </>
              ) : null}
            </p>
            <dl>
              {list.map((t, i) => (
                <div key={t.email}>
                  <dt>
                    {i + 1}. {t.name || "—"}
                    <small>{t.email}</small>
                  </dt>
                  <dd style={{ color: "var(--gray)", fontWeight: 400, fontSize: 12, textAlign: "right" }}>
                    {t.at ? when(t.at) : ""}
                    <br />
                    {idOf.has(t.email) ? (onAndroid.has(idOf.get(t.email)!) ? "ROW account · on Android" : "ROW account") : "no ROW account yet"}
                    <br />
                    {t.sent ? `Link sent ${when(t.sent)}` : <SendLink email={t.email} label="Send link" />}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          {list.length ? (
            <section className="m2-worth" aria-label="For the Play Console">
              <div className="m2-worth-h">
                <h2>For the Play Console</h2>
              </div>
              <p className="m2-give-small" style={{ userSelect: "all", wordBreak: "break-all", color: "var(--ink)" }}>
                {list.map((t) => t.email).join(", ")}
              </p>
            </section>
          ) : null}
        </div>
      </main>
      <RowFooter front />
    </div>
  );
}
