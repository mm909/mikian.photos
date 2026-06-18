import { redirect } from "next/navigation";

/**
 * v2.1: the old race-director sales page is replaced by the general
 * "work with us" contact page. Redirect any existing link.
 */
export default function ForRaceDirectorsPage() {
  redirect("/contact");
}
