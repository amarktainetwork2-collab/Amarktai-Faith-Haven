import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));

import { getActiveOrganisationId, getMemberRole } from "./platform";

function membershipDb(rows: { role: string }[]) {
  return { select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => rows }) }) })) };
}

describe("active organisation membership boundary", () => {
  beforeEach(() => mocks.getDb.mockReset());

  it("returns the requested organisation only for an active membership", async () => {
    mocks.getDb.mockResolvedValue(membershipDb([{ role: "agent" }]));
    await expect(getActiveOrganisationId({ id: 7 }, 42)).resolves.toBe(42);
    await expect(getMemberRole(7, 42)).resolves.toBe("agent");
  });

  it("rejects a requested organisation with no active membership, preventing cross-tenant selection", async () => {
    mocks.getDb.mockResolvedValue(membershipDb([]));
    await expect(getActiveOrganisationId({ id: 7 }, 999)).rejects.toThrow("No active membership");
  });
});
