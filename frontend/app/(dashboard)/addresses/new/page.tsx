'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api from '@/services/api';

const AddressMapPicker = dynamic(
  () => import('@/components/map/AddressMapPicker').then((m) => m.AddressMapPicker),
  { ssr: false }
);

export default function NewAddressPage() {
  const router = useRouter();
  const [label, setLabel] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('Lahore');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleMapSelect = useCallback((line: string, c: string, latitude: number, longitude: number) => {
    setAddressLine(line);
    setCity(c);
    setLat(latitude);
    setLng(longitude);
  }, []);

  const submit = async () => {
    if (!addressLine.trim()) {
      setError('Select a location on the map first');
      return;
    }
    if (lat == null || lng == null) {
      setError('Select a location on the map');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/users/me/addresses', {
        label: label || undefined,
        fullAddress: addressLine.trim(),
        city: city || 'Lahore',
        latitude: lat,
        longitude: lng,
        isDefault,
      });
      router.push('/addresses');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save address';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Add Address" backHref="/addresses" />
      <ContentPanel>
      <main className="max-w-lg mx-auto px-4 py-4">
        <Card className="mb-4">
          <AddressMapPicker onSelect={handleMapSelect} />
        </Card>
        {addressLine && (
          <Card className="mb-4">
            <p className="text-sm font-medium text-slate-700 mb-1">Preview</p>
            <p className="text-slate-800">{addressLine}</p>
            <p className="text-slate-500 text-sm mt-1">{city}</p>
          </Card>
        )}
        <Card>
          <label className="block text-sm font-medium text-slate-700 mb-2">Label (e.g. Home, Office)</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Home 01"
            className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary outline-none mb-4"
          />
          <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
          <input
            type="text"
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            placeholder="From map"
            className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary outline-none mb-4"
          />
          <label className="block text-sm font-medium text-slate-700 mb-2">City</label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary outline-none mb-4"
          />
          <label className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-slate-700">Set as default address</span>
          </label>
          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
          <Button fullWidth size="lg" loading={loading} onClick={submit}>
            Save Address
          </Button>
        </Card>
      </main>
      </ContentPanel>
    </div>
  );
}
