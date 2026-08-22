import { describe, expect, it } from "vitest";
import { scopeResidentRecords } from "./residentScope";

describe("resident unit-scope policy", () => {
  it("returns only records connected to the assigned resident unit and its building", () => {
    const scoped = scopeResidentRecords({
      userId: 7,
      buildings: [{ id: 1 }, { id: 2 }],
      units: [{ id: 10, buildingId: 1, residentUserId: 7, ownerUserId: null }, { id: 20, buildingId: 2, residentUserId: 8, ownerUserId: null }],
      tickets: [{ unitId: 10 }, { unitId: 20 }, { unitId: null }],
      levyEntries: [{ unitId: 10 }, { unitId: 20 }],
      notices: [{ buildingId: 1 }, { buildingId: 2 }],
      documents: [{ buildingId: 1, visibility: "residents" }, { buildingId: 2, visibility: "residents" }, { buildingId: null, visibility: "public" }],
    });
    expect(scoped.buildings.map(row => row.id)).toEqual([1]);
    expect(scoped.units.map(row => row.id)).toEqual([10]);
    expect(scoped.tickets).toEqual([{ unitId: 10 }]);
    expect(scoped.levyEntries).toEqual([{ unitId: 10 }]);
    expect(scoped.notices).toEqual([{ buildingId: 1 }]);
    expect(scoped.documents).toEqual([{ buildingId: 1, visibility: "residents" }, { buildingId: null, visibility: "public" }]);
  });
});
