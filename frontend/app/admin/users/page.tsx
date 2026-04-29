'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import api from '@/services/api';
import { getApiErrorMessage } from '@/lib/apiError';

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
  isOrderingBlocked?: boolean;
  orderStrikeCount?: number;
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
  const [unblockId, setUnblockId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (sort === 'oldest') params.set('sort', 'oldest');
    // Explicit default helps some caches always treat the request the same; backend defaults to newest.
    if (sort === 'newest') params.set('sort', 'newest');
    const q = debouncedSearch.trim();
    if (q) params.set('q', q);
    const qs = params.toString();
    const url = `/admin/users${qs ? `?${qs}` : ''}`;
    api
      .get<UserRow[]>(url)
      .then((r) => setUsers(Array.isArray(r.data) ? r.data : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [sort, debouncedSearch]);

  /** Always show newest-on-top (or matching sort) even if the API is an older build or cached. */
  const displayUsers = useMemo(() => {
    const list = users.slice();
    list.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      if (ta !== tb) return sort === 'newest' ? tb - ta : ta - tb;
      return sort === 'newest' ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id);
    });
    return list;
  }, [users, sort]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Users (Customers)</h1>
      {banner && (
        <p
          className={`mb-3 text-sm rounded-lg px-3 py-2 ${
            banner.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {banner.text}
        </p>
      )}
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
                  <th className="text-left p-3 font-medium whitespace-nowrap">Signed up</th>
                  <th className="text-left p-3 font-medium">Verified</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Ordering</th>
                  <th className="text-right p-3 font-medium whitespace-nowrap">Strikes</th>
                  <th className="text-right p-3 font-medium">Orders</th>
                  <th className="text-right p-3 font-medium">Total Spend</th>
                  <th className="text-left p-3 font-medium w-36">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayUsers.map((u, i) => (
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
                    <td className="p-3 text-slate-600 text-xs sm:text-sm whitespace-nowrap" title={u.createdAt}>
                      {u.createdAt
                        ? new Date(u.createdAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </td>
                    <td className="p-3">{u.isVerified ? 'Yes' : 'No'}</td>
                    <td className="p-3">{u.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="p-3">
                      {u.isOrderingBlocked ? (
                        <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                          Blocked
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">OK</span>
                      )}
                    </td>
                    <td className="p-3 text-right tabular-nums text-slate-600">{u.orderStrikeCount ?? 0}</td>
                    <td className="p-3 text-right">{u.ordersCount}</td>
                    <td className="p-3 text-right">Rs {u.totalSpend.toLocaleString()}</td>
                    <td className="p-3">
                      {u.isOrderingBlocked ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          loading={unblockId === u.id}
                          disabled={unblockId != null && unblockId !== u.id}
                          className="text-xs"
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Unblock ordering for ${u.name}? This resets strike count so they can place orders again.`,
                              )
                            ) {
                              return;
                            }
                            setBanner(null);
                            setUnblockId(u.id);
                            try {
                              await api.patch(`/admin/users/${u.id}/unblock-ordering`);
                              setBanner({ type: 'ok', text: `Ordering unblocked for ${u.name}.` });
                              setUsers((prev) =>
                                prev.map((row) =>
                                  row.id === u.id
                                    ? { ...row, isOrderingBlocked: false, orderStrikeCount: 0 }
                                    : row,
                                ),
                              );
                            } catch (e: unknown) {
                              setBanner({ type: 'err', text: getApiErrorMessage(e, 'Unblock failed') });
                            } finally {
                              setUnblockId(null);
                            }
                          }}
                        >
                          Unblock ordering
                        </Button>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
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
