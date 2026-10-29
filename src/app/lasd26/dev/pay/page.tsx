import { redirect } from "next/navigation";
import { lasdPath } from "@/lib/lasd26/paths";

/**
 * The pay-what-you're-able page lived here while it was a mock-up
 * (2026-10-28/29); it is /lasd26/your-share now (owner, 2026-10-29: "Make
 * it 'live' but only if I send the link to someone"). The owner's phone
 * still has this address, so it forwards.
 */
export const dynamic = "force-dynamic";

export default function DevPayRedirect() {
  redirect(lasdPath("/your-share"));
}
