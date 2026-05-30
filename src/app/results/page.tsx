import { redirect } from "next/navigation";

/**
 * The standalone full-grid results screen was folded into the in-flow photo
 * viewer (the teaser's "See all my photos" opens it directly). Keep this route
 * as a redirect so old links / bookmarks land on the search landing.
 */
export default function Page() {
  redirect("/");
}
