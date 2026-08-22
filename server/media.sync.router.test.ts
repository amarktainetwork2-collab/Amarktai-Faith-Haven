import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getActiveOrganisationId: vi.fn(),
  getMemberRole: vi.fn(),
  requireOrganisationRole: vi.fn(),
  getPropertyForOrganisation: vi.fn(),
  writeAudit: vi.fn(),
  getGenxState: vi.fn(),
  getGenxCredits: vi.fn(),
  createGenxJob: vi.fn(),
  getGenxJob: vi.fn(),
  getGenxResultUrl: vi.fn(),
  downloadGenxFile: vi.fn(),
  storagePut: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./platform", () => ({
  BILLING_MANAGEMENT_ROLES: ["owner"],
  BUILDING_MANAGEMENT_ROLES: ["owner"],
  PORTAL_MANAGEMENT_ROLES: ["owner"],
  SALES_MANAGEMENT_ROLES: ["owner"],
  TASK_MANAGEMENT_ROLES: ["owner"],
  getActiveOrganisationId: mocks.getActiveOrganisationId,
  getMemberRole: mocks.getMemberRole,
  getPropertyForOrganisation: mocks.getPropertyForOrganisation,
  requireOrganisationRole: mocks.requireOrganisationRole,
  writeAudit: mocks.writeAudit,
}));
vi.mock("./integrations/runtime", () => ({ getGenxState: mocks.getGenxState, getPayfastState: vi.fn() }));
vi.mock("./integrations/genx", () => ({
  cancelGenxJob: vi.fn(),
  createGenxJob: mocks.createGenxJob,
  downloadGenxFile: mocks.downloadGenxFile,
  getGenxCredits: mocks.getGenxCredits,
  getGenxJob: mocks.getGenxJob,
  getGenxResultUrl: mocks.getGenxResultUrl,
}));
vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));

import { appRouter } from "./routers";

const caller = () => appRouter.createCaller({ user: { id: 7, name: "Test operator", role: "user" } } as never);

function syncDb(job: Record<string, unknown>, updates: Record<string, unknown>[]) {
  return {
    select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => [job] }) }) })),
    update: vi.fn(() => ({ set: (values: Record<string, unknown>) => ({ where: async () => { updates.push(values); } }) })),
  };
}

describe("media.sync router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveOrganisationId.mockResolvedValue(4);
    mocks.getMemberRole.mockResolvedValue("owner");
    mocks.getGenxState.mockReturnValue({ configured: true });
    mocks.writeAudit.mockResolvedValue(undefined);
  });

  it.each(["queued", "running", "failed", "cancelled"] as const)("persists the %s provider lifecycle outcome", async status => {
    const updates: Record<string, unknown>[] = [];
    mocks.getDb.mockResolvedValue(syncDb({ id: 9, providerJobId: "provider-9", status: "queued", outputStorageKey: null, outputUrl: null, costCredits: 0 }, updates));
    mocks.getGenxJob.mockResolvedValue({ id: "provider-9", status });

    await expect(caller().media.sync({ organisationId: 4, mediaJobId: 9 })).resolves.toMatchObject({ status });
    expect(updates[0]).toMatchObject({ status, outputStorageKey: undefined, providerUsage: undefined });
  });

  it("downloads a completed provider file into tenant-scoped managed storage and persists its URL and key", async () => {
    const updates: Record<string, unknown>[] = [];
    mocks.getDb.mockResolvedValue(syncDb({ id: 9, providerJobId: "provider-9", status: "running", outputStorageKey: null, outputUrl: null, costCredits: 0 }, updates));
    mocks.getGenxJob.mockResolvedValue({ id: "provider-9", status: "completed", resultUrl: "https://provider.example/output.png", usage: { credits: 3 } });
    mocks.downloadGenxFile.mockResolvedValue({ bytes: Buffer.from([1, 2, 3]), contentType: "image/png" });
    mocks.storagePut.mockResolvedValue({ key: "organisations/4/media/genx-9.png", url: "https://storage.example/9.png" });

    await expect(caller().media.sync({ organisationId: 4, mediaJobId: 9 })).resolves.toMatchObject({ status: "completed", outputUrl: "https://storage.example/9.png" });
    expect(mocks.storagePut).toHaveBeenCalledWith(expect.stringMatching(/^organisations\/4\/media\/genx-9-/), expect.any(Buffer), "image/png");
    expect(updates[0]).toMatchObject({ status: "completed", outputStorageKey: "organisations/4/media/genx-9.png", outputUrl: "https://storage.example/9.png", costCredits: 3 });
  });

  it("rejects a zero-credit media request before creating a job or contacting GenX", async () => {
    const db = { insert: vi.fn() };
    mocks.getDb.mockResolvedValue(db);
    mocks.getPropertyForOrganisation.mockResolvedValue({ id: 3, title: "Test property" });
    mocks.getGenxCredits.mockResolvedValue({ credits: 0 });

    await expect(caller().media.request({ organisationId: 4, propertyId: 3, templateKey: "property-image", model: "grok-imagine", params: { prompt: "A restrained exterior" } })).rejects.toThrow("GenX has no available credits");
    expect(db.insert).not.toHaveBeenCalled();
    expect(mocks.createGenxJob).not.toHaveBeenCalled();
  });
});
