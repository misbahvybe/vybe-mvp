'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api from '@/services/api';

interface PlatformCommission {
  id: string;
  categorySlug: string;
  commissionPercent: string | number;
}

interface StoreRow {
  id: string;
  name: string;
  commissionPercentOverride: number | null;
}

type CheckoutServiceFeeMode = 'FIXED' | 'PERCENT';

interface PlatformCheckoutSettings {
  id: string;
  serviceFeeMode: CheckoutServiceFeeMode;
  serviceFeeFixed: string | number;
  serviceFeePercent: string | number;
  codTaxPercent: string | number;
}

export default function AdminPricingPage() {
  const [platform, setPlatform] = useState<PlatformCommission[]>([]);
  const [platformEdits, setPlatformEdits] = useState<Record<string, string>>({});
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [storeEdits, setStoreEdits] = useState<Record<string, string>>({});
  const [newSlug, setNewSlug] = useState('');
  const [newPercent, setNewPercent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [checkoutSettings, setCheckoutSettings] = useState<PlatformCheckoutSettings | null>(null);
  const [checkoutDraft, setCheckoutDraft] = useState({
    serviceFeeMode: 'FIXED' as CheckoutServiceFeeMode,
    serviceFeeFixed: '',
    serviceFeePercent: '',
    codTaxPercent: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const [pc, st, co] = await Promise.all([
        api.get<PlatformCommission[]>('/admin/pricing/platform-category-commissions'),
        api.get<StoreRow[]>('/admin/stores'),
        api
          .get<PlatformCheckoutSettings>('/admin/pricing/checkout-settings')
          .catch(() => ({ data: null as PlatformCheckoutSettings | null })),
      ]);
      const list = pc.data ?? [];
      setPlatform(list);
      const edits: Record<string, string> = {};
      for (const row of list) {
        edits[row.categorySlug] = String(row.commissionPercent);
      }
      setPlatformEdits(edits);
      const slist = st.data ?? [];
      setStores(slist);
      const sedits: Record<string, string> = {};
      for (const s of slist) {
        sedits[s.id] =
          s.commissionPercentOverride != null ? String(s.commissionPercentOverride) : '';
      }
      setStoreEdits(sedits);
      const cs = co.data;
      if (cs) {
        setCheckoutSettings(cs);
        setCheckoutDraft({
          serviceFeeMode: cs.serviceFeeMode,
          serviceFeeFixed: String(cs.serviceFeeFixed),
          serviceFeePercent: String(cs.serviceFeePercent),
          codTaxPercent: String(cs.codTaxPercent),
        });
      }
    } catch {
      setMessage('Failed to load pricing data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const savePlatformSlug = async (slug: string) => {
    const raw = platformEdits[slug]?.trim();
    const n = raw === '' ? NaN : Number(raw);
    if (Number.isNaN(n) || n < 0 || n > 100) {
      setMessage('Commission must be between 0 and 100.');
      return;
    }
    setSaving(`pc:${slug}`);
    setMessage('');
    try {
      await api.patch(`/admin/pricing/platform-category-commissions/${encodeURIComponent(slug)}`, {
        commissionPercent: n,
      });
      setMessage(`Saved ${slug} → ${n}%`);
      await load();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Save failed';
      setMessage(String(msg));
    } finally {
      setSaving(null);
    }
  };

  const addPlatformRule = async () => {
    const slug = newSlug.trim().toLowerCase();
    const n = Number(newPercent);
    if (!/^[a-z0-9_-]+$/.test(slug)) {
      setMessage('Slug: lowercase letters, numbers, hyphen, underscore only.');
      return;
    }
    if (Number.isNaN(n) || n < 0 || n > 100) {
      setMessage('Percent must be 0–100.');
      return;
    }
    setSaving('pc:new');
    setMessage('');
    try {
      await api.patch(`/admin/pricing/platform-category-commissions/${encodeURIComponent(slug)}`, {
        commissionPercent: n,
      });
      setNewSlug('');
      setNewPercent('');
      setMessage(`Added ${slug} → ${n}%`);
      await load();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Save failed';
      setMessage(String(msg));
    } finally {
      setSaving(null);
    }
  };

  const saveCheckoutSettings = async () => {
    const fixed = Number(checkoutDraft.serviceFeeFixed);
    const pct = Number(checkoutDraft.serviceFeePercent);
    const cod = Number(checkoutDraft.codTaxPercent);
    if (checkoutDraft.serviceFeeMode === 'FIXED' && (Number.isNaN(fixed) || fixed < 0)) {
      setMessage('Service fee (fixed) must be a number ≥ 0.');
      return;
    }
    if (checkoutDraft.serviceFeeMode === 'PERCENT' && (Number.isNaN(pct) || pct < 0 || pct > 100)) {
      setMessage('Service fee (percent) must be between 0 and 100.');
      return;
    }
    if (Number.isNaN(cod) || cod < 0 || cod > 100) {
      setMessage('COD tax must be between 0 and 100 (%).');
      return;
    }
    setSaving('checkout');
    setMessage('');
    try {
      await api.patch('/admin/pricing/checkout-settings', {
        serviceFeeMode: checkoutDraft.serviceFeeMode,
        serviceFeeFixed: fixed,
        serviceFeePercent: pct,
        codTaxPercent: cod,
      });
      setMessage('Checkout fees saved.');
      await load();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Save failed';
      setMessage(String(msg));
    } finally {
      setSaving(null);
    }
  };

  const saveStoreCommission = async (storeId: string) => {
    const raw = storeEdits[storeId]?.trim();
    let body: { commissionPercentOverride: number | null };
    if (raw === '') {
      body = { commissionPercentOverride: null };
    } else {
      const n = Number(raw);
      if (Number.isNaN(n) || n < 0 || n > 100) {
        setMessage('Leave empty for category default, or enter a commission between 0 and 100.');
        return;
      }
      body = { commissionPercentOverride: n };
    }
    setSaving(`st:${storeId}`);
    setMessage('');
    try {
      await api.patch(`/admin/stores/${storeId}/commission-override`, body);
      setMessage('Store commission updated.');
      await load();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Save failed';
      setMessage(String(msg));
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Pricing &amp; commission</h1>
      <p className="text-sm text-slate-600 mb-4">
        Platform commission by store category (slug matches{' '}
        <code className="bg-slate-100 px-1 rounded">StoreCategory.name</code> in lowercase). A
        custom rate for a store replaces the category default for that store only.
      </p>
      {message && (
        <p className="text-sm mb-4 text-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
          {message}
        </p>
      )}

      <h2 className="text-lg font-semibold text-slate-800 mb-2">Customer checkout (service fee &amp; COD tax)</h2>
      <Card className="p-4 mb-6">
        <p className="text-sm text-slate-600 mb-4">
          Service fee is added before COD tax. Tax applies to <strong>subtotal + delivery + service fee</strong>.
          Delivery per-km still uses server environment settings.
        </p>
        {checkoutSettings ? (
          <div className="space-y-4 max-w-lg">
            <div>
              <span className="block text-xs font-medium text-slate-600 mb-2">Service fee type</span>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="sfmode"
                    checked={checkoutDraft.serviceFeeMode === 'FIXED'}
                    onChange={() => setCheckoutDraft((d) => ({ ...d, serviceFeeMode: 'FIXED' }))}
                    className="rounded-full border-slate-300"
                  />
                  Fixed amount (PKR)
                </label>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="sfmode"
                    checked={checkoutDraft.serviceFeeMode === 'PERCENT'}
                    onChange={() => setCheckoutDraft((d) => ({ ...d, serviceFeeMode: 'PERCENT' }))}
                    className="rounded-full border-slate-300"
                  />
                  Percent of (subtotal + delivery)
                </label>
              </div>
            </div>
            {checkoutDraft.serviceFeeMode === 'FIXED' ? (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fixed service fee (PKR)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full max-w-xs px-2 py-1.5 border border-slate-300 rounded-lg"
                  value={checkoutDraft.serviceFeeFixed}
                  onChange={(e) => setCheckoutDraft((d) => ({ ...d, serviceFeeFixed: e.target.value }))}
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Service fee (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  className="w-full max-w-xs px-2 py-1.5 border border-slate-300 rounded-lg"
                  value={checkoutDraft.serviceFeePercent}
                  onChange={(e) => setCheckoutDraft((d) => ({ ...d, serviceFeePercent: e.target.value }))}
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">COD tax (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                className="w-full max-w-xs px-2 py-1.5 border border-slate-300 rounded-lg"
                value={checkoutDraft.codTaxPercent}
                onChange={(e) => setCheckoutDraft((d) => ({ ...d, codTaxPercent: e.target.value }))}
              />
              <p className="text-xs text-slate-500 mt-1">Default after migration: 16%. Set to 0 to disable COD surcharge.</p>
            </div>
            <Button type="button" size="sm" loading={saving === 'checkout'} onClick={saveCheckoutSettings}>
              Save checkout settings
            </Button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Could not load checkout settings.</p>
        )}
      </Card>

      <h2 className="text-lg font-semibold text-slate-800 mb-2">Category defaults</h2>
      <Card className="overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3 font-medium">Category slug</th>
                <th className="text-left p-3 font-medium w-40">Commission %</th>
                <th className="text-right p-3 font-medium w-28">Action</th>
              </tr>
            </thead>
            <tbody>
              {platform.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="p-3 font-mono text-slate-800">{row.categorySlug}</td>
                  <td className="p-3">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                      value={platformEdits[row.categorySlug] ?? ''}
                      onChange={(e) =>
                        setPlatformEdits((prev) => ({
                          ...prev,
                          [row.categorySlug]: e.target.value,
                        }))
                      }
                    />
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={saving === `pc:${row.categorySlug}`}
                      onClick={() => savePlatformSlug(row.categorySlug)}
                    >
                      Save
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {platform.length === 0 && (
          <p className="p-4 text-slate-500 text-sm">No platform rules yet. Add one below.</p>
        )}
        <div className="p-4 border-t border-slate-100 flex flex-wrap gap-2 items-end bg-slate-50/80">
          <div>
            <label className="block text-xs text-slate-500 mb-1">New slug</label>
            <input
              type="text"
              placeholder="e.g. bakery"
              className="px-2 py-1.5 border border-slate-300 rounded-lg w-40 font-mono text-sm"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">%</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              className="px-2 py-1.5 border border-slate-300 rounded-lg w-24"
              value={newPercent}
              onChange={(e) => setNewPercent(e.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            loading={saving === 'pc:new'}
            onClick={addPlatformRule}
          >
            Add / upsert
          </Button>
        </div>
      </Card>

      <h2 className="text-lg font-semibold text-slate-800 mb-2">Per-store commission</h2>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3 font-medium">Store</th>
                <th className="text-left p-3 font-medium w-44">Custom % (this store)</th>
                <th className="text-left p-3 font-medium text-slate-500">Leave empty = category default</th>
                <th className="text-right p-3 font-medium w-36">Action</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      placeholder="—"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                      value={storeEdits[s.id] ?? ''}
                      onChange={(e) =>
                        setStoreEdits((prev) => ({ ...prev, [s.id]: e.target.value }))
                      }
                    />
                  </td>
                  <td className="p-3 text-slate-500 text-xs">
                    {s.commissionPercentOverride != null
                      ? `Using custom rate: ${s.commissionPercentOverride}%`
                      : 'Using category default'}
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={saving === `st:${s.id}`}
                      onClick={() => saveStoreCommission(s.id)}
                    >
                      Save
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {stores.length === 0 && (
          <p className="p-4 text-slate-500 text-sm">No approved stores.</p>
        )}
      </Card>
    </div>
  );
}
