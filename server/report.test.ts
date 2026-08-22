import { describe, expect, it } from "vitest";
import { REPORT_SOURCE_SUMMARY, createInitialBuyerReportSnapshot } from "./report";

describe("buyer report source-labelling policy", () => {
  it("marks initial amenity, crime, and service content as sourced placeholders", () => {
    const snapshot = createInitialBuyerReportSnapshot({ title: "Rosebank apartment", addressLine: "1 Example Road" }, "2026-08-22T00:00:00.000Z");
    expect(snapshot.serviceStatus).toEqual({ label: "Service data placeholder", asOf: "2026-08-22T00:00:00.000Z" });
    expect(snapshot.amenities.some(item => item.detail.includes("source") || item.detail.includes("Cached"))).toBe(true);
    expect(snapshot.amenities.find(item => item.type === "Police")?.detail).toContain("SAPS source-labelled");
    expect(snapshot.crime).toEqual([]);
    expect(snapshot.crimeStatus).toMatchObject({ asOf: "2026-08-22T00:00:00.000Z", presentation: expect.stringContaining("reporting period") });
  });

  it("never represents initial report content as a safety verdict", () => {
    expect(REPORT_SOURCE_SUMMARY.toLowerCase()).toContain("source-labelled");
    expect(REPORT_SOURCE_SUMMARY.toLowerCase()).toContain("dated placeholders");
    expect(REPORT_SOURCE_SUMMARY.toLowerCase()).not.toContain("safe");
    expect(REPORT_SOURCE_SUMMARY.toLowerCase()).not.toContain("unsafe");
  });
});
