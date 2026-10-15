/* The hyresult lookup's rules, checked by hand:
 *   npx tsx src/app/hyrox/record.test.ts
 * (plain asserts, exit 1 on the first miss). The page is a stand-in cut
 * to the shape hyresult serves — React server component chunks with the
 * races and the upcoming waves inside — so the parser is exercised
 * without the network. */
import assert from "node:assert/strict";
import { EVENTS } from "./events";
import { dgFor, fmtSeconds, fmtWave, normName, parseAthletePage, recordFrom, rscText, type HyAthlete, type HyRace } from "./record";

const ev = EVENTS[0];

/* ------------------------------------------------------------ the keys */
assert.equal(dgFor({ format: "singles", division: "open", gender: "men" }), "men");
assert.equal(dgFor({ format: "singles", division: "pro", gender: "women" }), "pro-women");
assert.equal(dgFor({ format: "singles", division: "adaptive", gender: "men" }), "adaptive-men");
assert.equal(dgFor({ format: "doubles", division: "open", gender: "mixed" }), "doubles-mixed");
assert.equal(dgFor({ format: "doubles", division: "pro", gender: "men" }), "pro-doubles-men");
assert.equal(dgFor({ format: "relay", division: "open", gender: "women" }), "team-relay-women");

assert.equal(normName("Hunter McIntyre"), normName("Hunter Mcintyre"));
assert.equal(normName("  José García-Lopez "), "jose garcia lopez");
assert.equal(fmtSeconds(6294), "1:44:54");
assert.equal(fmtSeconds(3599), "59:59");
assert.equal(fmtSeconds(3600), "1:00:00");
assert.equal(fmtWave("16:00"), "4:00 PM");
assert.equal(fmtWave("09:40"), "9:40 AM");
assert.equal(fmtWave("12:05"), "12:05 PM");
assert.equal(fmtWave("00:30"), "12:30 AM");
assert.equal(fmtWave("TBA"), "TBA");

/* ------------------------------------------------------------ the page */
const race = (o: Partial<HyRace> & { idp: string; dg: string; location: string; date_start: string; t_total: number }): HyRace => ({ team: [{ name: "Ada Byron" }], ...o });
const chunk = (payload: string) => `<script>self.__next_f.push([1,${JSON.stringify(payload)}])</script>`;
const vegasPrior = race({ idp: "R1", dg: "men", location: "Las Vegas", date_start: "2026-02-20", date_end: "2026-02-22", t_total: 5720 });
const html =
  "<html><body>" +
  chunk('2:["$","div",null,{"children":"x"}]\n') +
  chunk('3:{"athlete":{"slug":"ada-byron"},"races":' + JSON.stringify([vegasPrior, race({ idp: "R2", dg: "men", location: "New York", date_start: "2026-05-28", date_end: "2026-06-07", t_total: 6294 })]) + ',"n":1}\n') +
  chunk('4:["$","$L5",null,{"races":["$3:props:races:0"],"upcoming":' + JSON.stringify([{ idp: "U1", dg: "men", location: "Las Vegas", date_start: "2027-03-12", date_end: "2027-03-14", day: "Saturday", time: "09:40" }]) + "}]\n") +
  "</body></html>";

assert.ok(rscText(html).includes('"races":['));
const page = parseAthletePage("ada-byron", html);
assert.equal(page.slug, "ada-byron");
assert.deepEqual(
  page.races.map((r) => r.idp),
  ["R1", "R2"],
  "the races, once each, the reference placeholders skipped",
);
assert.equal(page.upcoming.length, 1);
assert.equal(page.upcoming[0].time, "09:40");

const empty = parseAthletePage("nobody", "<html>" + chunk('3:{"races":[],"upcoming":[]}\n') + "</html>");
assert.deepEqual(empty.races, []);
assert.deepEqual(empty.upcoming, []);

/* ---------------------------------------------------------- the record */
const ada = { name: "Ada Byron", format: "singles", division: "open", gender: "men", partners: [] };
const r1 = recordFrom(ev, ada, page);
assert.ok(r1);
if (r1) {
  assert.equal(r1.priorRaces, 2, "two open singles before, neither at this event");
  assert.equal(r1.pr, "1:35:20", "the faster of the two");
  assert.equal(r1.finishTime, "");
  assert.equal(r1.resultIdp, "");
  assert.equal(r1.startTime, "9:40 AM", "the published wave");
  assert.equal(r1.day, "2027-03-13", "Saturday → the ISO day");
}

/* A category never raced is a debut; the singles do not count for doubles. */
const doubles = { ...ada, format: "doubles", gender: "mixed", partners: [{ name: "Grace Hopper" }] };
const r2 = recordFrom(ev, doubles, page);
assert.ok(r2 && r2.priorRaces === 0 && r2.pr === "" && r2.startTime === "", "debut, and no wave for that category");

/* Doubles with the same partner count; with another partner they do not. */
const withGrace: HyAthlete = {
  slug: "ada-byron",
  upcoming: [],
  races: [
    race({ idp: "D1", dg: "doubles-mixed", location: "Dallas", date_start: "2025-11-21", t_total: 4000, team: [{ name: "Grace  HOPPER" }, { name: "Ada Byron" }] }),
    race({ idp: "D2", dg: "doubles-mixed", location: "Miami", date_start: "2026-04-03", t_total: 3900, team: [{ name: "Someone Else" }, { name: "Ada Byron" }] }),
    race({ idp: "D3", dg: "pro-doubles-mixed", location: "Phoenix", date_start: "2026-01-29", t_total: 3500, team: [{ name: "Grace Hopper" }, { name: "Ada Byron" }] }),
  ],
};
const r3 = recordFrom(ev, doubles, withGrace);
assert.ok(r3);
if (r3) {
  assert.equal(r3.priorRaces, 1, "only the race with this partner, in this division");
  assert.equal(r3.pr, "1:06:40");
}
const r4 = recordFrom(ev, { ...doubles, partners: [{ name: "Nobody Yet" }] }, withGrace);
assert.ok(r4 && r4.priorRaces === 0, "a new partner is a debut");
const r5 = recordFrom(ev, { ...doubles, partners: [] }, withGrace);
assert.ok(r5 && r5.priorRaces === 2, "partner not yet named: every mixed open doubles counts for now");

/* The race itself, once run: the finish and the result id, not a prior. */
const done: HyAthlete = {
  slug: "ada-byron",
  upcoming: [],
  races: [vegasPrior, race({ idp: "V27", dg: "men", location: "Las Vegas", date_start: "2027-03-12", date_end: "2027-03-14", t_total: 5400 })],
};
const r6 = recordFrom(ev, ada, done);
assert.ok(r6);
if (r6) {
  assert.equal(r6.priorRaces, 1, "the 2026 Las Vegas counts, the 2027 one is this race");
  assert.equal(r6.pr, "1:35:20");
  assert.equal(r6.finishTime, "1:30:00");
  assert.equal(r6.resultIdp, "V27");
}

/* A race with no time (DNF) is neither a prior nor a finish. */
const dnf: HyAthlete = { slug: "x", upcoming: [], races: [race({ idp: "N", dg: "men", location: "Phoenix", date_start: "2026-01-29", t_total: 0 })] };
const r7 = recordFrom(ev, ada, dnf);
assert.ok(r7 && r7.priorRaces === 0 && r7.pr === "");

assert.equal(recordFrom(ev, { ...ada, format: "elite" }, page), null, "not a category we sell");

console.log("hyrox record: ok");
