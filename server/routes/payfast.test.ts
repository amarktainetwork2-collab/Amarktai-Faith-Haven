import { describe, expect, it } from "vitest";
import { isVerifiedPayfastPayment } from "./payfast";

describe("PayFast verified ITN entitlement gate", () => {
  it("accepts only a signed COMPLETE payment with the expected amount", () => {
    expect(isVerifiedPayfastPayment({ signatureValid: true, paymentStatus: "COMPLETE", receivedAmount: "499.00", expectedAmount: "499.00" })).toBe(true);
    expect(isVerifiedPayfastPayment({ signatureValid: true, paymentStatus: "COMPLETE", receivedAmount: "499", expectedAmount: "499.00" })).toBe(true);
  });

  it("rejects invalid signatures, non-complete states, and amount mismatches before entitlement creation", () => {
    expect(isVerifiedPayfastPayment({ signatureValid: false, paymentStatus: "COMPLETE", receivedAmount: "499.00", expectedAmount: "499.00" })).toBe(false);
    expect(isVerifiedPayfastPayment({ signatureValid: true, paymentStatus: "PENDING", receivedAmount: "499.00", expectedAmount: "499.00" })).toBe(false);
    expect(isVerifiedPayfastPayment({ signatureValid: true, paymentStatus: "COMPLETE", receivedAmount: "498.99", expectedAmount: "499.00" })).toBe(false);
  });
});
