import type { Result } from "@inkora/domain";
import type { InkoraClient } from "../client/types";
import { toAppError } from "../errors";

/**
 * Geocode a free-text place to coordinates via OpenStreetMap Nominatim
 * (matches the OSM/Leaflet stack). Returns null on no match / failure.
 *
 * NOTE: Nominatim is fine for low-volume, one-off calls (like onboarding).
 * At scale, proxy through an Edge Function with a fixed User-Agent + caching
 * to respect the usage policy. Browsers drop the User-Agent header (they send
 * Referer instead), which Nominatim also accepts.
 */
export async function geocodeCity(city: string): Promise<{ lat: number; lng: number } | null> {
  const q = city.trim();
  if (!q) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": "Inkora/0.1 (support@inkora.app)", Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = arr[0];
    if (!first) return null;
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

/**
 * Save the user's city on their profile, geocoding it to lat/lng (best effort).
 * If geocoding fails, the city text is still stored (coords left null).
 */
export async function updateProfileLocation(
  client: InkoraClient,
  city: string,
  country?: string,
): Promise<Result<{ lat: number; lng: number } | null>> {
  const { data: userRes } = await client.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return { ok: false, error: { code: "unauthenticated", message: "Not signed in", retriable: false } };

  // Adding the country disambiguates common city names (e.g. "Athens").
  const query = country?.trim() ? `${city.trim()}, ${country.trim()}` : city;
  const coords = await geocodeCity(query);
  const { error } = await client
    .from("profiles")
    .update({ city: city.trim(), latitude: coords?.lat ?? null, longitude: coords?.lng ?? null })
    .eq("id", uid);
  if (error) return { ok: false, error: toAppError(error) };
  return { ok: true, value: coords };
}
