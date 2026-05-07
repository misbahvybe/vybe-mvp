'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { GalleryImageInput } from '@/components/ui/GalleryImageInput';
import api from '@/services/api';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

type StoreProfileForAdmin = {
  id: string;
  name: string;
  imageUrl?: string | null;
  minimumOrderValue?: number;
};

export default function AdminStoreSettingsPage() {
  const params = useParams();
  const storeId = params?.storeId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [store, setStore] = useState<StoreProfileForAdmin | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    setErr(null);
    api
      .get<StoreProfileForAdmin>(`/admin/stores/${storeId}/profile`)
      .then((r) => {
        const s = r.data;
        setStore(s ?? null);
        setImageUrl((s?.imageUrl ?? '') as string);
      })
      .catch((e) => {
        setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to load store settings');
        setStore(null);
      })
      .finally(() => setLoading(false));
  }, [storeId]);

  const save = async () => {
    setSaving(true);
    setSuccessMsg(null);
    try {
      const trimmed = imageUrl.trim();
      // Sending `''` clears the store image (customer UI falls back to placeholders when falsy).
      const payload = trimmed ? { imageUrl: trimmed } : { imageUrl: '' };

      await api.patch(`/admin/stores/${storeId}/profile`, payload);

      setSuccessMsg('Saved');
      setStore((prev) =>
        prev
          ? {
              ...prev,
              imageUrl: trimmed ? trimmed : '',
            }
          : prev,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/admin/stores" className="text-primary inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">
            Store Settings {store?.name ? <span className="text-slate-500 text-base">- {store.name}</span> : null}
          </h1>
        </div>
      </div>

      <Card className="p-5">
        {loading ? (
          <div className="p-8 text-center">
            <Loader size={44} className="mx-auto" />
          </div>
        ) : err ? (
          <p className="text-sm text-red-600">{err}</p>
        ) : (
          <div className="max-w-2xl space-y-4">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-800">Store image</h2>
              <p className="text-sm text-slate-500">This image will be shown on customer store cards.</p>
            </div>

            <GalleryImageInput value={imageUrl} onChange={setImageUrl} idPrefix="store-image" />

            <div className="flex items-center justify-end gap-3 pt-2">
              {successMsg ? <span className="text-sm text-green-700">{successMsg}</span> : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={save}
                loading={saving}
                disabled={saving}
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

