export const RESEARCH_CREDIT_PACK = { productKey: "research_credit_pack", credits: 10, amountZar: "150.00", name: "Amarktai Property research credit pack" } as const;

export function researchCreditGrantForProduct(productKey: string) {
  return productKey === RESEARCH_CREDIT_PACK.productKey ? RESEARCH_CREDIT_PACK.credits : 0;
}

export function getResearchCreditBalance(entries: { credits: number }[]) {
  return entries.reduce((balance, entry) => balance + entry.credits, 0);
}

export function canDebitResearchCredits(balance: number, requestedCredits: number) {
  return Number.isInteger(requestedCredits) && requestedCredits > 0 && balance >= requestedCredits;
}
