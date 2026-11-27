/* WHAT IT COSTS TO RUN (owner, 2026-11-26: "a page that shows us our
 * monthly cost to run the app, with all the different services we have to
 * buy and what they're for ... It would probably be useful to know what my
 * burn rate is"). The owner's alone (api/row100k/app/costs, the app's
 * Analytics in settings).
 *
 * Gathered 2026-11-26 from his inbox (mikianmusser@gmail.com) and the
 * services the site's settings name. `how` says where each figure came
 * from: "receipt" (an email that says the amount), "price" (the service's
 * published price for the plan in use, no receipt seen), "free" (a free
 * plan, as the service's own email says or as nothing is billed), or
 * "unknown" (in use, but no bill found: likely billed to another inbox).
 * A yearly or one-time charge is spread to a month (`monthly`); one-time
 * charges are listed apart and never in the burn. Change a line here when
 * a bill says otherwise. */

export type CostLine = {
  name: string;
  what: string;
  group: "Running the app" | "The stores" | "Building it";
  monthly: number | null;
  billed: string;
  how: "receipt" | "price" | "free" | "unknown";
  note?: string;
};

export const COSTS: CostLine[] = [
  { name: "Vercel", what: "Hosts the site and the app's server, and runs the daily jobs.", group: "Running the app", monthly: null, billed: "monthly", how: "unknown", note: "No Vercel team on this login, which is the free Hobby plan; if it is Pro it is $20 a month." },
  { name: "Postgres database", what: "Every rower, row, recording, like and follow.", group: "Running the app", monthly: null, billed: "monthly", how: "unknown", note: "No bill in this inbox." },
  { name: "Cloudflare R2", what: "Row photos, small previews and the nightly backups.", group: "Running the app", monthly: null, billed: "monthly, by the gigabyte", how: "unknown", note: "Free to 10 GB, then about 1.5¢ a GB a month." },
  { name: "AWS Rekognition", what: "Face search on race photos.", group: "Running the app", monthly: null, billed: "by the photo", how: "unknown", note: "Pay as used." },
  { name: "Resend", what: "The emails: sign-up notes, receipts, tester invites.", group: "Running the app", monthly: 0, billed: "monthly", how: "free", note: "Free to 3,000 emails a month." },
  { name: "Upstash Redis", what: "Rate limits.", group: "Running the app", monthly: 0, billed: "monthly", how: "free" },
  { name: "Expo (EAS)", what: "App builds and the over-the-air updates.", group: "Running the app", monthly: 0, billed: "monthly", how: "free", note: "Free plan; 80% of the month's iPhone builds used by Nov 25. Starter is $19 a month." },
  { name: "Google Workspace", what: "The rowtember.com mailbox.", group: "Running the app", monthly: 8.4, billed: "monthly, from Nov 1, 2026", how: "price", note: "Business Starter, one user, at the published price; the trial ended Oct 15." },
  { name: "Domains", what: "mikianmusser.com, rowtember.com, mikian.photos.", group: "Running the app", monthly: null, billed: "yearly", how: "unknown", note: "No renewal found in this inbox." },
  { name: "Apple Developer Program", what: "The iPhone app on the App Store.", group: "The stores", monthly: 8.25, billed: "$99 a year", how: "price", note: "No receipt in this inbox." },
  { name: "Google Play", what: "The Android app.", group: "The stores", monthly: 0, billed: "$25 once, Nov 21, 2026", how: "receipt", note: "Paid once; never again." },
  { name: "Claude (Anthropic)", what: "The AI that builds the app and the site.", group: "Building it", monthly: 200, billed: "monthly", how: "price", note: "Max 20x, now called Ultra at the same price (Anthropic's email, Oct 30)." },
];

export const ONE_TIME: { name: string; amount: number; when: string }[] = [{ name: "Google Play developer registration", amount: 25, when: "2026-11-21" }];

export function burn() {
  const known = COSTS.filter((c) => c.monthly != null);
  const sum = (g?: CostLine["group"]) => Math.round(known.filter((c) => !g || c.group === g).reduce((a, c) => a + (c.monthly as number), 0) * 100) / 100;
  return {
    lines: COSTS,
    oneTime: ONE_TIME,
    monthly: sum(),
    running: sum("Running the app") + sum("The stores"),
    building: sum("Building it"),
    unknown: COSTS.filter((c) => c.monthly == null).length,
  };
}
