import { redirect } from "next/navigation";

/**
 * Face Lab merged into the OCR Lab (mode toggle inside). Permanent
 * redirect kept so any prior URLs / bookmarks still land in the right
 * place — with the faces mode pre-selected.
 */
export default function FaceLabRedirect({
  searchParams,
}: {
  searchParams?: { photo?: string };
}) {
  const qs = new URLSearchParams({ mode: "faces" });
  if (searchParams?.photo) qs.set("photo", searchParams.photo);
  redirect(`/photographer/ocr-lab?${qs.toString()}`);
}
