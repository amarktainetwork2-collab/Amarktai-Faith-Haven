export type IntegrationState = {
  configured: boolean;
  missing: string[];
  mode: "disabled" | "sandbox" | "production";
};

function state(required: string[], mode: "sandbox" | "production" = "production"): IntegrationState {
  const missing = required.filter(key => !process.env[key]);
  return { configured: missing.length === 0, missing, mode: missing.length === 0 ? mode : "disabled" };
}

export function getGenxState(): IntegrationState {
  return state(["GENX_API_KEY"]);
}

export function getPayfastState(): IntegrationState {
  const modeValue = process.env.PAYFAST_MODE;
  const base = state(["PAYFAST_MODE", "PAYFAST_MERCHANT_ID", "PAYFAST_MERCHANT_KEY"]);
  const invalid = modeValue && !["sandbox", "production"].includes(modeValue) ? ["PAYFAST_MODE(sandbox or production)"] : [];
  const configured = base.configured && invalid.length === 0;
  return { ...base, configured, missing: [...base.missing, ...invalid], mode: configured ? modeValue as "sandbox" | "production" : "disabled" };
}

/** A provider name, endpoint and secret are required before the licensed data path may make any request. */
export function getLicensedAmenityState(): IntegrationState {
  const required = ["LICENSED_AMENITY_PROVIDER", "LICENSED_AMENITY_API_URL", "LICENSED_AMENITY_API_KEY", "LICENSED_AMENITY_FIELD_MAPPING_VERSION", "LICENSED_AMENITY_TERMS_ACCEPTED_AT", "LICENSED_AMENITY_APPROVAL_REFERENCE"];
  const base = state(required);
  const acceptedAt = process.env.LICENSED_AMENITY_TERMS_ACCEPTED_AT;
  const approvalReference = process.env.LICENSED_AMENITY_APPROVAL_REFERENCE;
  const invalid = [
    ...(acceptedAt && Number.isNaN(Date.parse(acceptedAt)) ? ["LICENSED_AMENITY_TERMS_ACCEPTED_AT(valid ISO timestamp)"] : []),
    ...(approvalReference && approvalReference.trim().length < 6 ? ["LICENSED_AMENITY_APPROVAL_REFERENCE(valid reference)"] : []),
  ];
  return { ...base, configured: base.configured && invalid.length === 0, missing: [...base.missing, ...invalid], mode: base.configured && invalid.length === 0 ? "production" : "disabled" };
}
