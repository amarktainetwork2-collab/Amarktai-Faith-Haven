import { describe, expect, it } from "vitest";
import { NOMINATIM_SEARCH_URL, OVERPASS_INTERPRETER_URL, PUBLIC_AMENITY_MAX_RESULTS, PUBLIC_AMENITY_RADIUS_METRES, fetchPublicAmenities } from "./publicAmenities";

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

describe("bounded public amenity adapter", () => {
  it("geocodes one South African property and sends a small bounded Overpass query", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetcher: typeof fetch = async (url, init) => { calls.push({ url: String(url), init }); if (String(url).startsWith(NOMINATIM_SEARCH_URL)) return json([{ lat: "-33.925", lon: "18.424" }]); return json({ elements: [{ type: "node", id: 22, lat: -33.924, lon: 18.423, tags: { amenity: "school", name: "Example School" } }] }); };
    const result = await fetchPublicAmenities({ address: "1 Example Road, Cape Town" }, fetcher);
    expect(calls[0]?.url).toContain("countrycodes=za");
    expect(calls[0]?.init?.headers).toMatchObject({ "User-Agent": expect.stringContaining("AmarktaiProperty") });
    expect(calls[1]?.url).toBe(OVERPASS_INTERPRETER_URL);
    expect(String(calls[1]?.init?.body)).toContain(`[timeout:10]`);
    expect(String(calls[1]?.init?.body)).toContain(String(PUBLIC_AMENITY_RADIUS_METRES));
    expect(result.amenities).toEqual([expect.objectContaining({ type: "education", name: "Example School" })]);
  });

  it("uses an existing property coordinate without a repeated public geocode and caps output", async () => {
    const elements = Array.from({ length: PUBLIC_AMENITY_MAX_RESULTS + 5 }, (_, id) => ({ type: "node", id, lat: -33.9, lon: 18.4, tags: { shop: "supermarket", name: `Shop ${id}` } }));
    const fetcher: typeof fetch = async url => { expect(String(url)).toBe(OVERPASS_INTERPRETER_URL); return json({ elements }); };
    const result = await fetchPublicAmenities({ latitude: -33.9, longitude: 18.4 }, fetcher);
    expect(result.amenities).toHaveLength(PUBLIC_AMENITY_MAX_RESULTS);
    expect(result.coverage).toContain(`${PUBLIC_AMENITY_RADIUS_METRES} m`);
  });
});
