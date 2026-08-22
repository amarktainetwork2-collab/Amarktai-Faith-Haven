export type ResidentUnit = { id: number; buildingId: number; ownerUserId: number | null; residentUserId: number | null };
export type UnitLinkedRecord = { unitId: number | null };
export type BuildingRecord = { id: number };
export type BuildingLinkedRecord = { buildingId: number | null; visibility?: string };

export function scopeResidentRecords<TBuilding extends BuildingRecord, TUnit extends ResidentUnit, TTicket extends UnitLinkedRecord, TLevy extends UnitLinkedRecord, TNotice extends BuildingLinkedRecord, TDocument extends BuildingLinkedRecord>(input: { userId: number; buildings: TBuilding[]; units: TUnit[]; tickets: TTicket[]; levyEntries: TLevy[]; notices: TNotice[]; documents: TDocument[] }) {
  const units = input.units.filter(unit => unit.residentUserId === input.userId || unit.ownerUserId === input.userId);
  const buildingIds = new Set(units.map(unit => unit.buildingId));
  return {
    buildings: input.buildings.filter(building => buildingIds.has(building.id)),
    units,
    tickets: input.tickets.filter(ticket => ticket.unitId !== null && units.some(unit => unit.id === ticket.unitId)),
    levyEntries: input.levyEntries.filter(entry => units.some(unit => unit.id === entry.unitId)),
    notices: input.notices.filter(notice => notice.buildingId !== null && buildingIds.has(notice.buildingId)),
    documents: input.documents.filter(document => document.visibility === "public" || document.buildingId === null || buildingIds.has(document.buildingId)),
  };
}
