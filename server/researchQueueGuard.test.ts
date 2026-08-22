import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const researchRouterSource = routerSource.split("research: router(")[1]?.split("billing: router(")[0] ?? "";

describe("guarded research queue", () => {
  it("persists a zero-debit evidence-review brief as inactive while automated provider dispatch is unavailable", () => {
    expect(researchRouterSource).toContain('status: "awaiting_provider_contract"');
    expect(researchRouterSource).toContain("providerSessionContractReady: false");
    expect(researchRouterSource).toContain("session web-search message contract");
    expect(researchRouterSource).toContain("The request is saved but no research credits have been debited");
  });

  it("does not reserve or debit internal credits and cannot call the media-generation adapter", () => {
    expect(researchRouterSource).toContain("creditsReserved: 0");
    expect(researchRouterSource).not.toContain("createGenxJob(");
    expect(researchRouterSource).not.toContain("researchCreditLedger).values");
  });
});
