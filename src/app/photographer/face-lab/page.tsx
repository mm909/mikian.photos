import { redirect } from "next/navigation";

/**
 * Face Lab folded into the unified photo library — face-cluster inspection now
 * lives in the per-photo detail modal at /photographer/photos. Permanent
 * redirect kept so prior URLs / bookmarks still land somewhere useful;
 * `?photo` deep-opens that photo's modal.
 */
export default function FaceLabRedirect({
  searchParams,
}: {
  searchParams?: { photo?: string };
}) {
  redirect(
    searchParams?.photo
      ? `/photographer/photos?photo=${encodeURIComponent(searchParams.photo)}`
      : "/photographer/photos"
  );
}
