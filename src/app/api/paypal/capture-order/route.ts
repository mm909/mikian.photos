import { NextResponse } from "next/server";
import { captureOrder } from "@/lib/paypal";

export async function POST(req: Request) {
  try {
    const { orderId } = (await req.json()) as { orderId?: string };
    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }
    const result = await captureOrder(orderId);
    if (result.status !== "COMPLETED") {
      return NextResponse.json(
        { error: `Capture not completed: ${result.status}`, result },
        { status: 402 }
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
