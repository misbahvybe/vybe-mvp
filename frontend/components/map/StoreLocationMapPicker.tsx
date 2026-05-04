'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { reverseGeocode } from '@/services/geoapify';
import { Loader } from '@/components/ui/Loader';
import api from '@/services/api';

const LAHORE_CENTER = { lat: 31.5204, lng: 74.3587 };

type PeerStore = { id: string; name: string; latitude?: unknown; longitude?: unknown };

function parseCoord(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function makePinIcon(L: typeof import('leaflet')) {
  return L.divIcon({
    className: 'superapp-map-pin-wrap',
    html: '<div class="superapp-map-pin" aria-hidden="true"></div>',
    iconSize: [40, 48],
    iconAnchor: [20, 48],
  });
}

export interface StoreLocationMapPickerProps {
  /** Current store (excluded from peer dots). */
  storeId: string;
  initialLat?: number;
  initialLng?: number;
  onSelect: (addressLine: string, city: string, lat: number, lng: number) => void;
}

/**
 * Map for store owners to set pickup location. Shows other food-category stores as orange dots for context.
 */
export function StoreLocationMapPicker({ storeId, initialLat, initialLng, onSelect }: StoreLocationMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [geoState, setGeoState] = useState<'idle' | 'pending' | 'ok' | 'denied' | 'unsupported'>('idle');
  const [hasGeolocationApi, setHasGeolocationApi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [peerCount, setPeerCount] = useState<number | null>(null);
  const [satelliteMode, setSatelliteMode] = useState(false);
  const mapRef = useRef<{
    map: import('leaflet').Map;
    marker: import('leaflet').Marker;
    streetLayer: import('leaflet').TileLayer;
    satelliteLayer: import('leaflet').TileLayer;
  } | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const startLat = initialLat ?? LAHORE_CENTER.lat;
  const startLng = initialLng ?? LAHORE_CENTER.lng;

  const fetchAddress = useCallback(async (latitude: number, longitude: number) => {
    setLoading(true);
    const result = await reverseGeocode(latitude, longitude);
    setLoading(false);
    if (result) {
      onSelectRef.current(result.addressLine, result.city, result.lat, result.lng);
    }
  }, []);

  const tryGeolocate = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoState('unsupported');
      return;
    }
    setGeoState('pending');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGeoState('ok');
        const m = mapRef.current;
        if (m) {
          m.marker.setLatLng([lat, lng]);
          const zoom = satelliteMode ? 18 : 16;
          m.map.flyTo([lat, lng], zoom, { duration: 0.6 });
        }
        void fetchAddress(lat, lng);
      },
      () => setGeoState('denied'),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 14_000 },
    );
  }, [fetchAddress, satelliteMode]);

  useEffect(() => {
    setHasGeolocationApi(typeof navigator !== 'undefined' && !!navigator.geolocation);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    let cancelled = false;
    import('leaflet').then(async (L) => {
      if (cancelled || !containerRef.current) return;

      let peers: PeerStore[] = [];
      try {
        const res = await api.get<PeerStore[]>('/stores', { params: { category: 'food' } });
        peers = (res.data ?? []).filter((s) => {
          if (s.id === storeId) return false;
          return parseCoord(s.latitude) != null && parseCoord(s.longitude) != null;
        });
        if (!cancelled) setPeerCount(peers.length);
      } catch {
        if (!cancelled) setPeerCount(0);
      }

      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current!, {
        scrollWheelZoom: true,
        zoomControl: true,
      }).setView([startLat, startLng], 13);

      const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      });
      const satelliteLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: 'Tiles © Esri' },
      );
      streetLayer.addTo(map);

      const peerLayer = L.layerGroup();
      for (const s of peers) {
        const plat = parseCoord(s.latitude);
        const plng = parseCoord(s.longitude);
        if (plat == null || plng == null) continue;
        L.circleMarker([plat, plng], {
          radius: 7,
          color: '#ea580c',
          weight: 2,
          fillColor: '#fb923c',
          fillOpacity: 0.85,
        })
          .bindPopup(`<strong>${escHtml(s.name)}</strong><br/><span style="font-size:11px;opacity:.9">Food partner</span>`)
          .addTo(peerLayer);
      }
      peerLayer.addTo(map);

      const marker = L.marker([startLat, startLng], {
        draggable: true,
        icon: makePinIcon(L),
        riseOnHover: true,
      }).addTo(map);

      const points: [number, number][] = [[startLat, startLng]];
      for (const s of peers) {
        const plat = parseCoord(s.latitude);
        const plng = parseCoord(s.longitude);
        if (plat != null && plng != null) points.push([plat, plng]);
      }
      if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 15 });
      }

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        void fetchAddress(pos.lat, pos.lng);
      });

      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        void fetchAddress(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = { map, marker, streetLayer, satelliteLayer };
      setReady(true);

      const hasSavedCoords =
        initialLat != null &&
        initialLng != null &&
        Number.isFinite(initialLat) &&
        Number.isFinite(initialLng);

      if (hasSavedCoords) {
        setGeoState('idle');
        void fetchAddress(startLat, startLng);
      } else if (navigator.geolocation) {
        setGeoState('pending');
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setGeoState('ok');
            marker.setLatLng([lat, lng]);
            map.flyTo([lat, lng], 16, { duration: 0.6 });
            void fetchAddress(lat, lng);
          },
          () => {
            setGeoState('denied');
            void fetchAddress(startLat, startLng);
          },
          { enableHighAccuracy: true, maximumAge: 60_000, timeout: 14_000 },
        );
      } else {
        setGeoState('unsupported');
        void fetchAddress(startLat, startLng);
      }
    });

    return () => {
      cancelled = true;
      mapRef.current?.map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once per mount; start coords from key
  }, []);

  useEffect(() => {
    const m = mapRef.current;
    if (!m?.streetLayer || !m.satelliteLayer) return;
    if (satelliteMode) {
      if (m.map.hasLayer(m.streetLayer)) m.map.removeLayer(m.streetLayer);
      if (!m.map.hasLayer(m.satelliteLayer)) m.satelliteLayer.addTo(m.map);
    } else {
      if (m.map.hasLayer(m.satelliteLayer)) m.map.removeLayer(m.satelliteLayer);
      if (!m.map.hasLayer(m.streetLayer)) m.streetLayer.addTo(m.map);
    }
  }, [satelliteMode]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        {geoState === 'denied' && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
            Location access is off. Tap the map or drag the red pin to set your storefront.
          </p>
        )}
        {geoState === 'unsupported' && (
          <p className="text-xs text-slate-600 bg-slate-100 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
            Tap the map to place your store pin. Orange dots are other food partners on Vybe.
          </p>
        )}
        {geoState === 'pending' && <p className="text-xs text-slate-600">Finding your location…</p>}
        {hasGeolocationApi && (
          <button
            type="button"
            onClick={() => tryGeolocate()}
            disabled={geoState === 'pending'}
            className="text-sm font-semibold text-white px-3 py-2 rounded-button bg-primary shadow-soft shrink-0 min-h-[44px] hover:bg-accent-hover disabled:opacity-50"
          >
            {geoState === 'pending' ? 'Please wait…' : 'Use my current location'}
          </button>
        )}
      </div>

      {peerCount !== null && (
        <p className="text-xs text-slate-600">
          Orange markers: {peerCount} other food {peerCount === 1 ? 'restaurant' : 'restaurants'} on the map (reference only).
        </p>
      )}

      <div
        className="relative w-full rounded-card overflow-hidden bg-slate-100 border border-slate-200 shadow-inner"
        style={{ height: 360 }}
      >
        <div ref={containerRef} className="absolute inset-0 leaflet-container" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-[1000] pointer-events-none">
            <Loader size={44} />
          </div>
        )}
        {ready && (
          <div className="absolute top-2 right-2 z-[1000] flex rounded-lg overflow-hidden border border-white/80 shadow-md">
            <button
              type="button"
              onClick={() => setSatelliteMode(false)}
              className={`px-3 py-2 text-xs font-semibold min-h-[40px] transition-colors ${
                !satelliteMode ? 'bg-primary text-white' : 'bg-primary/20 text-white hover:bg-primary/30'
              }`}
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => setSatelliteMode(true)}
              className={`px-3 py-2 text-xs font-semibold min-h-[40px] transition-colors border-l border-white/50 ${
                satelliteMode ? 'bg-primary text-white' : 'bg-primary/20 text-white hover:bg-primary/30'
              }`}
            >
              Satellite
            </button>
          </div>
        )}
        {ready && (
          <p className="absolute bottom-2 left-2 right-2 text-center text-xs text-white bg-black/55 rounded py-2 px-2 z-[1000]">
            <span className="font-semibold">Purple pin</span> = your store. Drag it or tap the map. Use Satellite to align with your building.
          </p>
        )}
      </div>
    </div>
  );
}
