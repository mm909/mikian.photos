import { PATH, type HyroxEvent } from "../../events";

/* THE DEV COPY OF THE BOARD lives under /hyrox/dev (owner, 2026-10-15:
 * "make these changes live but under a /dev path because I can't get it
 * to work locally"): the same events, the same rows and routes, the new
 * pages — admin-only in production, the way every page in development
 * is (CLAUDE.md). The public board at /hyrox/<event> is untouched until
 * the owner says this one replaces it. Every link inside the dev pages
 * comes from here, so they never lead back out to the public copy. */
export const DEV_PATH = `${PATH}/dev`;

export function eventPath(ev: HyroxEvent): string {
  return `${DEV_PATH}/${ev.slug}`;
}
export function listPath(ev: HyroxEvent): string {
  return `${eventPath(ev)}/the-list`;
}
