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

      <section className="pf-sec">
        <div className="wrap front">
          <LogBlock view={view} />
        </div>
      </section>
    </>
  );
}
