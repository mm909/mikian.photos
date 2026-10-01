import { fmtRowerNumber } from "@/lib/row100k";
import { ROWTEMBER_ORIGIN } from "@/lib/rowSegments";

/* THE NEW-ROWER NOTE — the plain-text line the owner gets when somebody
 * joins (api/row100k/join, first joins only, live namespace only). Lifted
 * out of the route on 2026-09-27 so the emails page (row100k/emails) can
 * show the very words the route sends; the route calls this and nothing
 * about the mail changed. Pure: no db, no network.
 *
 * No handle, no "@" (owner, 2026-09-24) — the subject and the line both
 * fall silent rather than print an empty one. The birthday is deliberately
 * NOT in this mail: nothing shows it anywhere yet. */
export type JoinNote = { subject: string; text: string };

export function joinNote(o: {
  rowerNumber: number;
  displayName: string;
  instagram: string;
  division: string;
  accountName: string;
  accountEmail: string;
}): JoinNote {
  const num = fmtRowerNumber(o.rowerNumber);
  return {
    subject: `Rowtember signup — ${num} ${o.displayName}${o.instagram ? ` (@${o.instagram})` : ""}`,
    text: [
      `Rower ${num} just joined Rowtember.`,
      ``,
      `Name on the board: ${o.displayName}`,
      o.instagram ? `Instagram: @${o.instagram} — https://instagram.com/${o.instagram}` : `Instagram: none given`,
      `Board: ${o.division === "F" ? "Women's" : "Men's"}`,
      `Account: ${o.accountName} <${o.accountEmail}>`,
      ``,
      `The board: ${ROWTEMBER_ORIGIN}/board`,
    ].join("\n"),
  };
}
