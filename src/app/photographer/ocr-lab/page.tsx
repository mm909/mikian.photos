import { redirect } from "next/navigation";

/**
 * The OCR + Face Lab folded into the unified photo library. Its tuning knobs
 * and cluster inspector now live in the per-photo detail modal at
 * /photographer/photos. This permanent redirect keeps prior URLs / bookmarks
 * working — `?photo` deep-opens that photo's modal; `?mode` is dropped since
 * OCR and Faces are sections of the one modal now.
 */
export default function OcrLabRedirect({
  searchParams,
}: {
  searchParams?: { photo?: string; mode?: string };
}) {
  redirect(
    searchParams?.photo
      ? `/photographer/photos?photo=${encodeURIComponent(searchParams.photo)}`
      : "/photographer/photos"
  );
}
