import { describe, expect, it } from "vitest";
import { RESEARCH_CREDIT_PACK, canDebitResearchCredits, getResearchCreditBalance, researchCreditGrantForProduct } from "./researchCreditPolicy";

describe("research-credit policy", () => {
  it("recognises only the server-defined top-up product", () => {
    expect(researchCreditGrantForProduct(RESEARCH_CREDIT_PACK.productKey)).toBe(10);
    expect(researchCreditGrantForProduct("professional_monthly")).toBe(0);
  });

  it("calculates an immutable ledger balance from grants, debits, and refunds", () => {
    expect(getResearchCreditBalance([{ credits: 10 }, { credits: -1 }, { credits: -1 }, { credits: 1 }])).toBe(9);
  });

  it("rejects unaffordable, zero, fractional, and negative debit requests", () => {
    expect(canDebitResearchCredits(3, 1)).toBe(true);
    expect(canDebitResearchCredits(0, 1)).toBe(false);
    expect(canDebitResearchCredits(3, 4)).toBe(false);
    expect(canDebitResearchCredits(3, 0)).toBe(false);
    expect(canDebitResearchCredits(3, 1.5)).toBe(false);
  });
});
