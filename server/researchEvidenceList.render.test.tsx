import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useQuery: vi.fn() }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: { research: { status: { useQuery: mocks.useQuery } } } }));

import { ResearchEvidenceList } from "../client/src/components/ResearchEvidenceList";

describe("completed research evidence list", () => {
  it("renders only reviewed source-labelled evidence details for completed jobs", () => {
    mocks.useQuery.mockReturnValue({ data: { jobs: [{ id: 3, status: "completed", researchType: "crime", locationLabel: "Fallback scope", completedAt: new Date("2026-08-22T12:00:00.000Z"), sourceSnapshot: { geographicScope: "Cape Town precinct", generatedAt: "2026-08-22T12:00:00.000Z", sources: [{ label: "Official crime statistics", url: "https://example.gov.za/crime", retrievedAt: "2026-08-21T12:00:00.000Z", coverage: "Cape Town precinct", period: "2026 Q1" }] }, resultSnapshot: { summary: "Official statistics are shown for the stated reporting period.", caveats: "Compare only matching precinct definitions." } }, { id: 4, status: "awaiting_provider_contract", researchType: "market", locationLabel: "Hidden queue", sourceSnapshot: null }] } });
    const html = renderToStaticMarkup(<ResearchEvidenceList organisationId={4} />);
    expect(html).toContain("Official crime statistics");
    expect(html).toContain("Cape Town precinct");
    expect(html).toContain("2026 Q1");
    expect(html).toContain("Official statistics are shown for the stated reporting period.");
    expect(html).toContain("Compare only matching precinct definitions.");
    expect(html).not.toContain("Hidden queue");
  });
});
