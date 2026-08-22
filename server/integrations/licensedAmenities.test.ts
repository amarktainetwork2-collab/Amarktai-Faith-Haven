import { describe, expect, it, vi } from "vitest";
import { fetchLicensedAmenities } from "./licensedAmenities";

describe("licensed amenity service stub", () => {
  it("rejects before any outbound provider request until an approved response mapping is implemented", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(fetchLicensedAmenities({ provider: "Licensed data partner", propertyId: 3 }, fetcher)).rejects.toThrow("response-field mapping has not been enabled");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
