import { loadLanding } from "../../landing/data";
import { L1 } from "../L1";

/* Preview of landing 1, THE DARE (landings/L1.tsx), on live numbers. */
export const dynamic = "force-dynamic";

export default async function Landing1Page() {
  return <L1 data={await loadLanding()} />;
}
