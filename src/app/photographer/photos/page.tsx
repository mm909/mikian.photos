import { redirect } from "next/navigation";
import { getEffectivePhotographerId } from "@/lib/photographerLock";
import { PhotosAdminClient } from "@/components/photographer/PhotosAdminClient";

export default async function PhotosAdminPage() {
  const photographerId = await getEffectivePhotographerId();
  if (!photographerId) {
    redirect("/photographer/upload"); // shows the unlock-required panel
  }
  return <PhotosAdminClient />;
}
