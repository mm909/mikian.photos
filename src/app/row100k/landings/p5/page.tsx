import { loadLanding } from "../../landing/data";
import { L5 } from "../L5";

/* Preview route for landing 5, THE CLOCK. */
export const dynamic = "force-dynamic";

export default async function P5() {
  return <L5 data={await loadLanding()} />;
}
