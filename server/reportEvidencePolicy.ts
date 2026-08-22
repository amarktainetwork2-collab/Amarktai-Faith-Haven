import type { ResearchSource } from "./researchProvenancePolicy";

export function buildCrimeReportEvidence(input: { researchType: string; geographicScope: string; generatedAt: string; summary: string; caveats: string; sources: ResearchSource[] }) {
  if (input.researchType !== "crime") return null;
  return {
    label: "Evidence-reviewed crime context only",
    geographicScope: input.geographicScope,
    generatedAt: input.generatedAt,
    retrievedAt: input.sources.map(source => source.retrievedAt),
    reportingPeriods: input.sources.flatMap(source => source.period?.trim() ? [source.period.trim()] : []),
    summary: input.summary,
    caveats: input.caveats,
    sources: input.sources,
    presentation: "Source, reporting period and geography are shown; this is not a safety verdict.",
  };
}
