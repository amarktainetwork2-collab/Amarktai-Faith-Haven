import { describe, expect, it } from "vitest";
import { buildCrimeReportEvidence } from "./reportEvidencePolicy";

describe("crime report evidence policy", () => {
  const sources = [{ label: "Official crime statistics", url: "https://example.gov.za/crime", retrievedAt: "2026-08-22T12:00:00.000Z", coverage: "Cape Town police precinct", period: "2026 Q1" }];

  it("builds source-, period-, scope-, and retrieval-labelled crime context without a safety verdict", () => {
    const evidence = buildCrimeReportEvidence({ researchType: "crime", geographicScope: "Cape Town police precinct", generatedAt: "2026-08-22T12:00:00.000Z", summary: "Reported incidents are described in the attached official period.", caveats: "Geography and reporting methods affect comparisons.", sources });
    expect(evidence).toMatchObject({ label: "Evidence-reviewed crime context only", geographicScope: "Cape Town police precinct", reportingPeriods: ["2026 Q1"], retrievedAt: ["2026-08-22T12:00:00.000Z"], sources, presentation: expect.stringContaining("not a safety verdict") });
  });

  it("does not create a crime report record for other evidence types", () => {
    expect(buildCrimeReportEvidence({ researchType: "services", geographicScope: "Cape Town", generatedAt: "2026-08-22T12:00:00.000Z", summary: "Service evidence", caveats: "Dated", sources })).toBeNull();
  });
});
