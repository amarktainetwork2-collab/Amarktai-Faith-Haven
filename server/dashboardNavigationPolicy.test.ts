import { describe, expect, it } from "vitest";
import { visibleDashboardNavigation } from "../client/src/dashboardNavigationPolicy";

describe("dashboard navigation policy", () => {
  it("limits residents to their overview and building context", () => {
    expect(visibleDashboardNavigation("resident").map(item => item.path)).toEqual(["/app", "/app/buildings"]);
  });

  it("gives analysts intelligence and listing visibility without operational controls", () => {
    expect(visibleDashboardNavigation("analyst").map(item => item.path)).toEqual(["/app", "/app/listings", "/app/intelligence", "/app/insights"]);
  });

  it("keeps commercial agents out of building-management navigation", () => {
    expect(visibleDashboardNavigation("agent").map(item => item.path)).toEqual(["/app", "/app/listings", "/app/leads", "/app/intelligence", "/app/studio"]);
  });
});
