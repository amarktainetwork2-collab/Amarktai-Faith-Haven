import { createHash, timingSafeEqual } from "node:crypto";
import { getPayfastState } from "./runtime";

export type PayfastPayload = Record<string, string | undefined>;

function encode(value: string) {
  return encodeURIComponent(value.trim()).replace(/%20/g, "+");
}

export function buildPayfastSignatureString(payload: PayfastPayload, passphrase?: string) {
  const pairs = Object.entries(payload)
    .filter(([key, value]) => key !== "signature" && value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${encode(value!)}`);
  if (passphrase) pairs.push(`passphrase=${encode(passphrase)}`);
  return pairs.join("&");
}

export function calculatePayfastSignature(payload: PayfastPayload, passphrase?: string) {
  return createHash("md5").update(buildPayfastSignatureString(payload, passphrase)).digest("hex");
}

export function verifyPayfastSignature(payload: PayfastPayload, passphrase?: string) {
  const supplied = payload.signature;
  if (!supplied) return false;
  const expected = calculatePayfastSignature(payload, passphrase);
  if (supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied.toLowerCase()), Buffer.from(expected));
}

export function buildPayfastCheckout(input: { merchantReference: string; amountZar: string; itemName: string; returnUrl: string; cancelUrl: string; notifyUrl: string }) {
  const integration = getPayfastState();
  if (!integration.configured) throw new Error(`PayFast configuration is incomplete: ${integration.missing.join(", ")}`);
  const payload: PayfastPayload = {
    merchant_id: process.env.PAYFAST_MERCHANT_ID,
    merchant_key: process.env.PAYFAST_MERCHANT_KEY,
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    notify_url: input.notifyUrl,
    m_payment_id: input.merchantReference,
    amount: input.amountZar,
    item_name: input.itemName,
  };
  return {
    action: integration.mode === "sandbox" ? "https://sandbox.payfast.co.za/eng/process" : "https://www.payfast.co.za/eng/process",
    fields: { ...payload, signature: calculatePayfastSignature(payload, process.env.PAYFAST_PASSPHRASE) },
  };
}
