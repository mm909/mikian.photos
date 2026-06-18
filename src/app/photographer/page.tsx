import { redirect } from "next/navigation";

/**
 * The photographer dashboard is retired for now — nothing links here anymore
 * (sign-in lands on "/"; upload is reached per-event via /e/[slug]/upload or
 * /photographer/upload). Redirect any stragglers/bookmarks to the home page.
 */
export default function PhotographerOverviewPage() {
  redirect("/");
}
