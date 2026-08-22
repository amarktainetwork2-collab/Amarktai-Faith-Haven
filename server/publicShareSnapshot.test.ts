import { describe, expect, it } from "vitest";
import { readReportSnapshot } from "../client/src/lib/reportSnapshot";

describe("controlled buyer-report snapshot rendering", () => {
  it("retains cached amenity, dated service, and evidence-reviewed crime provenance for public rendering", () => {
    const report = readReportSnapshot({ amenities: [{ type: "education", detail: "Example School", latitude: -33.924, longitude: 18.423 }], serviceStatus: { label: "Service placeholder", asOf: "2026-08-22T12:00:00.000Z" }, crime: [{ label: "Evidence-reviewed crime context only", geographicScope: "Cape Town precinct", generatedAt: "2026-08-22T12:00:00.000Z", summary: "Official statistics are reported for the labelled period.", caveats: "Compare only with matching geographic definitions.", presentation: "Source, reporting period and geography are shown; this is not a safety verdict.", sources: [{ label: "Official crime statistics", url: "https://example.gov.za/crime", retrievedAt: "2026-08-22T12:00:00.000Z", coverage: "Cape Town precinct", period: "2026 Q1" }] }] });
    expect(report?.amenities).toEqual([{ type: "education", detail: "Example School", latitude: -33.924, longitude: 18.423 }]);
    expect(report?.serviceStatus).toEqual({ label: "Service placeholder", asOf: "2026-08-22T12:00:00.000Z" });
    expect(report?.research).toEqual([expect.objectContaining({ type: "Crime context", locationLabel: "Cape Town precinct", caveats: expect.stringContaining("not a safety verdict"), sources: [expect.objectContaining({ label: "Official crime statistics", period: "2026 Q1" })] })]);
  });
});
