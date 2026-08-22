import { describe, expect, it } from "vitest";
import { buildPayfastSignatureString, calculatePayfastSignature, verifyPayfastSignature } from "./integrations/payfast";
import { getGenxState, getLicensedAmenityState, getPayfastState } from "./integrations/runtime";

describe("deployment-only integration configuration", () => {
  it("keeps GenX disabled without its deployment-only API key", () => {
    const originalKey = process.env.GENX_API_KEY;
    const originalUrl = process.env.GENX_BASE_URL;
    delete process.env.GENX_API_KEY; delete process.env.GENX_BASE_URL;
    expect(getGenxState()).toMatchObject({ configured: false, mode: "disabled", missing: ["GENX_API_KEY"] });
    process.env.GENX_API_KEY = originalKey; process.env.GENX_BASE_URL = originalUrl;
  });

  it("keeps PayFast disabled without merchant credentials", () => {
    const merchantId = process.env.PAYFAST_MERCHANT_ID;
    const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
    delete process.env.PAYFAST_MERCHANT_ID; delete process.env.PAYFAST_MERCHANT_KEY;
    expect(getPayfastState()).toMatchObject({ configured: false, mode: "disabled" });
    process.env.PAYFAST_MERCHANT_ID = merchantId; process.env.PAYFAST_MERCHANT_KEY = merchantKey;
  });

  it("keeps licensed amenity data disabled until credentials, mapping, terms, and approval are complete", () => {
    const keys = ["LICENSED_AMENITY_PROVIDER", "LICENSED_AMENITY_API_URL", "LICENSED_AMENITY_API_KEY", "LICENSED_AMENITY_FIELD_MAPPING_VERSION", "LICENSED_AMENITY_TERMS_ACCEPTED_AT", "LICENSED_AMENITY_APPROVAL_REFERENCE"] as const;
    const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    const restore = () => keys.forEach(key => { if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key]; });
    try {
      keys.forEach(key => delete process.env[key]);
      expect(getLicensedAmenityState()).toMatchObject({ configured: false, mode: "disabled", missing: expect.arrayContaining(keys) });
      process.env.LICENSED_AMENITY_PROVIDER = "Licensed data partner"; process.env.LICENSED_AMENITY_API_URL = "https://provider.example.test"; process.env.LICENSED_AMENITY_API_KEY = "test-key";
      expect(getLicensedAmenityState()).toMatchObject({ configured: false, missing: expect.arrayContaining(["LICENSED_AMENITY_FIELD_MAPPING_VERSION", "LICENSED_AMENITY_TERMS_ACCEPTED_AT", "LICENSED_AMENITY_APPROVAL_REFERENCE"]) });
      process.env.LICENSED_AMENITY_FIELD_MAPPING_VERSION = "v1"; process.env.LICENSED_AMENITY_TERMS_ACCEPTED_AT = "not-a-date"; process.env.LICENSED_AMENITY_APPROVAL_REFERENCE = "AGR-2026-001";
      expect(getLicensedAmenityState()).toMatchObject({ configured: false, missing: expect.arrayContaining(["LICENSED_AMENITY_TERMS_ACCEPTED_AT(valid ISO timestamp)"]) });
      process.env.LICENSED_AMENITY_TERMS_ACCEPTED_AT = "2026-08-22T12:00:00.000Z"; process.env.LICENSED_AMENITY_APPROVAL_REFERENCE = "bad";
      expect(getLicensedAmenityState()).toMatchObject({ configured: false, missing: expect.arrayContaining(["LICENSED_AMENITY_APPROVAL_REFERENCE(valid reference)"]) });
      process.env.LICENSED_AMENITY_APPROVAL_REFERENCE = "AGR-2026-001";
      expect(getLicensedAmenityState()).toMatchObject({ configured: true, mode: "production", missing: [] });
    } finally { restore(); }
  });

  it("reports integrations ready only after required deployment variables are supplied", () => {
    const originalGenxKey = process.env.GENX_API_KEY; const originalGenxUrl = process.env.GENX_BASE_URL;
    const originalPayfastId = process.env.PAYFAST_MERCHANT_ID; const originalPayfastKey = process.env.PAYFAST_MERCHANT_KEY;
    process.env.GENX_API_KEY = "test-key"; process.env.GENX_BASE_URL = "https://genx.example.test";
    process.env.PAYFAST_MERCHANT_ID = "merchant-id"; process.env.PAYFAST_MERCHANT_KEY = "merchant-key";
    expect(getGenxState()).toMatchObject({ configured: true, missing: [], mode: "production" });
    expect(getPayfastState()).toMatchObject({ configured: true, missing: [], mode: "production" });
    if (originalGenxKey === undefined) delete process.env.GENX_API_KEY; else process.env.GENX_API_KEY = originalGenxKey;
    if (originalGenxUrl === undefined) delete process.env.GENX_BASE_URL; else process.env.GENX_BASE_URL = originalGenxUrl;
    if (originalPayfastId === undefined) delete process.env.PAYFAST_MERCHANT_ID; else process.env.PAYFAST_MERCHANT_ID = originalPayfastId;
    if (originalPayfastKey === undefined) delete process.env.PAYFAST_MERCHANT_KEY; else process.env.PAYFAST_MERCHANT_KEY = originalPayfastKey;
  });
});

describe("PayFast signature helpers", () => {
  it("creates a stable parameter string and verifies an authentic payload", () => {
    const payload = { m_payment_id: "AMP-001", amount_gross: "499.00", payment_status: "COMPLETE" };
    expect(buildPayfastSignatureString(payload, "safe pass")).toContain("passphrase=safe+pass");
    const signature = calculatePayfastSignature(payload, "safe pass");
    expect(verifyPayfastSignature({ ...payload, signature }, "safe pass")).toBe(true);
    expect(verifyPayfastSignature({ ...payload, signature: "0".repeat(32) }, "safe pass")).toBe(false);
  });
});
