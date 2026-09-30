import { loadLanding } from "../../landing/data";
import { L3 } from "../L3";

/* Preview route for landing 3, THE PROOF (L3.tsx). */
export const dynamic = "force-dynamic";

export default async function Page() {
  return <L3 data={await loadLanding()} />;
}
