import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { resolveViewer } from "@/lib/row100kViewer";
import { no, yes } from "../social";

/* THE OWNER'S TOOLS, FROM THE APP (2026-11-21; owner the same day, of what
 * a report should let him do: "give me the ability to remove posts and
 * photos ... sometimes maybe I don't remove the row, but I remove the
 * photo"; "I need to be able to delete a rower").
 *
 * Two of the three already exist on the site and the app calls them as
 * they are: DELETE /api/row100k/rows/[id] takes a row down, and DELETE
 * /api/row100k/participants/[id] removes a rower and their whole log. This
 * route is the third: POST { entryId, photo } takes ONE photo off a row and
 * leaves the row, its metres and its other photo standing. `photo` is the
 * photo's place on the row, 0 or 1.
 *
 * Admins only, everywhere. The file in storage is left where it is, as a
 * deleted row's are; nothing prints it once the row no longer names it. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const viewer = await resolveViewer();
  if (!viewer.actor) return no("Sign in first.", 401);
  if (!viewer.isAdmin) return no("Not allowed.", 403);
  try {
    const body = (await req.json().catch(() => null)) as { entryId?: unknown; photo?: unknown; avatarOf?: unknown } | null;
    /* POST { avatarOf: <participant id> }: take a rower's profile photo
     * down. They go back to initials and may set another. */
    if (typeof body?.avatarOf === "string" && /^[a-z0-9]{1,40}$/i.test(body.avatarOf)) {
      await db.rowSocialSetting.updateMany({ where: { participantId: body.avatarOf, challenge: CHALLENGE }, data: { avatarKey: null } });
      console.info(`row app: ${viewer.actor.email} removed the profile photo of ${body.avatarOf}`);
      return yes();
    }
    const entryId = typeof body?.entryId === "string" && /^[a-z0-9]{1,40}$/i.test(body.entryId) ? body.entryId : "";
    const at = Number(body?.photo);
    if (!entryId || !Number.isInteger(at) || at < 0) return no("Which photo?", 400);
    const entry = await db.rowEntry.findFirst({ where: { id: entryId, challenge: CHALLENGE }, select: { id: true, photos: true } });
    if (!entry) return no("That row is already gone.", 404);
    if (at >= entry.photos.length) return no("That photo is already gone.", 404);
    const photos = entry.photos.filter((_, i) => i !== at);
    await db.rowEntry.update({ where: { id: entry.id }, data: { photos } });
    console.info(`row app: ${viewer.actor.email} removed photo ${at} from row ${entry.id}`);
    revalidateTag("row100k-boards");
    return yes({ photos: photos.length });
  } catch (err) {
    console.error("row app: failed to remove a photo", err);
    return no("That did not go through. Try again.", 500);
  }
}
