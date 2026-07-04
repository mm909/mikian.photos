/**
 * Ad-hoc parse smoke test for the roster-import CSV/TSV adapter + detection.
 * Run: npx tsx scripts/roster-import-parse-test.ts
 *
 * Pure — no DB. Exercises the always-works delimited path and source detection.
 * Not wired into CI; a quick confidence check for the parser heuristics.
 */
import { detectSource } from "../src/lib/rosterImport/detect";
import { parseCsv } from "../src/lib/rosterImport/csv";

let failures = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  const mark = cond ? "PASS" : "FAIL";
  if (!cond) failures++;
  console.log(`${mark}  ${label}${!cond && extra !== undefined ? `  → ${JSON.stringify(extra)}` : ""}`);
}

// --- detection ---
check("detect runsignup url", detectSource("https://runsignup.com/Race/Results/12345") === "runsignup");
check("detect raceroster url", detectSource("https://results.raceroster.com/v3/events/x/race/1") === "raceroster");
check("detect athlinks url", detectSource("https://www.athlinks.com/event/123/results") === "athlinks");
check("detect raceresult url", detectSource("https://my5.raceresult.com/1/results") === "raceresult");
check("detect generic results url", detectSource("https://timing.example.com/results/42") === "results-page");
check("detect csv text", detectSource("Bib,Name,Time\n101,Jane Doe,1:30:00") === "csv");
check("detect tsv text", detectSource("Bib\tName\tTime\n101\tJane Doe\t1:30:00") === "tsv");
check("detect unknown", detectSource("just some prose with no delimiters") === "unknown");

// --- CSV: header fuzzy-map, quoted city with comma ---
const csv = [
  'Bib #,Athlete,Gender,Age,Finish Time,City',
  '101,"Doe, Jane",F,34,1:32:04,"Long Beach, CA"',
  '102,John Smith,M,41,1:45:10,San Pedro',
  '103,,M,,,',
].join("\n");
const r1 = parseCsv(csv, ",");
check("csv parses 3 rows", r1.entries.length === 3, r1.entries.length);
check("csv bib 101", r1.entries[0].bib === 101, r1.entries[0]);
check("csv quoted name", r1.entries[0].name === "Doe, Jane", r1.entries[0].name);
check("csv finishTime mapped", r1.entries[0].finishTime === "1:32:04", r1.entries[0].finishTime);
check("csv quoted city", r1.entries[0].city === "Long Beach, CA", r1.entries[0].city);
check("csv gender mapped", r1.entries[1].gender === "M", r1.entries[1].gender);
check("csv empty-name row still imports", r1.entries[2].bib === 103 && r1.entries[2].name === "", r1.entries[2]);

// --- first+last name assembly ---
const csvFL = ['First Name,Last Name,Bib,Chip', 'Jane,Doe,55,1:10:00'].join("\n");
const r2 = parseCsv(csvFL, ",");
check("first+last → name", r2.entries[0]?.name === "Jane Doe", r2.entries[0]?.name);
check("first+last bib", r2.entries[0]?.bib === 55, r2.entries[0]?.bib);

// --- TSV ---
const tsv = ['Bib\tName\tDivision\tTime', '7\tAmy Ray\t10K\t0:44:12'].join("\n");
const r3 = parseCsv(tsv, "\t");
check("tsv bib", r3.entries[0]?.bib === 7, r3.entries[0]?.bib);
check("tsv distance", r3.entries[0]?.distance === "10K", r3.entries[0]?.distance);

// --- dedupe within batch ---
const dup = ['Bib,Name', '9,First A', '9,Dup B', '10,Other'].join("\n");
const r4 = parseCsv(dup, ",");
check("dedupe keeps first of duplicate bib", r4.entries.length === 2 && r4.entries[0].name === "First A", r4.entries);

// --- no bib column → clear warning, no entries ---
const noBib = ['Name,Time', 'Jane,1:00:00'].join("\n");
const r5 = parseCsv(noBib, ",");
check("no-bib column yields 0 entries + warning", r5.entries.length === 0 && r5.warnings.length > 0, r5.warnings);

// --- headerless positional (bib,name) ---
const headerless = ['201,Bare Row', '202,Second'].join("\n");
const r6 = parseCsv(headerless, ",");
check("headerless positional bib/name", r6.entries.length === 2 && r6.entries[0].bib === 201 && r6.entries[0].name === "Bare Row", r6.entries);

console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
