export type CustomerLocation = { latitude: number; longitude: number };

const KEY = 'vybe_customer_location_v1';
const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export function loadCachedCustomerLocation(): CustomerLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as { latitude: number; longitude: number; at: number };
    if (!obj || !Number.isFinite(obj.latitude) || !Number.isFinite(obj.longitude) || !Number.isFinite(obj.at)) {
      return null;
    }
    if (Date.now() - obj.at > MAX_AGE_MS) return null;
    return { latitude: obj.latitude, longitude: obj.longitude };
  } catch {
    return null;
  }
}

export function cacheCustomerLocation(loc: CustomerLocation) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loc, at: Date.now() }));
  } catch {
    // ignore
  }
}

export async function getCustomerLocationOnce(options?: { timeoutMs?: number }): Promise<CustomerLocation | null> {
  const cached = loadCachedCustomerLocation();
  if (cached) return cached;
  if (typeof window === 'undefined' || !('geolocation' in navigator)) return null;
  const timeoutMs = Math.max(1000, Math.min(15000, options?.timeoutMs ?? 8000));
  return await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          const loc = { latitude, longitude };
          cacheCustomerLocation(loc);
          resolve(loc);
        } else {
          resolve(null);
        }
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

