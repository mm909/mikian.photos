import { CHARITIES, M2D_LAST, type CharityKey } from "./m2d";
import { capKmOf, pledgeLine, pledgeTerms, rateWord, type PledgeFill } from "./m2dPledges";

/* THE GIVER'S EMAILS (owner, 2026-11-26). Two, both sent with
 * sendPlainEmail (the owner BCC-ed on each):
 *   WELCOME, on approval: "a bunch of information about it": the rate,
 *     the cap, how it works, and that they give straight to the charities
 *     at the end.
 *   DONE, when the cap fills ("claimed") or at the close: the total and the
 *     split per charity ("you're donating $500, but $100 might go to
 *     Project Inclusion, $200 to this place, $200 to that place"), with
 *     each charity's donate link.
 * The owner sees both at /dev/m2d-pledges/email. Plain words, no address
 * of the site in the body beyond the one link to M2D. */

export type MailPledge = { name: string; email: string; centsPerKm: number; capDollars: number; anonymous?: boolean };
export type Mail = { subject: string; text: string; html: string };

const M2D_URL = "https://www.rowtember.com/m2d";
const PHONE = "(702) 540-4190";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const first = (name: string) => (name || "").trim().split(/\s+/)[0] || "there";
const usd = (d: number) => `$${d.toLocaleString("en-US", { minimumFractionDigits: d % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const km = (n: number) => `${Math.round(n).toLocaleString("en-US")} km`;
const closeDay = new Date(`${M2D_LAST}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

/* The frame both emails wear: the ROW mark, cream-free white, the water
 * blue (CLAUDE.md), Arial for mail clients. */
