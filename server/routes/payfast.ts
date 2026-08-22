import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { entitlements, orders, paymentNotifications, researchCreditLedger } from "../../drizzle/schema";
import { getDb } from "../db";
import { getPayfastState } from "../integrations/runtime";
import { verifyPayfastSignature } from "../integrations/payfast";
import { writeAudit } from "../platform";
import { researchCreditGrantForProduct } from "../researchCreditPolicy";

export function isVerifiedPayfastPayment(input: { signatureValid: boolean; paymentStatus?: string; receivedAmount?: string; expectedAmount: string }) {
  const amountMatches = Number(input.receivedAmount ?? 0).toFixed(2) === Number(input.expectedAmount).toFixed(2);
  return input.signatureValid && amountMatches && input.paymentStatus === "COMPLETE";
}

export async function handlePayfastItn(req: Request, res: Response) {
  try {
    const state = getPayfastState();
    if (!state.configured) return res.status(503).json({ ok: false, error: "PayFast integration is not configured" });
    const payload = Object.fromEntries(Object.entries(req.body ?? {}).map(([key, value]) => [key, String(value)]));
    const signatureValid = verifyPayfastSignature(payload, process.env.PAYFAST_PASSPHRASE);
    const reference = payload.m_payment_id;
    if (!reference) return res.status(400).json({ ok: false, error: "Missing merchant reference" });
    const db = await getDb();
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    const order = await db.select().from(orders).where(eq(orders.merchantReference, reference)).limit(1);
    if (!order[0]) return res.status(404).json({ ok: false, error: "Order not found" });
    const paymentVerified = isVerifiedPayfastPayment({ signatureValid, paymentStatus: payload.payment_status, receivedAmount: payload.amount_gross ?? payload.amount, expectedAmount: order[0].amountZar });
    const transactionId = payload.pf_payment_id || `unresolved-${reference}`;
    const previous = await db.select().from(paymentNotifications).where(eq(paymentNotifications.providerTransactionId, transactionId)).limit(1);
    if (previous[0]) return res.json({ ok: true, duplicate: true });
    await db.insert(paymentNotifications).values({ orderId: order[0].id, providerTransactionId: transactionId, signatureValid: signatureValid ? 1 : 0, payload });
    if (!paymentVerified) return res.status(400).json({ ok: false, error: "Payment verification failed" });
    const orderUpdate = await db.update(orders).set({ status: "paid" }).where(and(eq(orders.id, order[0].id), eq(orders.status, "pending")));
    if (!orderUpdate[0].affectedRows) return res.json({ ok: true, alreadyEntitled: true });
    await db.insert(entitlements).values({ organisationId: order[0].organisationId, orderId: order[0].id, key: order[0].productKey, quantity: 1 });
    const researchCredits = researchCreditGrantForProduct(order[0].productKey);
    if (researchCredits) await db.insert(researchCreditLedger).values({ organisationId: order[0].organisationId, orderId: order[0].id, entryType: "grant", credits: researchCredits, idempotencyKey: `payfast-research-credit-${order[0].id}`, metadata: { providerTransactionId: transactionId, productKey: order[0].productKey } });
    await writeAudit({ organisationId: order[0].organisationId, action: "billing.entitlement_granted", entityType: "order", entityId: order[0].id, metadata: { productKey: order[0].productKey, providerTransactionId: transactionId } });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Unknown ITN error" });
  }
}
