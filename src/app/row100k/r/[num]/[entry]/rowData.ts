import { db } from "@/lib/db";
import { activeBlackout } from "@/lib/blackout";
import { digitCount } from "@/lib/blackoutRules";
import { CHALLENGE, fmtDuration, fmtMeters, fmtRowerNumber, fmtSplit, plainTitle } from "@/lib/row100k";
import { maskedIds, previewBlackout, viewOpts, type Viewer } from "@/lib/row100kViewer";
import { relation } from "@/lib/rowSocial";
import { rowedAtFor } from "@/lib/rowedAt";
import { boardView, EMPTY_BOARDS } from "../../../boardData";
import { stampParts, type FeedItem } from "../../../feed/view";
import { resolvePhotoMedia } from "../../../photoUrls";

/* ONE ROW, AS THIS VIEWER MAY SEE IT (owner, 2026-11-23: "let's make a
 * shareable link for a row, just like we can for a profile"). SERVER ONLY.
 *
 * The row is the feed's own FeedItem, built by the feed's own rules
 * (feed/feedData.ts), so the page of one row can never show what its strip
 * on /feed would not:
 *
 *  - NOT THERE: no such row in this challenge, a row that was removed (a
 *    removal deletes it), or a row that is not that rower number's. Null,
 *    and the page is a 404. So is a row across a block, either way, as the
 *    rower's own page is (r/[num]/page.tsx).
 *  - PRIVATE: the rower's account is private and has not accepted this
 *    viewer (lib/rowSocial.ts relation; a signed-out visitor is accepted by
 *    nobody). The feed leaves such a row out of its list; a page that was
 *    asked for by address says why it shows nothing. Whose it is, and no
 *    more: no meters, no time, no pace, no photos, no words of theirs.
 *  - LIGHTS OUT: the rower is one of the hidden while a window is open, as
 *    the board says for this viewer (self and admins exempt). Blocks for the
 *    meters, no time, the real split, no photos, no caption, no telemetry
 *    mark, and THE ELITE mark where the photos would be. When the board
 *    cannot be read during a window, every row but the viewer's own is
 *    hidden and wears the bare block: the same fail-closed rule.
 *  - OPEN: everything.
 *
 * A mute is not asked about: it takes a rower out of the viewer's feed and
 * nothing else. */

export type RowView =
  | { kind: "private"; rowerNumber: number; numStr: string; name: string }
  | { kind: "row"; item: FeedItem; caption: string; telemetry: boolean };

export async function loadRow(viewer: Viewer, num: number, id: string): Promise<RowView | null> {
  const e = await db.rowEntry.findFirst({
    where: { id, challenge: CHALLENGE, participant: { rowerNumber: num } },
    select: {
      id: true,
      participantId: true,
      meters: true,
      seconds: true,
      title: true,
      caption: true,
      photos: true,
      createdAt: true,
      participant: { select: { displayName: true, rowerNumber: true } },
    },
  });
  if (!e) return null;

  const rel = await relation(viewer.myParticipantId, e.participantId);
  if (rel.access === "blocked") return null;
  const who = { rowerNumber: e.participant.rowerNumber, numStr: fmtRowerNumber(e.participant.rowerNumber), name: e.participant.displayName };
  if (rel.access === "private") return { kind: "private", ...who };

  /* The lights-out, exactly as the feed reads it (feedData.ts). */
  let hidden = new Set<string>();
  let hideAll = false;
  try {
    const view = await boardView(viewOpts(viewer));
    hidden = maskedIds(view.boards);
  } catch (err) {
    console.error("row100k/r/[num]/[entry]: failed to load board data for the blackout", err);
    const blackout = previewBlackout(viewer, await activeBlackout());
    hideAll = blackout.active && !(viewer.isAdmin && !viewer.preview);
    hidden = maskedIds(EMPTY_BOARDS);
  }
  const masked = (hideAll && e.participantId !== viewer.myParticipantId) || hidden.has(e.participantId);

  /* A hidden rower's photos are not resolved at all: no address of theirs
   * reaches the browser. */
  const photos = masked ? [] : await resolvePhotoMedia(e.photos);

  let telemetry = false;
  if (!masked) {
    try {
      telemetry = (await db.rowTelemetry.count({ where: { entryId: e.id } })) > 0;
    } catch (err) {
      console.error("row100k/r/[num]/[entry]: failed to read the row's recording", err);
    }
  }

  const item: FeedItem = {
    id: e.id,
    absIso: e.createdAt.toISOString(),
    /* A row off a monitor: when it was rowed, not when it was sent (owner,
     * 2026-11-23; lib/rowedAt.ts). */
    ...stampParts((await rowedAtFor([e])).get(e.id) ?? e.createdAt),
    ...who,
    metersStr: masked ? "" : fmtMeters(e.meters),
    durationStr: masked ? "" : fmtDuration(e.seconds),
    splitStr: fmtSplit(e.meters, e.seconds),
    title: plainTitle(e.title),
    photos,
    masked,
    digits: masked ? digitCount(e.meters) : undefined,
    elite: masked && hidden.has(e.participantId),
  };
  return { kind: "row", item, caption: masked ? "" : (e.caption ?? "").trim(), telemetry };
}