function frame(body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#fff">
<div style="max-width:520px;margin:0 auto;padding:28px 22px">
<p style="margin:0 0 22px;font:900 30px/1 'Arial Black',Arial,sans-serif;letter-spacing:-1px;color:#111">M2D</p>
${body}
<p style="margin:22px 0 14px;font:15px/1.5 Arial,sans-serif;color:#111">Any questions, reply to this email or call me: <a href="tel:+17025404190" style="color:#111;font-weight:700">${PHONE}</a></p>
<p style="margin:0;font:15px/1.5 Arial,sans-serif;color:#111">Mikian<br><span style="color:#666">ROWTEMBER</span></p>
</div></body></html>`;
}
const p = (s: string) => `<p style="margin:0 0 14px;font:15px/1.5 Arial,sans-serif;color:#111">${s}</p>`;
const small = (s: string) => `<p style="margin:0 0 14px;font:13px/1.5 Arial,sans-serif;color:#666">${s}</p>`;
/* The pledge, big: the rate and the cap, and the bar of kilometers. */
function card(pl: MailPledge, fillKm: number, dollars: number): string {
  const capKm = capKmOf(pl.centsPerKm, pl.capDollars);
  const pct = capKm > 0 ? Math.max(0, Math.min(100, Math.round((fillKm / capKm) * 100))) : 0;
  return `<div style="margin:0 0 22px;padding:18px;border:2px solid #111;border-radius:10px">
<p style="margin:0;font:900 34px/1.05 'Arial Black',Arial,sans-serif;color:#0077B6">${rateWord(pl.centsPerKm)}<span style="font-size:18px;color:#111"> per km</span></p>
<p style="margin:6px 0 14px;font:700 15px/1.4 Arial,sans-serif;color:#111">up to ${usd(pl.capDollars)} · ${km(capKm)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
<td style="height:12px;background:#0077B6;width:${pct}%;border-radius:6px 0 0 6px"></td><td style="height:12px;background:#e6e6e6;border-radius:${pct === 0 ? 6 : 0}px 6px 6px ${pct === 0 ? 6 : 0}px"></td>
</tr></table>
<p style="margin:8px 0 0;font:12px/1.4 'Courier New',monospace;color:#555">${km(fillKm)} of ${km(capKm)} · ${usd(dollars)} so far</p>
</div>`;
}

export function welcomeMail(pl: MailPledge): Mail {
  const capKm = capKmOf(pl.centsPerKm, pl.capDollars);
  const terms = pledgeTerms(pl);
  const subject = `You're in: ${terms} for M2D`;
  const charities = CHARITIES.map((c) => `${c.name}: ${c.what}`);
  const text = [
    `Hi ${first(pl.name)},`,
    "",
    `Thank you. Your M2D pledge is approved: ${rateWord(pl.centsPerKm)} for every kilometer, up to ${usd(pl.capDollars)}.`,
    "",
    "HOW IT WORKS",
    `- From today, every kilometer a Rowtember rower logs counts toward your pledge, ${rateWord(pl.centsPerKm)} each.`,
    `- It stops when it reaches ${usd(pl.capDollars)} (that's ${km(capKm)}) or on ${closeDay}, whichever comes first.`,
    "- Each kilometer's dollars go to the charity the rower who rowed it picked, split evenly across the three unless they chose.",
    `- Your line is on the M2D receipts as "${pledgeLine(pl)}". Watch it fill: ${M2D_URL}`,
    "",
    "THE THREE CHARITIES (all Las Vegas)",
    ...charities.map((c) => `- ${c}`),
    "",
    "PAYING",
    "Nothing to pay now, and nothing is paid through us. When your pledge fills, or at the close, I'll email you your total and exactly how much goes to each charity, with each one's donate link. You give straight to them.",
    "",
    `Any questions, reply to this email or call me: ${PHONE}`,
    "",
    "Mikian",
    "ROWTEMBER",
  ].join("\n");
  const html = frame(
    [
      p(`Hi ${esc(first(pl.name))},`),
      p(`Thank you. Your M2D pledge is approved.`),
      card(pl, 0, 0),
      `<p style="margin:0 0 8px;font:700 12px/1.4 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#111">How it works</p>`,
      `<ul style="margin:0 0 18px;padding-left:20px;font:15px/1.5 Arial,sans-serif;color:#111">
<li style="margin-bottom:6px">From today, every kilometer a Rowtember rower logs counts toward your pledge, <b>${rateWord(pl.centsPerKm)}</b> each.</li>
<li style="margin-bottom:6px">It stops at <b>${usd(pl.capDollars)}</b> (${km(capKm)}) or on ${closeDay}, whichever comes first.</li>
<li style="margin-bottom:6px">Each kilometer's dollars go to the charity the rower who rowed it picked, split evenly across the three unless they chose.</li>
<li>Your line on the receipts: <b>${esc(pledgeLine(pl))}</b>. <a href="${M2D_URL}" style="color:#0077B6;font-weight:700">Watch it fill</a></li>
</ul>`,
      `<p style="margin:0 0 8px;font:700 12px/1.4 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#111">The three charities</p>`,
      `<ul style="margin:0 0 18px;padding-left:20px;font:15px/1.5 Arial,sans-serif;color:#111">${CHARITIES.map((c) => `<li style="margin-bottom:6px"><b>${esc(c.name)}</b>: ${esc(c.what)}</li>`).join("")}</ul>`,
      `<p style="margin:0 0 8px;font:700 12px/1.4 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#111">Paying</p>`,
      p(
        "Nothing to pay now, and nothing is paid through us. When your pledge fills, or at the close, I'll email you your total and exactly how much goes to each charity, with each one's donate link. You give straight to them.",
      ),
    ].join("\n"),
  );
  return { subject, text, html };
}

/* `over`: the window closed before the cap filled. */
export function doneMail(pl: MailPledge, fill: Pick<PledgeFill, "km" | "dollars" | "split" | "filled">): Mail {
  const lines = CHARITIES.map((c) => ({ c, d: fill.split[c.key as CharityKey] ?? 0 })).filter((x) => x.d > 0);
  const subject = fill.filled ? `Your M2D pledge is claimed: ${usd(fill.dollars)}` : `M2D is wrapped: your pledge comes to ${usd(fill.dollars)}`;
  const lede = fill.filled
    ? `Your pledge is claimed. Rowtember rowers filled all ${km(fill.km)} of it, so you're donating ${usd(fill.dollars)}.`
    : `M2D closed on ${closeDay}. Rowtember rowers rowed ${km(fill.km)} of your pledge, so you're donating ${usd(fill.dollars)}.`;
  const text = [
    `Hi ${first(pl.name)},`,
    "",
    lede,
    "",
    "WHERE IT GOES (from the picks of the rowers whose kilometers filled your pledge)",
    ...lines.map((x) => `- ${x.c.name}: ${usd(x.d)}. Donate: ${x.c.url}`),
    "",
    "Please give each one its amount directly, on their site. Nothing goes through us and no fee is taken.",
    "",
    "Thank you for rowing with us.",
    "",
    `Any questions, reply to this email or call me: ${PHONE}`,
    "",
    "Mikian",
    "ROWTEMBER",
  ].join("\n");
  const row = (name: string, what: string, d: number, url: string) =>
    `<tr><td style="padding:12px 0;border-top:1px solid #ddd;font:15px/1.4 Arial,sans-serif;color:#111"><b>${esc(name)}</b><br><span style="font-size:13px;color:#666">${esc(what)}</span><br><a href="${url}" style="display:inline-block;margin-top:8px;padding:8px 14px;background:#0077B6;color:#fff;font:700 13px Arial,sans-serif;text-decoration:none;border-radius:8px">Donate ${usd(d)}</a></td><td style="padding:12px 0;border-top:1px solid #ddd;vertical-align:top;text-align:right;font:900 20px 'Arial Black',Arial,sans-serif;color:#111">${usd(d)}</td></tr>`;
  const html = frame(
    [
      p(`Hi ${esc(first(pl.name))},`),
      p(esc(lede)),
      card(pl, fill.km, fill.dollars),
      `<p style="margin:0 0 4px;font:700 12px/1.4 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#111">Where it goes</p>`,
      small("From the picks of the rowers whose kilometers filled your pledge."),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:6px">${lines.map((x) => row(x.c.name, x.c.what, x.d, x.c.url)).join("")}<tr><td style="padding:12px 0;border-top:2px solid #111;font:700 15px Arial,sans-serif;color:#111">Total</td><td style="padding:12px 0;border-top:2px solid #111;text-align:right;font:900 20px 'Arial Black',Arial,sans-serif;color:#0077B6">${usd(fill.dollars)}</td></tr></table>`,
      p("Please give each one its amount directly, on their site. Nothing goes through us and no fee is taken."),
      p("Thank you for rowing with us."),
    ].join("\n"),
  );
  return { subject, text, html };
}

/* The owner's line when a pledge comes in (CLAUDE.md: every sign-up emails
 * the owner). */
export function ownerPledgeText(pl: MailPledge & { note: string; anonymous: boolean }, isNew: boolean): { subject: string; text: string } {
  const terms = pledgeTerms(pl);
  return {
    subject: `M2D pledge ${isNew ? "to review" : "changed"}: ${terms} · ${pl.name}`,
    text: `${pl.name} (${pl.email}) ${isNew ? "pledged" : "changed their pending pledge to"} ${rateWord(pl.centsPerKm)} a kilometer, up to $${pl.capDollars.toLocaleString("en-US")} (${terms}).
${pl.anonymous ? "Anonymous on the receipts.\n" : `Named on the receipts as ${pl.name}.\n`}${pl.note ? `Their note: ${pl.note}\n` : ""}It counts only once you approve it: https://www.rowtember.com/dev/m2d-pledges`,
  };
}
