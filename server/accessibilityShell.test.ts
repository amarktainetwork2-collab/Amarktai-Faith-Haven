import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readClientFile = (path: string) => readFileSync(new URL(`../client/src/${path}`, import.meta.url), "utf8");

describe("accessibility shell safeguards", () => {
  it("keeps a visible focus treatment for custom interactive elements", () => {
    const css = readClientFile("index.css");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("outline: 3px solid");
  });

  it("keeps skip links and named main regions in both public and dashboard shells", () => {
    const publicShell = readClientFile("components/PublicShell.tsx");
    const dashboardShell = readClientFile("components/DashboardLayout.tsx");
    const home = readClientFile("pages/Home.tsx");
    expect(publicShell).toMatch(/skip to (main )?content/i);
    expect(dashboardShell).toMatch(/skip to (workspace |main )?content/i);
    expect(publicShell).toContain('href="#public-main"');
    expect(home).toContain('id="public-main"');
    expect(dashboardShell).toContain('id="workspace-main"');
  });
});
