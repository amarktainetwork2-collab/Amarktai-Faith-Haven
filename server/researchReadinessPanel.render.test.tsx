import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResearchReadinessPanel } from "../client/src/components/ResearchReadinessPanel";

describe("research readiness panel", () => {
  it("labels the available queue as zero-debit evidence review while automated provider dispatch remains unavailable", () => {
    const html = renderToStaticMarkup(<ResearchReadinessPanel canRequest />);
    expect(html).toContain("zero debited credits");
    expect(html).toContain("evidence-review brief");
    expect(html).toContain("Automatic provider usage");
    expect(html).toContain("Role can save review briefs");
  });
});
