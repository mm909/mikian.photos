/* THE TESTER EMAIL (owner, 2026-11-25: "send out the link as I add them.
 * show me what they will be getting"). Sent from the list page once a
 * tester is in the Play Console's "ROW testers" list: before that Google
 * answers the link with "app not available". sendPlainEmail BCCs the
 * owner, so he gets a copy of every one. */

export const PLAY_OPT_IN = "https://play.google.com/apps/testing/com.rowtember.app";
export const PLAY_LISTING = "https://play.google.com/store/apps/details?id=com.rowtember.app";

/* Owner, 2026-11-26: "if you have any questions, let me know, and you can
 * put my number there"; "just tell them to keep it installed for 14 days". */
const PHONE = "(702) 540-4190";

export const INVITE_SUBJECT = "You're in: test ROW on Android";

/* NO NAME IN THE GREETING (owner, 2026-11-26: "we can just say hi ROW app
 * reviewer, because for some of them we don't have their real name"). */
const first = (_name: string) => "ROW app reviewer";

export function inviteText(name: string, email: string): string {
  return [
    `Hi ${first(name)},`,
    "",
    "Thanks for helping get ROW into the Play Store. You're on the tester list. Three steps, on your Android phone:",
    "",
    `1. Open this link while your Play Store is signed in as ${email}, and tap BECOME A TESTER:`,
    `   ${PLAY_OPT_IN}`,
    "",
    "2. Install ROW from the Play Store:",
    `   ${PLAY_LISTING}`,
    "",
    "3. Leave ROW installed on your phone for 14 days.",
    "",
    "If the Play Store says the app isn't available, give it a few minutes after step 1 and try again.",
    "",
    `Any questions, let me know: ${PHONE}`,
    "",
    "Mikian",
  ].join("\n");
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function inviteHtml(name: string, email: string): string {
  const step = (n: number, body: string) =>
    `<tr><td style="vertical-align:top;padding:0 14px 18px 0;font:700 15px/1.4 Arial,sans-serif;color:#0077B6">${n}</td><td style="padding:0 0 18px;font:15px/1.5 Arial,sans-serif;color:#111">${body}</td></tr>`;
  const button = (href: string, label: string) =>
    `<a href="${href}" style="display:inline-block;margin-top:8px;padding:11px 18px;background:#0077B6;color:#fff;font:700 14px Arial,sans-serif;text-decoration:none;border-radius:8px">${label}</a>`;
  return `<!doctype html><html><body style="margin:0;background:#fff">
<div style="max-width:520px;margin:0 auto;padding:28px 22px">
<p style="margin:0 0 22px;font:900 30px/1 'Arial Black',Arial,sans-serif;letter-spacing:-1px;color:#111">R<span style="color:#0077B6">O</span>W</p>
<p style="margin:0 0 14px;font:15px/1.5 Arial,sans-serif;color:#111">Hi ${esc(first(name))},</p>
<p style="margin:0 0 22px;font:15px/1.5 Arial,sans-serif;color:#111">Thanks for helping get ROW into the Play Store. You're on the tester list. Three steps, on your Android phone:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
${step(1, `<b>Become a tester.</b> Open this while your Play Store is signed in as <b>${esc(email)}</b>, and tap <b>Become a tester</b>.<br>${button(PLAY_OPT_IN, "Become a tester")}`)}
${step(2, `<b>Install ROW</b> from the Play Store.<br>${button(PLAY_LISTING, "Get ROW")}`)}
${step(3, `<b>Keep it installed.</b> Leave ROW on your phone for 14 days.`)}
</table>
<p style="margin:4px 0 14px;font:13px/1.5 Arial,sans-serif;color:#666">If the Play Store says the app isn't available, give it a few minutes after step 1 and try again.</p>
<p style="margin:0 0 22px;font:15px/1.5 Arial,sans-serif;color:#111">Any questions, let me know: <a href="tel:+17025404190" style="color:#111;font-weight:700">${PHONE}</a></p>
<p style="margin:0;font:15px/1.5 Arial,sans-serif;color:#111">Mikian</p>
</div></body></html>`;
}
