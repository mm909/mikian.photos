import {
  Actions,
  Bests,
  BigMeters,
  Eyebrow,
  Identity,
  Ledger,
  LogBlock,
  MetersUnit,
  MonthBlock,
  Nameplate,
  coreLedger,
} from "./pieces";
import { DogTagCard } from "./DogTag";
import { PaceCurve } from "./PaceCurve";
import { ProfileField } from "./ProfileField";
import type { ProfileView } from "./view";

/* THE profile — the owner's pick from the three looks (2026-09-05, off a
 * phone screenshot of look A and a desktop one of look C): one DOM that
 * is look C on a wide screen and look A on a phone.
 *
 * Wide (from 720px, .pf-two in theme.ts): two columns on the landing
 * measure. Left, the rower — nameplate, the big blue meters with TIME
 * ROWED under it, LOG A ROW / SHARE, the identity line, the dotted
 * ledger. Right, the month calendar over the bests boards. The log runs
 * full width below.
 *
 * Phone: the same nodes stacked in look A's order — the rower, THE BESTS,
 * THE MONTH, THE LOG. The right-hand column is display:contents there, so
 * its two blocks become grid items of their own and `order` puts the
 * bests ahead of the month. No second copy of anything: the markup here
 * is the wide order, the stylesheet does the phone. */
export function Profile({ view }: { view: ProfileView }) {
  return (
    <>
      <section className="pf-sec">
        <div className="wrap front pf-two">
          <div className="pf-col">
            <Nameplate view={view} />
            <BigMeters view={view} unit={<MetersUnit view={view} />} />
            <Actions view={view} />
            <Identity view={view} />
            <Ledger items={coreLedger(view)} />
          </div>
          <div className="pf-side">
            <div className="pf-month">
              <Eyebrow left="The month" right="METERS PER DAY" />
              <MonthBlock view={view} />
            </div>
            <div className="pf-bests-sec">
              <Eyebrow
                left="The bests"
                right={
                  <>
                    <span className="pf-ph">PERSONAL — </span>THIS SEPTEMBER
                  </>
                }
              />
              <Bests view={view} />
            </div>
          </div>
        </div>
      </section>

      {/* WHAT EVERYONE ELSE SEES (owner ask, 2026-09-08): one of the
          elite, on their own page while a window is open, gets the dog tag
          a stranger is shown in place of this page — under the stats,
          above THE PACE. The card alone: the nameplate above already
          carries the rower search. page.tsx decides when (view.ownTag). */}
      {view.ownTag && (
        <section className="pf-sec">
          <div className="wrap front">
            <div className="pf-block pf-tag">
              <Eyebrow left="What everyone else sees" />
              <DogTagCard view={view} until={view.ownTag.until} heading="h2" />
            </div>
          </div>
        </section>
      )}

      {/* THE PACE and THE FIELD (owner ask, 2026-09-08), full width under
          the two columns and above the log: the average split settling
          meter by meter, then the rower against everyone. Both need at
          least a couple of timed rows to say anything, so an empty one
          simply is not there. THE FIELD wears no right-hand text (owner,
          same day: no YOU AGAINST EVERYONE). */}
      {(view.paceCurve.length >= 2 || view.field) && (
        <section className="pf-sec">
          <div className="wrap front">
            {view.paceCurve.length >= 2 && (
              <div className="pf-block">
                <Eyebrow left="The pace" right="AVERAGE SPLIT · METER BY METER" />
                <PaceCurve pts={view.paceCurve} />
              </div>
            )}
            {view.field && (
              <div className="pf-block">
                <Eyebrow left="The field" />
                <ProfileField field={view.field.field} you={view.field.you} distances={view.field.distances} />
              </div>
            )}
          </div>
        </section>
      )}

      <section className="pf-sec">
        <div className="wrap front">
          <LogBlock view={view} />
        </div>
      </section>
    </>
  );
}
