import { redirect } from "next/navigation";

/**
 * v2.1: the global settings page is retired. Pricing + photographer access are
 * now per-event (see /e/[slug]/settings); event creation/listing lives at
 * /admin/events. Redirect any old link there.
 */
export const dynamic = "force-dynamic";

export default function UsersAdminPage() {
  redirect("/admin/events");
}
