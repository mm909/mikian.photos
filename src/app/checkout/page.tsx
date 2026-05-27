import { CheckoutScreen } from "@/components/runner/screens/CheckoutScreen";
import { isPaymentsOpen } from "@/lib/paymentLock";

export const dynamic = "force-dynamic"; // we read cookies for the lock

export default function Page() {
  const unlocked = isPaymentsOpen();
  return <CheckoutScreen unlocked={unlocked} />;
}
