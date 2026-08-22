import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getActiveOrganisationId: vi.fn(),
  getMemberRole: vi.fn(),
  requireOrganisationRole: vi.fn(),
  getPropertyForOrganisation: vi.fn(),
  getReportSnapshot: vi.fn(),
  writeAudit: vi.fn(),
  getLicensedAmenityState: vi.fn(),
  fetchPublicAmenities: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./platform", () => ({
  BILLING_MANAGEMENT_ROLES: ["owner"], BUILDING_MANAGEMENT_ROLES: ["owner"], PORTAL_MANAGEMENT_ROLES: ["owner"], SALES_MANAGEMENT_ROLES: ["owner"], TASK_MANAGEMENT_ROLES: ["owner"],
  getActiveOrganisationId: mocks.getActiveOrganisationId, getMemberRole: mocks.getMemberRole, requireOrganisationRole: mocks.requireOrganisationRole, getPropertyForOrganisation: mocks.getPropertyForOrganisation, getReportSnapshot: mocks.getReportSnapshot, writeAudit: mocks.writeAudit,
}));
vi.mock("./integrations/runtime", () => ({ getGenxState: vi.fn(), getPayfastState: vi.fn(), getLicensedAmenityState: mocks.getLicensedAmenityState }));
vi.mock("./integrations/publicAmenities", () => ({ fetchPublicAmenities: mocks.fetchPublicAmenities }));

import { appRouter } from "./routers";

const caller = () => appRouter.createCaller({ user: { id: 7, name: "Test operator", role: "user" } } as never);
const property = { id: 3, addressLine: "1 Example Road", suburb: "Example", city: "Cape Town", province: "Western Cape", latitude: null, longitude: null };

describe("amenity source router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveOrganisationId.mockResolvedValue(4); mocks.getMemberRole.mockResolvedValue("owner"); mocks.writeAudit.mockResolvedValue(undefined);
    mocks.getLicensedAmenityState.mockReturnValue({ configured: false, missing: ["LICENSED_AMENITY_API_KEY"], mode: "disabled" });
    mocks.getPropertyForOrganisation.mockResolvedValue(property); mocks.getReportSnapshot.mockResolvedValue(null);
  });

  it("returns both user-selectable paths while exposing only the licensed readiness state", async () => {
    await expect(caller().amenity.sources()).resolves.toMatchObject({ public: { key: "public_osm", ready: true }, licensed: { key: "licensed_provider", ready: false } });
  });

  it("persists a bounded public result with a provenance-ready report and source-run record", async () => {
    const inserts: Record<string, unknown>[] = [];
    const updates: Record<string, unknown>[] = [];
    mocks.getDb.mockResolvedValue({ update: vi.fn(() => ({ set: (values: Record<string, unknown>) => ({ where: async () => updates.push(values) }) })), insert: vi.fn(() => ({ values: async (values: Record<string, unknown>) => inserts.push(values) })) });
    mocks.fetchPublicAmenities.mockResolvedValue({ coordinates: { latitude: -33.925, longitude: 18.424 }, amenities: [{ type: "education", name: "Example School", latitude: -33.924, longitude: 18.423, osmType: "node", osmId: 1 }], retrievedAt: "2026-08-22T12:00:00.000Z", coverage: "Up to 1500 m", sourceUrls: ["https://nominatim.openstreetmap.org/search", "https://overpass-api.de/api/interpreter"] });

    await expect(caller().amenity.refresh({ organisationId: 4, propertyId: 3, sourcePath: "public_osm" })).resolves.toMatchObject({ sourcePath: "public_osm", cached: false, amenityCount: 1 });
    expect(mocks.fetchPublicAmenities).toHaveBeenCalledWith(expect.objectContaining({ address: expect.stringContaining("South Africa") }));
    expect(updates[0]).toMatchObject({ latitude: "-33.9250000", longitude: "18.4240000" });
    expect(inserts).toEqual(expect.arrayContaining([expect.objectContaining({ propertyId: 3, snapshot: expect.objectContaining({ amenitySourcePath: "public_osm", amenityProvenance: expect.objectContaining({ retrievedAt: "2026-08-22T12:00:00.000Z" }) }) }), expect.objectContaining({ sourceKey: "public_osm_amenities", recordCount: 1 })]));
  });

  it("rejects the licensed option before outbound data dispatch when readiness is incomplete or mapping activation is absent", async () => {
    mocks.getDb.mockResolvedValue({});
    await expect(caller().amenity.refresh({ organisationId: 4, propertyId: 3, sourcePath: "licensed_provider" })).rejects.toThrow("deployment-only provider contract");
    mocks.getLicensedAmenityState.mockReturnValue({ configured: true, missing: [], mode: "production" });
    await expect(caller().amenity.refresh({ organisationId: 4, propertyId: 3, sourcePath: "licensed_provider" })).rejects.toThrow("response-field mapping has not been enabled");
    expect(mocks.fetchPublicAmenities).not.toHaveBeenCalled();
  });
});
