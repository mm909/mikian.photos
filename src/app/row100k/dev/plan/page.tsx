import { permanentRedirect } from "next/navigation";

/* The plan went live at /row100k/plan (owner, 2026-09-25); the old dev
 * address only forwards there. */
export default function DevPlanRedirect() {
  permanentRedirect("/row100k/plan");
}
