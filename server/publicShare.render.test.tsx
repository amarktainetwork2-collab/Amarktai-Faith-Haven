import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  mapProps: [] as Array<{ initialCenter: { lat: number; lng: number }; onMapReady?: (map: unknown) => void }>,
  marker: vi.fn(),
}));

vi.mock("../client/src/lib/trpc", () => ({ trpc: { public: { share: { useQuery: mocks.query } } } }));
vi.mock("wouter", () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>, useRoute: () => [true, { token: "controlled-token" }] }));
vi.mock("../client/src/components/Map", () => ({ MapView: (props: { initialCenter: { lat: number; lng: number }; onMapReady?: (map: unknown) => void }) => { mocks.mapProps.push(props); return <div data-testid="report-map" />; } }));

import PublicShare from "../client/src/pages/PublicShare";

describe("controlled public report rendering", () => {
  beforeEach(() => {
    mocks.mapProps.length = 0; mocks.marker.mockReset();
    mocks.query.mockReturnValue({ isLoading: false, data: { property: { title: "Example home", addressLine: "1 Example Road", suburb: "Example", latitude: "-33.9250000", longitude: "18.4240000" }, share: { permission: "report", expiresAt: null }, report: { sourceSummary: "OpenStreetMap public amenity lookup", snapshot: { amenities: [{ type: "education", detail: "Example School", latitude: -33.924, longitude: 18.423 }], serviceStatus: { label: "Service placeholder", asOf: "2026-08-22T12:00:00.000Z" }, crime: [{ label: "Evidence-reviewed crime context only", geographicScope: "Cape Town precinct", generatedAt: "2026-08-22T12:00:00.000Z", summary: "Official statistics are reported for the labelled period.", caveats: "Compare matching definitions.", presentation: "Source, reporting period and geography are shown; this is not a safety verdict.", sources: [{ label: "Official crime statistics", url: "https://example.gov.za/crime", retrievedAt: "2026-08-22T12:00:00.000Z", coverage: "Cape Town precinct", period: "2026 Q1" }] }] } } } });
  });

  it("renders dated service and source-labelled crime evidence while wiring shared property and cached amenity markers to MapView", () => {
    const html = renderToStaticMarkup(<PublicShare />);
    expect(html).toContain("Service placeholder");
    expect(html).toContain("Official crime statistics");
    expect(html).toContain("2026 Q1");
    expect(html).toContain("not a safety verdict");
    expect(mocks.mapProps).toHaveLength(1);
    expect(mocks.mapProps[0]?.initialCenter).toEqual({ lat: -33.925, lng: 18.424 });
    const globalWithWindow = globalThis as typeof globalThis & { window?: unknown };
    const originalWindow = globalWithWindow.window;
    globalWithWindow.window = { google: { maps: { marker: { AdvancedMarkerElement: mocks.marker } } } } as unknown as Window & typeof globalThis;
    mocks.mapProps[0]?.onMapReady?.({ map: "controlled-report" });
    globalWithWindow.window = originalWindow;
    expect(mocks.marker).toHaveBeenNthCalledWith(1, { map: { map: "controlled-report" }, position: { lat: -33.925, lng: 18.424 }, title: "Example home" });
    expect(mocks.marker).toHaveBeenNthCalledWith(2, { map: { map: "controlled-report" }, position: { lat: -33.924, lng: 18.423 }, title: "education: Example School" });
  });
});
