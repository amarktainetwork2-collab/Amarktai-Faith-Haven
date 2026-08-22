import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("workspace completed-research presentation", () => {
  it("suppresses the legacy abbreviated completed-result block so the full evidence list is canonical", () => {
    const workspace = readFileSync(resolve(process.cwd(), "client/src/pages/Workspace.tsx"), "utf8");
    expect(workspace).not.toContain("const completed = (status.data?.jobs ?? []).filter(job => job.status === \"completed\")");
    expect(workspace).toContain("Completed evidence is shown in the source-reviewed evidence section below.");
    expect(workspace).toContain('<ResearchEvidenceList organisationId={activeOrganisationId} />');
  });
});
