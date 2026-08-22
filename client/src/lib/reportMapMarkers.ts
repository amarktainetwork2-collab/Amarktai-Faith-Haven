export type ReportMapAmenity = { type: string; detail: string; latitude?: number; longitude?: number };
export type ReportMapPosition = { lat: number; lng: number };

export function createReportEvidenceMarkers<TMap>(input: { map: TMap; property: { title: string; position: ReportMapPosition }; amenities: ReportMapAmenity[]; createMarker: (options: { map: TMap; position: ReportMapPosition; title: string }) => unknown }) {
  input.createMarker({ map: input.map, position: input.property.position, title: input.property.title });
  input.amenities.filter(amenity => Number.isFinite(amenity.latitude) && Number.isFinite(amenity.longitude)).forEach(amenity => input.createMarker({ map: input.map, position: { lat: amenity.latitude!, lng: amenity.longitude! }, title: `${amenity.type}: ${amenity.detail}` }));
}
