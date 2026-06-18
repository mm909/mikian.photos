import { NextResponse } from "next/server";
import { sendOwnerNotification } from "@/lib/email";

/**
 * POST /api/contact — a simple contact-form relay to the platform owner.
 * Body: { name?, email?, message }. Emails the owner (reply-to the sender).
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { name?: unknown; email?: unknown; message?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 5000) : "";

  if (!message) {
    return NextResponse.json({ error: "Please include a message." }, { status: 400 });
  }

  const who = [name, email && `<${email}>`].filter(Boolean).join(" ") || "someone";
  const sent = await sendOwnerNotification(
    `Contact form — ${name || email || "new message"}`,
    `From: ${who}\n\n${message}`,
    email
  );

  if (!sent.ok) {
    return NextResponse.json(
      { error: "Couldn’t send right now — email us directly at mikian.photos@gmail.com." },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}
