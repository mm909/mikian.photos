import { resolveViewer } from "@/lib/row100kViewer";
import { androidTesters } from "../../testers";
import { INVITE_SUBJECT, inviteHtml } from "../../invite";

/* WHAT A TESTER GETS (owner, 2026-11-25: "show me what they will be
 * getting"): the invite email as it renders, filled in for the first
 * tester on the list. The owner's alone. */
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await resolveViewer();
  if (!viewer.isAdmin) return new Response("Not found", { status: 404 });
  const t = (await androidTesters())[0] ?? { name: "Joe", email: "tester@gmail.com" };
  const html = inviteHtml(t.name, t.email).replace(
    "<body style=\"margin:0;background:#fff\">",
    `<body style="margin:0;background:#fff"><p style="margin:0;padding:10px 22px;background:#f1f1f1;font:12px Arial,sans-serif;color:#555">Subject: <b>${INVITE_SUBJECT}</b> · preview for ${t.email}</p>`,
  );
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
