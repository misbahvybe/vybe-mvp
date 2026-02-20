'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { reverseGeocode } from '@/services/geoapify';

const LAHORE_CENTER = { lat: 31.5204, lng: 74.3587 };

interface AddressMapPickerProps {
  onSelect: (addressLine: string, city: string, lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}

export function AddressMapPicker({
  onSelect,
  initialLat = LAHORE_CENTER.lat,
  initialLng = LAHORE_CENTER.lng,
}: AddressMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const mapRef = useRef<{ map: L.Map; marker: L.Marker } | null>(null);

  const fetchAddress = useCallback(
    async (latitude: number, longitude: number) => {
      setLoading(true);
      const result = await reverseGeocode(latitude, longitude);
      setLoading(false);
      if (result) {
        setLat(result.lat);
        setLng(result.lng);
        onSelect(result.addressLine, result.city, result.lat, result.lng);
      }
    },
    [onSelect]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;
    import('leaflet').then((L) => {
      const map = L.map(containerRef.current!).setView([initialLat, initialLng], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);
      const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        fetchAddress(pos.lat, pos.lng);
      });
      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        fetchAddress(e.latlng.lat, e.latlng.lng);
      });
      mapRef.current = { map, marker };
      setReady(true);
    });
    return () => {
      mapRef.current?.map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-full rounded-card overflow-hidden bg-slate-100" style={{ height: 280 }}>
      <div ref={containerRef} className="absolute inset-0 leaflet-container" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-[1000]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {ready && (
        <p className="absolute bottom-2 left-2 right-2 text-center text-xs text-white bg-black/50 rounded py-1 z-[1000]">
          Tap map to set pin or drag marker
        </p>
      )}
    </div>
  );
}
