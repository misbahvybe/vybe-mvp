'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import api from '@/services/api';

const NEW_USER_MS = 24 * 60 * 60 * 1000;

function isUserNew(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() < NEW_USER_MS;
}

interface UserRow {
  id: string;
  name: string;
  phone: string;
  email?: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  ordersCount: number;
  totalSpend: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (sort === 'oldest') params.set('sort', 'oldest');
    const q = debouncedSearch.trim();
    if (q) params.set('q', q);
    const qs = params.toString();
    const url = `/admin/users${qs ? `?${qs}` : ''}`;
    api
      .get<UserRow[]>(url)
      .then((r) => setUsers(r.data ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [sort, debouncedSearch]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Users (Customers)</h1>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="block flex-1 min-w-[200px]">
          <span className="text-sm text-slate-600 mb-1 block">Search</span>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Name, phone, or email"
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block w-full sm:w-48">
          <span className="text-sm text-slate-600 mb-1 block">Sort by signup</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'newest' | 'oldest')}
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader size={44} className="mx-auto" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 font-medium w-12">#</th>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Phone</th>
                  <th className="text-left p-3 font-medium">Verified</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Orders</th>
                  <th className="text-right p-3 font-medium">Total Spend</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="p-3 text-slate-500 tabular-nums">{i + 1}</td>
                    <td className="p-3 font-medium">
                      <span className="align-middle">{u.name}</span>
                      {u.createdAt && isUserNew(u.createdAt) && (
                        <span className="ml-2 inline-block align-middle rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          New
                        </span>
                      )}
                    </td>
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
