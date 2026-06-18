import { redirect } from "next/navigation";

/**
 * /runner is retired in favor of /orders (galleries aren't always races).
 * Redirect any old links/bookmarks/sign-in callbacks there.
 */
export default function RunnerRedirect() {
  redirect("/orders");
}
