/**
 * The provider-specific adapter is deliberately inert until a named provider's
 * approved response schema is implemented and reviewed. Keeping this guard in
 * one service boundary prevents a configured endpoint or secret from becoming
 * an accidental generic outbound request.
 */
export async function fetchLicensedAmenities(_input: { provider: string; propertyId: number }, _fetcher: typeof fetch = fetch): Promise<never> {
  throw new Error("The licensed provider is configured but its approved response-field mapping has not been enabled. No provider request was sent.");
}
