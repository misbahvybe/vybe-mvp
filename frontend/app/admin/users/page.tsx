'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import api from '@/services/api';

interface UserRow {
  id: string;
  name: string;
  phone: string;
  email?: string;
  isVerified: boolean;
  isActive: boolean;
  ordersCount: number;
  totalSpend: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<UserRow[]>('/admin/users').then((r) => setUsers(r.data ?? [])).catch(() => setUsers([])).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Users (Customers)</h1>
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
                  <th className="text-left p-3 font-medium">Phone</th>
                  <th className="text-left p-3 font-medium">Verified</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Orders</th>
                  <th className="text-right p-3 font-medium">Total Spend</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="p-3 font-medium">{u.name}</td>
                    <td className="p-3">{u.phone}</td>
                    <td className="p-3">{u.isVerified ? 'Yes' : 'No'}</td>
                    <td className="p-3">{u.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="p-3 text-right">{u.ordersCount}</td>
                    <td className="p-3 text-right">Rs {u.totalSpend.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {users.length === 0 && !loading && <p className="p-8 text-center text-slate-500">No users</p>}
      </Card>
    </div>
  );
}
