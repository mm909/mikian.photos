import { NextResponse } from "next/server";
import { sendPlainEmail } from "@/lib/email";
import { resolveViewer } from "@/lib/row100kViewer";
import { androidTesters, saveAndroidTesters } from "@/app/row100k/android/testers";
import { INVITE_SUBJECT, inviteHtml, inviteText } from "@/app/row100k/android/invite";

/* SEND A TESTER THE PLAY LINK (owner, 2026-11-25: "send out the link as I
 * add them"). Admin only, from the list page. POST { email } for one, or
 * { unsent: true } for everyone not yet sent. Each send stamps `sent` on
 * the tester; a send that fails leaves them unstamped and is named in the
 * answer. The owner is BCC'd by sendPlainEmail. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function POST(req: Request) {
  const viewer = await resolveViewer();
  if (!viewer.isAdmin) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404, headers: NO_STORE });
  const body = (await req.json().catch(() => null)) as { email?: unknown; unsent?: unknown } | null;
  const one = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const list = await androidTesters();
  const picked = list.filter((t) => (one ? t.email === one : body?.unsent === true && !t.sent));
  if (!picked.length) return NextResponse.json({ ok: true, sent: [], failed: [] }, { headers: NO_STORE });

  const sent: string[] = [];
  const failed: string[] = [];
  /* One at a time with a breath between (owner, 2026-11-26: the eleventh of
   * a send-to-all failed; the mail service takes about two a second). */
  for (const [i, t] of picked.entries()) {
    if (i) await new Promise((r) => setTimeout(r, 700));
    const res = await sendPlainEmail(t.email, INVITE_SUBJECT, inviteText(t.name, t.email), inviteHtml(t.name, t.email));
    if (res.ok) sent.push(t.email);
    else {
      failed.push(t.email);
      console.error("android invite: not sent", t.email, res.error);
    }
  }
  const now = new Date().toISOString();
  const fresh = await androidTesters();
  await saveAndroidTesters(fresh.map((t) => (sent.includes(t.email) ? { ...t, sent: now } : t)));
  return NextResponse.json({ ok: !failed.length, sent, failed }, { headers: NO_STORE });
}
