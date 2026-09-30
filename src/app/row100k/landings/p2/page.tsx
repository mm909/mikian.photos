import { loadLanding } from "../../landing/data";
import { L2 } from "../L2";

/* Preview route for landing 2, THE MATH (landings/L2.tsx). */
export const dynamic = "force-dynamic";

export default async function LandingPreview2() {
  return <L2 data={await loadLanding()} />;
}
