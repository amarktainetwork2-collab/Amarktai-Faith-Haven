export const REPORT_SOURCE_SUMMARY = "Amenities are source-labelled cached layers. Crime and service information are dated placeholders until verified sources are activated.";

export function createInitialBuyerReportSnapshot(property: { title: string; addressLine: string }, generatedAt = new Date().toISOString()) {
  return {
    property: { title: property.title, address: property.addressLine },
    amenities: [
      { type: "Schools", detail: "Cached source layer — refresh pending" },
      { type: "Healthcare", detail: "Cached source layer — refresh pending" },
      { type: "Police", detail: "SAPS source-labelled layer — refresh pending" },
      { type: "Transport & shopping", detail: "Cached place layer — refresh pending" },
    ],
    serviceStatus: { label: "Service data placeholder", asOf: generatedAt },
    crime: [],
    crimeStatus: { label: "No evidence-reviewed crime source is attached", asOf: generatedAt, presentation: "Source, reporting period and geographic scope are required; no safety verdict is issued." },
  };
}
