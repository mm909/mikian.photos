import { getEffectiveActor, hasRole } from "@/lib/permissions";
import { PhotosAdminClient } from "@/components/photographer/PhotosAdminClient";
import { NoPhotographerAccess } from "@/components/photographer/NoPhotographerAccess";

export default async function PhotosAdminPage() {
  const actor = await getEffectiveActor();
  if (!actor) return <NoPhotographerAccess reason="signed-out" />;
  if (!hasRole(actor, "photographer")) {
    return <NoPhotographerAccess reason="no-role" name={actor.name} />;
  }
  return <PhotosAdminClient />;
}
