export const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
export const OVERPASS_INTERPRETER_URL = "https://overpass-api.de/api/interpreter";
export const PUBLIC_AMENITY_RADIUS_METRES = 1_500;
export const PUBLIC_AMENITY_MAX_RESULTS = 50;

type Fetcher = typeof fetch;
type Coordinates = { latitude: number; longitude: number };
export type PublicAmenity = { type: "education" | "healthcare" | "safety" | "shopping" | "transport"; name: string; latitude: number; longitude: number; osmType: string; osmId: number };
export type PublicAmenityResult = { coordinates: Coordinates; amenities: PublicAmenity[]; retrievedAt: string; coverage: string; sourceUrls: string[] };

function publicHeaders(extra: HeadersInit = {}): HeadersInit {
  return { "User-Agent": "AmarktaiProperty/1.0 (+https://property.amarktai.co.za)", Accept: "application/json", ...extra };
}

function finite(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function amenityType(tags: Record<string, string>): PublicAmenity["type"] | null {
  if (["school", "kindergarten", "college", "university", "library"].includes(tags.amenity ?? "")) return "education";
  if (["hospital", "clinic", "doctors", "pharmacy"].includes(tags.amenity ?? "")) return "healthcare";
  if (tags.amenity === "police") return "safety";
  if (["supermarket", "mall", "convenience"].includes(tags.shop ?? "")) return "shopping";
  if (tags.public_transport || tags.railway === "station" || tags.highway === "bus_stop") return "transport";
  return null;
}

function overpassQuery(latitude: number, longitude: number) {
  const tags = '[amenity~"school|kindergarten|college|university|library|hospital|clinic|doctors|pharmacy|police"](around:RADIUS,LAT,LON);nwr[shop~"supermarket|mall|convenience"](around:RADIUS,LAT,LON);nwr[public_transport](around:RADIUS,LAT,LON);nwr[railway="station"](around:RADIUS,LAT,LON);nwr[highway="bus_stop"](around:RADIUS,LAT,LON);';
  return `[out:json][timeout:10];(${tags.replaceAll("RADIUS", String(PUBLIC_AMENITY_RADIUS_METRES)).replaceAll("LAT", latitude.toFixed(6)).replaceAll("LON", longitude.toFixed(6))});out center ${PUBLIC_AMENITY_MAX_RESULTS};`;
}

async function geocode(address: string, fetcher: Fetcher): Promise<Coordinates> {
  const url = new URL(NOMINATIM_SEARCH_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "za");
  url.searchParams.set("q", address);
  const response = await fetcher(url, { headers: publicHeaders() });
  const body = await response.json().catch(() => []);
  if (!response.ok || !Array.isArray(body)) throw new Error("Public address lookup is temporarily unavailable. Try again later or use a licensed provider.");
  const first = body[0] as Record<string, unknown> | undefined;
  const latitude = finite(first?.lat); const longitude = finite(first?.lon);
  if (latitude === null || longitude === null) throw new Error("The property address could not be located by the public source. Confirm the address or use a licensed provider.");
  return { latitude, longitude };
}

export async function fetchPublicAmenities(input: { address?: string; latitude?: unknown; longitude?: unknown }, fetcher: Fetcher = fetch): Promise<PublicAmenityResult> {
  const providedLatitude = finite(input.latitude); const providedLongitude = finite(input.longitude);
  const coordinates = providedLatitude !== null && providedLongitude !== null ? { latitude: providedLatitude, longitude: providedLongitude } : await geocode(input.address?.trim() || "", fetcher);
  const response = await fetcher(OVERPASS_INTERPRETER_URL, { method: "POST", headers: publicHeaders({ "Content-Type": "text/plain;charset=UTF-8" }), body: overpassQuery(coordinates.latitude, coordinates.longitude) });
  const body = await response.json().catch(() => ({})) as { elements?: unknown[] };
  if (!response.ok || !Array.isArray(body.elements)) throw new Error("Public amenity lookup is temporarily unavailable. Try again later or use a licensed provider.");
  const amenities = body.elements.flatMap((value): PublicAmenity[] => {
    if (!value || typeof value !== "object") return [];
    const item = value as Record<string, unknown>; const tags = item.tags && typeof item.tags === "object" ? item.tags as Record<string, string> : {};
    const type = amenityType(tags); const latitude = finite(item.lat) ?? finite((item.center as Record<string, unknown> | undefined)?.lat); const longitude = finite(item.lon) ?? finite((item.center as Record<string, unknown> | undefined)?.lon);
    if (!type || latitude === null || longitude === null || typeof item.id !== "number") return [];
    return [{ type, name: tags.name?.trim() || `${type[0]!.toUpperCase()}${type.slice(1)} place`, latitude, longitude, osmType: typeof item.type === "string" ? item.type : "node", osmId: item.id }];
  }).slice(0, PUBLIC_AMENITY_MAX_RESULTS);
  return { coordinates, amenities, retrievedAt: new Date().toISOString(), coverage: `Up to ${PUBLIC_AMENITY_RADIUS_METRES} m around the selected property; up to ${PUBLIC_AMENITY_MAX_RESULTS} mapped places.`, sourceUrls: [NOMINATIM_SEARCH_URL, OVERPASS_INTERPRETER_URL] };
}
