export type ResearchSource = { label: string; url: string; retrievedAt: string; coverage: string; period?: string };

export function getResearchProvenanceError(input: { researchType: "amenities" | "services" | "crime" | "market"; sources: ResearchSource[]; generatedAt: string; geographicScope: string }) {
  if (!input.geographicScope.trim()) return "A geographic scope is required.";
  if (!Number.isFinite(Date.parse(input.generatedAt))) return "A valid retrieval date is required.";
  if (!input.sources.length) return "At least one attributable source is required.";
  for (const source of input.sources) {
    if (!source.label.trim() || !source.coverage.trim() || !Number.isFinite(Date.parse(source.retrievedAt))) return "Each source requires a label, coverage and retrieval date.";
    try { const url = new URL(source.url); if (url.protocol !== "https:") return "Each source URL must use HTTPS."; } catch { return "Each source requires a valid HTTPS URL."; }
  }
  if ((input.researchType === "crime" || input.researchType === "services") && !input.sources.some(source => Boolean(source.period?.trim()))) return "Crime and service research requires a source reporting period.";
  return null;
}

export function canPresentResearchResult(status: string, sourceSnapshot: unknown) {
  return status === "completed" && Boolean(sourceSnapshot && typeof sourceSnapshot === "object");
}
