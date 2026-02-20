'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import api from '@/services/api';

interface Partner {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isActive: boolean;
  passwordSet: boolean;
  createdAt: string;
  invitationExpiresAt?: string | null;
}

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Partner[]>('/admin/partners').then((r) => setPartners(r.data ?? [])).catch(() => setPartners([])).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Partners</h1>
      <div className="flex justify-between items-center mb-4">
        <p className="text-slate-600">Riders & Store owners</p>
        <Link href="/admin/partners/new">
          <Button size="sm">+ Create Invite</Button>
        </Link>
      </div>
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Role</th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Phone</th>
                  <th className="text-left p-3 font-medium">Active</th>
                  <th className="text-left p-3 font-medium">Password Set</th>
                  <th className="text-left p-3 font-medium">Invite Expiry</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3">{p.role}</td>
                    <td className="p-3">{p.email}</td>
                    <td className="p-3">{p.phone}</td>
                    <td className="p-3">
                      <span className={p.isActive ? 'text-green-600' : 'text-red-600'}>{p.isActive ? 'Yes' : 'No'}</span>
                    </td>
                    <td className="p-3">
                      <span className={p.passwordSet ? 'text-green-600' : 'text-amber-600'}>{p.passwordSet ? 'Yes' : 'Pending'}</span>
                    </td>
                    <td className="p-3">{p.invitationExpiresAt ? new Date(p.invitationExpiresAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {partners.length === 0 && !loading && <p className="p-8 text-center text-slate-500">No partners yet</p>}
      </Card>
    </div>
  );
}
