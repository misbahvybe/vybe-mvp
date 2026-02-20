const API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY ?? '';

export interface GeocodeResult {
  addressLine: string;
  city: string;
  lat: number;
  lng: number;
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
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
    const data = await res.json();
    const f = data.features?.[0];
    if (!f) return null;
    const p = f.properties;
    const addressLine = [p.address_line1, p.address_line2].filter(Boolean).join(', ') || p.formatted;
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
