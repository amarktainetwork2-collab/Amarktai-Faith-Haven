import { describe, expect, it, vi } from "vitest";
import { createReportEvidenceMarkers } from "../client/src/lib/reportMapMarkers";

describe("controlled report evidence-map markers", () => {
  it("creates a property marker and markers only for cached amenities with usable coordinates", () => {
    const marker = vi.fn(); const map = { id: "controlled-report-map" };
    createReportEvidenceMarkers({ map, property: { title: "Example home", position: { lat: -33.925, lng: 18.424 } }, amenities: [{ type: "education", detail: "Example School", latitude: -33.924, longitude: 18.423 }, { type: "healthcare", detail: "Unlocated clinic" }], createMarker: marker });
    expect(marker).toHaveBeenCalledTimes(2);
    expect(marker).toHaveBeenNthCalledWith(1, { map, position: { lat: -33.925, lng: 18.424 }, title: "Example home" });
    expect(marker).toHaveBeenNthCalledWith(2, { map, position: { lat: -33.924, lng: 18.423 }, title: "education: Example School" });
  });
});
