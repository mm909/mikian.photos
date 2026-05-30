import { CheckoutScreen } from "@/components/runner/screens/CheckoutScreen";
import { isPaymentsOpen } from "@/lib/paymentLock";
import { isOwnerActor } from "@/lib/permissions";

export const dynamic = "force-dynamic"; // we read cookies/session for the lock

export default async function Page() {
  // Owner sees the buy flow even while the shop is locked for everyone else.
  const unlocked = isPaymentsOpen() || (await isOwnerActor());
  return <CheckoutScreen unlocked={unlocked} />;
}
