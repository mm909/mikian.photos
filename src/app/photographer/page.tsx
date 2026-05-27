import { getEffectiveActor } from "@/lib/permissions";
import { NoPhotographerAccess } from "@/components/photographer/NoPhotographerAccess";
import { PhotographerDashboardClient } from "@/components/photographer/PhotographerDashboardClient";

/**
 * Photographer dashboard.
 *
 * Server-side gate (role check) → hand off to the dashboard client which
 * fetches the catalog (?mine=1), renders the LibraryTile grid, and owns the
 * detail-modal state. Sign-out lives in the global AccountWidget — no button
 * here.
 */
export default async function PhotographerOverviewPage() {
  const actor = await getEffectiveActor();
  if (!actor) return <NoPhotographerAccess reason="signed-out" />;
  if (!actor.roles.includes("photographer") && !actor.roles.includes("owner")) {
    return <NoPhotographerAccess reason="no-role" name={actor.name} />;
  }
  return <PhotographerDashboardClient name={actor.name} email={actor.email} />;
}
