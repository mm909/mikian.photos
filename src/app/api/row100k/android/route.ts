import { NextResponse } from "next/server";
import { sendOwnerNotification } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { resolveViewer } from "@/lib/row100kViewer";
import { androidTesters, saveAndroidTesters, testerCount } from "@/app/row100k/android/testers";

/* AN ANDROID TESTER WRITES IN (row100k/android/page.tsx). POST { email,
 * name? }: kept in the stored list (android/testers.ts), the owner emailed
 * on every save, new or again (CLAUDE.md: every sign-up emails the owner;
 * a failed send is logged, never shown). Answers the new count. Open to
 * anyone, so throttled by address. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const rl = await rateLimit({ key: `android-tester:${clientIp(req)}`, limit: 10, windowSec: 3600 });
  if (!rl.ok) return no("Too many tries. Try again in a bit.", 429);
  const body = (await req.json().catch(() => null)) as { email?: unknown; name?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!EMAIL.test(email) || email.length > 120) return no("That does not look like an email address.", 400);
  if (!name) return no("Your name, please.", 400);
  try {
    const list = await androidTesters();
    const again = list.some((t) => t.email === email);
    const next = again ? list.map((t) => (t.email === email ? { ...t, name: name || t.name } : t)) : [...list, { email, name, at: new Date().toISOString() }];
    await saveAndroidTesters(next);
    const count = testerCount(next.length);
    const sent = await sendOwnerNotification(
      `ROW Android tester${again ? " (again)" : ""}: ${name || email}`,
      `${name ? `${name}\n` : ""}${email}\n\n${count.have} testers (${next.length} from the page). Add them to the Play Console closed test.`,
      email,
    );
    if (!sent.ok) console.error("android tester: owner email failed", sent);
    return NextResponse.json({ ok: true, again, ...count }, { headers: NO_STORE });
  } catch (err) {
    console.error("android tester: not saved", err);
    return no("That did not save. Try again.", 500);
  }
}

/* TAKE ONE OFF THE LIST (owner, 2026-11-26, of an address Play would not
 * take: "remove Jazz's mother-in-law"). DELETE { email }. The owner's alone. */
export async function DELETE(req: Request) {
  const viewer = await resolveViewer();
  if (!viewer.isAdmin) return no("Not found", 404);
  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const list = await androidTesters();
  const next = list.filter((t) => t.email !== email);
  if (next.length === list.length) return no("Not on the list.", 404);
  await saveAndroidTesters(next);
  return NextResponse.json({ ok: true, ...testerCount(next.length) }, { headers: NO_STORE });
}
