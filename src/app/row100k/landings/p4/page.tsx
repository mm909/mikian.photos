import { loadLanding } from "../../landing/data";
import { L4 } from "../L4";

/* Preview route for landing 4, THE CARD (L4.tsx). */
export const dynamic = "force-dynamic";

export default async function Page() {
  return <L4 data={await loadLanding()} />;
}
