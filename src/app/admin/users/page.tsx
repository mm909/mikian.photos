import { redirect } from "next/navigation";
import { requireRole } from "@/lib/permissions";
import { UsersAdminClient } from "@/components/admin/UsersAdminClient";

export const dynamic = "force-dynamic";

export default async function UsersAdminPage() {
  const actor = await requireRole("owner");
  if (!actor) {
    // Soft 404 — don't leak the route's existence to non-owners
    redirect("/");
  }
  return <UsersAdminClient />;
}
