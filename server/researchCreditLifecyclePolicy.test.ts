import { describe, expect, it } from "vitest";
import { createResearchDebitInstruction, createResearchRefundInstruction, researchDebitIdempotencyKey, researchRefundIdempotencyKey } from "./researchCreditLifecyclePolicy";

describe("research credit lifecycle policy", () => {
  it("does not create a debit without a documented provider contract or sufficient balance", () => {
    expect(createResearchDebitInstruction({ organisationId: 7, researchJobId: 13, credits: 1, balance: 10, providerContractReady: false })).toBeNull();
    expect(createResearchDebitInstruction({ organisationId: 7, researchJobId: 13, credits: 1, balance: 0, providerContractReady: true })).toBeNull();
  });

  it("creates one deterministic debit instruction only after a ready documented contract", () => {
    const instruction = createResearchDebitInstruction({ organisationId: 7, researchJobId: 13, credits: 1, balance: 10, providerContractReady: true, providerSessionId: "session-1" });
    expect(instruction).toMatchObject({ entryType: "debit", credits: -1, idempotencyKey: researchDebitIdempotencyKey(7, 13), researchJobId: 13, metadata: { providerSessionId: "session-1" } });
  });

  it("refunds only a deterministic debit that failed before provider usage", () => {
    expect(createResearchRefundInstruction({ organisationId: 7, researchJobId: 13, debitedCredits: 1, providerFailedBeforeUsage: false })).toBeNull();
    expect(createResearchRefundInstruction({ organisationId: 7, researchJobId: 13, debitedCredits: 1, providerFailedBeforeUsage: true })).toMatchObject({ entryType: "refund", credits: 1, idempotencyKey: researchRefundIdempotencyKey(7, 13) });
  });
});
