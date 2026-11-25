import type { Metadata } from "next";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { board100kCss } from "../board/board100kCss";
import { m2dCss } from "../m2d/m2dCss";
import { androidTesters, testerCount } from "./testers";
import { TesterForm } from "./TesterForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ROW for Android: test it early — Rowtember",
  description: "Help get the ROW app into the Play Store: three steps, two weeks.",
};

/* ANDROID TESTERS (owner, 2026-11-25: "a quick page explaining what the
 * beta testers for the Android need to do ... simple like 1, 2, 3 ... and
 * then also let that be the place where they can put in their email
 * address"). PUBLIC BUT UNLISTED: made to be sent (his stories, DMs), so no
 * development gate and no link on the rail. The count is testers.ts. */

export default async function AndroidPage() {
  const viewer = await resolveViewer();
  const list = await androidTesters();
  const { have, goal } = testerCount(list.length);

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{board100kCss}</style>
      <style>{m2dCss}</style>
      <RowBar {...barProps(viewer)} />
      <main className="bd m2 m2-give">
        <div className="wrap front">
          <h1 className="bd-date">
            <b>ROW for Android</b>
            <span>Test it early</span>
          </h1>

          <section className="m2-head" aria-label="Testers so far">
            <p className="m2-big">
              {have}
              <span style={{ color: "var(--gray)" }}>/{goal}</span>
            </p>
            <p className="m2-kick">Android testers</p>
            <p className="m2-give-lede">
              Google needs 12 people testing ROW for two weeks before it can go in the Play Store. Help get it
              there, and you get the app first.
            </p>
          </section>

          <section className="m2-worth" aria-label="What to do">
            <div className="m2-worth-h">
              <h2>Three steps</h2>
            </div>
            <ol className="m2-steps">
              <li>
                <span className="k">1</span>
                <div>
                  <b>Leave your email below</b>
                  <p>The Google account on your Android phone, the one the Play Store uses.</p>
                </div>
              </li>
              <li>
                <span className="k">2</span>
                <div>
                  <b>Open the link we send</b>
                  <p>On your phone, tap Become a tester, then install ROW from the Play Store.</p>
                </div>
              </li>
              <li>
                <span className="k">3</span>
                <div>
                  <b>Keep it for 14 days</b>
                  <p>Leave ROW installed for two weeks and open it now and then. Log a row if you can. That is it.</p>
                </div>
              </li>
            </ol>
          </section>

          <TesterForm have={have} goal={goal} />
        </div>
      </main>
      <RowFooter front />
    </div>
  );
}
