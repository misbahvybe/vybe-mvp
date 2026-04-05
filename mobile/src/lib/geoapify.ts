import Constants from 'expo-constants';

export const LAHORE_CENTER = { latitude: 31.5204, longitude: 74.3587 };

export interface GeocodeResult {
  addressLine: string;
  city: string;
  lat: number;
  lng: number;
}

function geoapifyKey(): string {
  const fromEnv =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GEOAPIFY_API_KEY
      ? String(process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY).trim()
      : '';
  const fromExtra = (
    Constants.expoConfig?.extra as { geoapifyApiKey?: string } | undefined
  )?.geoapifyApiKey?.trim();
  return fromEnv || fromExtra || '';
}

/** Address or place text → coordinates (same API key as reverse). */
export async function forwardGeocode(addressText: string): Promise<GeocodeResult | null> {
  const q = addressText.trim();
  if (!q) return null;
  const API_KEY = geoapifyKey();
  if (!API_KEY) return null;
  try {
    const res = await fetch(
      `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(q)}&limit=1&apiKey=${API_KEY}`
    );
    const data = (await res.json()) as {
      features?: {
        geometry?: { coordinates?: [number, number] };
        properties?: {
          address_line1?: string;
          address_line2?: string;
          formatted?: string;
          city?: string;
          state?: string;
        };
      }[];
    };
    const f = data.features?.[0];
    const coords = f?.geometry?.coordinates;
    if (!f || !coords || coords.length < 2) return null;
    const [lng, lat] = coords;
    const p = f.properties ?? {};
    const addressLine =
      [p.address_line1, p.address_line2].filter(Boolean).join(', ') || p.formatted || q;
    return {
      addressLine: addressLine || q,
      city: p.city ?? p.state ?? 'Lahore',
      lat,
      lng,
    };
  } catch {
    return null;
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  const API_KEY = geoapifyKey();
  if (!API_KEY) {
    return {
      addressLine: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      city: 'Lahore',
      lat,
      lng,
    };
  }
  try {
    const res = await fetch(
      `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${API_KEY}`
    );
    const data = (await res.json()) as {
      features?: {
        properties: {
          address_line1?: string;
          address_line2?: string;
          formatted?: string;
          city?: string;
          state?: string;
        };
      }[];
    };
    const f = data.features?.[0];
    if (!f) return null;
    const p = f.properties;
    const addressLine =
      [p.address_line1, p.address_line2].filter(Boolean).join(', ') || p.formatted || '';
    return {
      addressLine: addressLine || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      city: p.city ?? p.state ?? 'Lahore',
      lat,
      lng,
    };
  } catch {
    return { addressLine: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, city: 'Lahore', lat, lng };
  }
}
