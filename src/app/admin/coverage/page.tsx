import { redirect } from "next/navigation";

/**
 * Coverage moved into the combined Roster surface (Roster + By bib / By face
 * / Coverage gaps tabs). Keep this route as a permanent redirect so any old
 * bookmarks or nav links still land somewhere useful.
 */
export default function CoveragePage() {
  redirect("/admin/roster");
}
