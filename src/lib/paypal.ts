// Server-side PayPal helpers — used by API routes only.
// Never import from client components.

const ENV = process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";
const API_BASE =
  ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const SECRET = process.env.PAYPAL_SECRET;

function requireCreds(): { clientId: string; secret: string } {
  if (!CLIENT_ID || !SECRET) {
    throw new Error(
      "PayPal credentials missing — set PAYPAL_CLIENT_ID and PAYPAL_SECRET in .env.local"
    );
  }
  return { clientId: CLIENT_ID, secret: SECRET };
}

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const { clientId, secret } = requireCreds();
  const basic = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal OAuth failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.value;
}

export type CreateOrderInput = {
  amountUsd: number;
  description: string;
  referenceId?: string;
};

export async function createOrder(input: CreateOrderInput): Promise<{ id: string }> {
  const token = await getAccessToken();
  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: input.referenceId ?? "default",
        description: input.description,
        amount: {
          currency_code: "USD",
          value: input.amountUsd.toFixed(2),
        },
      },
    ],
    application_context: {
      brand_name: "Mikian.Photos",
      shipping_preference: "NO_SHIPPING",
      user_action: "PAY_NOW",
    },
  };
  const res = await fetch(`${API_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json()) as { id?: string; message?: string; details?: unknown };
  if (!res.ok || !json.id) {
    throw new Error(`PayPal create-order failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return { id: json.id };
}

export type CapturedOrder = {
  /** PayPal ORDER id (the capture response's top-level `id`). */
  id: string;
  /** PayPal CAPTURE id (purchase_units[].payments.captures[].id) — the id a
   *  refund must target. Optional in case a response ever omits it. */
  captureId?: string;
  status: string;
  payerEmail?: string;
  payerName?: string;
  amountUsd?: number;
};

export async function captureOrder(orderId: string): Promise<CapturedOrder> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = (await res.json()) as any;
  if (!res.ok) {
    throw new Error(`PayPal capture failed (${res.status}): ${JSON.stringify(json)}`);
  }
  const captures = json?.purchase_units?.[0]?.payments?.captures ?? [];
  const capture = captures[0];
  return {
    id: json.id,
    captureId: capture?.id,
    status: capture?.status ?? json.status,
    payerEmail: json?.payer?.email_address,
    payerName: [json?.payer?.name?.given_name, json?.payer?.name?.surname]
      .filter(Boolean)
      .join(" "),
    amountUsd: capture?.amount?.value ? parseFloat(capture.amount.value) : undefined,
  };
}

export type RefundResult = { id: string; status: string };

/**
 * Full refund of a captured payment.
 *
 * POST /v2/payments/captures/{captureId}/refund with an empty body refunds
 * the entire captured amount. We send a stable PayPal-Request-Id derived from
 * the capture id so a double-click or network retry is idempotent on PayPal's
 * side (same request id → the same refund is returned, not a second one).
 */
export async function refundCapture(captureId: string): Promise<RefundResult> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/v2/payments/captures/${captureId}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `refund-${captureId}`,
    },
    body: "{}",
    cache: "no-store",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = (await res.json()) as any;
  if (!res.ok) {
    throw new Error(`PayPal refund failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return { id: json.id, status: json.status };
}

/**
 * Resolve the real capture id for a PayPal *order* id. Repairs legacy orders
 * that stored the order id in paypalCaptureId (the capture response's top-level
 * `id` is the order id, not the capture id) so a refund can target the right
 * resource. Returns null if the order can't be read or has no capture.
 */
export async function getCaptureIdFromOrder(orderId: string): Promise<string | null> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = (await res.json()) as any;
  const cap = json?.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  return typeof cap === "string" ? cap : null;
}

export function paypalEnv(): "live" | "sandbox" {
  return ENV;
}
