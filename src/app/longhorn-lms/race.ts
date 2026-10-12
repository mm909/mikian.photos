/* THE LONGHORN LAST PERSON STANDING (owner, 2026-10-12): the facts the
 * sign-up page, its routes and the list print. One place, so the date and
 * the close move together. No imports: the client form reads this too. */

export const RACE = "longhorn-lms";
export const RACE_NAME = "Longhorn Last Person Standing";
export const RACE_SHORT = "Longhorn LMS";
/* Saturday, Dec 5, 2026, 7:00 AM Central (CST, UTC−6). */
export const RACE_START_MS = Date.UTC(2026, 11, 5, 13, 0, 0);
/* The page closes three days after the start (owner, 2026-10-12). */
export const CLOSE_MS = RACE_START_MS + 3 * 86_400_000;
export const VENUE = "2705 Gatlin Creek Road, Dripping Springs, TX";
export const LOOP_MILES = "4.1667";
export const CAPSTONE_URL = "https://capstone.run/longhorn-lms";
export const ULTRASIGNUP_URL = "https://ultrasignup.com/register.aspx?did=136963";
export const OWNER_IG = "mikian_";

export const PATH = "/longhorn-lms";
export const LIST_PATH = "/longhorn-lms/the-list";

export function isClosed(atMs = Date.now()): boolean {
  return atMs >= CLOSE_MS;
}

/* "@handle", "handle", or a pasted profile URL → bare handle. */
export function igHandle(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let h = raw.trim();
  const m = h.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (m) h = m[1];
  return h.replace(/^@+/, "").replace(/[^A-Za-z0-9._]/g, "").slice(0, 64);
}

/* A phone number as typed, kept to the characters a number can carry. */
export function cleanPhone(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/[^0-9+()\-.\s]/g, "").slice(0, 32);
}

export const PHOTO_KEY_RE = /^longhorn-lms\/[A-Za-z0-9_-]+\/[a-z0-9-]+\.(jpe?g|png|webp)$/i;
