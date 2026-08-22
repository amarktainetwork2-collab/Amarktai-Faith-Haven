export type ResearchCreditEntryType = "grant" | "debit" | "refund" | "adjustment";

export type ResearchCreditInstruction = {
  entryType: Extract<ResearchCreditEntryType, "debit" | "refund">;
  credits: number;
  idempotencyKey: string;
  researchJobId: number;
  metadata: Record<string, unknown>;
};

export function researchDebitIdempotencyKey(organisationId: number, researchJobId: number) {
  return `research-debit:${organisationId}:${researchJobId}`;
}

export function researchRefundIdempotencyKey(organisationId: number, researchJobId: number) {
  return `research-refund:${organisationId}:${researchJobId}`;
}

export function createResearchDebitInstruction(input: {
  organisationId: number;
  researchJobId: number;
  credits: number;
  balance: number;
  providerContractReady: boolean;
  providerSessionId?: string;
}): ResearchCreditInstruction | null {
  if (!input.providerContractReady || !Number.isInteger(input.credits) || input.credits <= 0 || input.balance < input.credits) return null;
  return {
    entryType: "debit",
    credits: -input.credits,
    idempotencyKey: researchDebitIdempotencyKey(input.organisationId, input.researchJobId),
    researchJobId: input.researchJobId,
    metadata: { provider: "genx", providerSessionId: input.providerSessionId ?? null, reason: "documented_provider_dispatch" },
  };
}

export function createResearchRefundInstruction(input: {
  organisationId: number;
  researchJobId: number;
  debitedCredits: number;
  providerFailedBeforeUsage: boolean;
}): ResearchCreditInstruction | null {
  if (!input.providerFailedBeforeUsage || !Number.isInteger(input.debitedCredits) || input.debitedCredits <= 0) return null;
  return {
    entryType: "refund",
    credits: input.debitedCredits,
    idempotencyKey: researchRefundIdempotencyKey(input.organisationId, input.researchJobId),
    researchJobId: input.researchJobId,
    metadata: { provider: "genx", reason: "documented_provider_failure_before_usage" },
  };
}
