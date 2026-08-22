import { describe, expect, it } from "vitest";
import { canPresentResearchResult, getResearchProvenanceError } from "./researchProvenancePolicy";

const validSource = { label: "SAPS Crime Statistics", url: "https://www.saps.gov.za/services/crimestats.php", retrievedAt: "2026-08-22T00:00:00.000Z", coverage: "National release; area must be specified", period: "2025/26" };

describe("research provenance policy", () => {
  it("requires dated attributable HTTPS sources for completed research", () => {
    expect(getResearchProvenanceError({ researchType: "amenities", sources: [{ ...validSource, period: undefined }], generatedAt: "2026-08-22T00:00:00.000Z", geographicScope: "Cape Town" })).toBeNull();
    expect(getResearchProvenanceError({ researchType: "amenities", sources: [], generatedAt: "2026-08-22T00:00:00.000Z", geographicScope: "Cape Town" })).toContain("source");
    expect(getResearchProvenanceError({ researchType: "amenities", sources: [{ ...validSource, url: "http://example.com" }], generatedAt: "2026-08-22T00:00:00.000Z", geographicScope: "Cape Town" })).toContain("HTTPS");
  });

  it("requires a reporting period for crime and service claims", () => {
    expect(getResearchProvenanceError({ researchType: "crime", sources: [{ ...validSource, period: undefined }], generatedAt: "2026-08-22T00:00:00.000Z", geographicScope: "Cape Town" })).toContain("period");
    expect(getResearchProvenanceError({ researchType: "services", sources: [validSource], generatedAt: "2026-08-22T00:00:00.000Z", geographicScope: "Cape Town" })).toBeNull();
  });

  it("never treats an unprovenanced or incomplete job as presentable", () => {
    expect(canPresentResearchResult("completed", { sources: [validSource] })).toBe(true);
    expect(canPresentResearchResult("completed", null)).toBe(false);
    expect(canPresentResearchResult("running", { sources: [validSource] })).toBe(false);
  });
});
