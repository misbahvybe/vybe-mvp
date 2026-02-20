'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api from '@/services/api';

export default function CreatePartnerPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'RIDER' as 'RIDER' | 'STORE_OWNER', isActive: true });
  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/admin/partners', form);
      setInviteLink(res.data.inviteLink);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create partner';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
  };

  if (inviteLink) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Invite Sent</h1>
        <Card className="p-6 max-w-lg">
          <p className="text-green-600 font-medium mb-2">Partner created successfully</p>
          <p className="text-slate-600 text-sm mb-4">Send this link to the partner. It expires in 24 hours.</p>
          <div className="bg-slate-100 rounded-lg p-3 mb-4 break-all text-sm font-mono">{inviteLink}</div>
          <Button onClick={copyLink} variant="outline" fullWidth>Copy link</Button>
        </Card>
        <Link href="/admin/partners/new" className="inline-block mt-4">
          <Button variant="outline">Invite another</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Invite Partner</h1>
      <Card className="p-6 max-w-lg">
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary outline-none mb-4"
              required
            />
            <label className="block text-sm font-medium text-slate-700 mb-2">Email (required)</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary outline-none mb-4"
              required
            />
            <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="03000000000"
              className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary outline-none mb-4"
              required
            />
            <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'RIDER' | 'STORE_OWNER' }))}
              className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary outline-none mb-4"
            >
              <option value="RIDER">Rider</option>
              <option value="STORE_OWNER">Store Owner</option>
            </select>
            <label className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="rounded border-slate-300 text-primary"
              />
              <span className="text-sm text-slate-700">Active</span>
            </label>
            {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
            <Button type="submit" fullWidth size="lg" loading={loading}>
              Create & Get Invite Link
            </Button>
          </form>
        </Card>
    </div>
  );
}
