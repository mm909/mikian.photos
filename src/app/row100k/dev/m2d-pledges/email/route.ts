import { resolveViewer } from "@/lib/row100kViewer";
import { doneMail, welcomeMail, type Mail } from "../../../m2dPledgeMail";

/* WHAT A GIVER GETS (owner, 2026-11-26: draft the emails and show me a
 * preview, like /android/list/email): each email as it renders, for a
 * sample pledge of $1 a kilometer up to $500.
 *   ?e=welcome  on approval
 *   ?e=claimed  when the cap fills
 *   ?e=close    at the close, the cap not filled
 * Add &text=1 for the plain-text part. The development gate: admin only in
 * production, open in local dev. */
export const dynamic = "force-dynamic";

const SAMPLE = { name: "Jordan Giver", email: "giver@example.com", centsPerKm: 100, capDollars: 500 };

export async function GET(req: Request) {
  const viewer = await resolveViewer();
  if (process.env.NODE_ENV === "production" && !viewer.isAdmin) return new Response("Not found", { status: 404 });
  const q = new URL(req.url).searchParams;
  const e = q.get("e") ?? "welcome";
  let m: Mail;
  if (e === "claimed") m = doneMail(SAMPLE, { km: 500, dollars: 500, filled: true, split: { candlelighters: 200, shine: 200, inclusion: 100 } });
  else if (e === "close") m = doneMail(SAMPLE, { km: 312.4, dollars: 312.4, filled: false, split: { candlelighters: 120.4, shine: 104, inclusion: 88 } });
  else m = welcomeMail(SAMPLE);
  if (q.get("text")) return new Response(`Subject: ${m.subject}\n\n${m.text}`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  const html = m.html.replace(
    '<body style="margin:0;background:#fff">',
    `<body style="margin:0;background:#fff"><p style="margin:0;padding:10px 22px;background:#f1f1f1;font:12px Arial,sans-serif;color:#555">Subject: <b>${m.subject}</b> · preview for ${SAMPLE.email} · <a href="?e=welcome">welcome</a> · <a href="?e=claimed">claimed</a> · <a href="?e=close">close</a> · <a href="?e=${e}&text=1">plain text</a></p>`,
  );
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
