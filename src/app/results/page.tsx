import { RunnerFlow } from "@/components/runner/screens/RunnerFlow";

export default function Page() {
  // Back-compat alias — deep links and the cart "back to photos" land on the
  // full grid. The flow otherwise lives entirely at "/".
  return <RunnerFlow initialStep="all" />;
}
