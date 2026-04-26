'use client';

import { useCallback, useEffect, useState } from 'react';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import api from '@/services/api';
import type { User } from '@/types';

type MeResponse = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  role: string;
  isVerified?: boolean;
  passwordSet?: boolean;
  createdAt?: string;
};

function pickApiMessage(e: unknown): string {
  const m = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(m) && m[0]) return String(m[0]);
  if (typeof m === 'string') return m;
  return 'Something went wrong. Please try again.';
}

export default function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const applyMe = useCallback(
    (me: MeResponse) => {
      setName(me.name ?? '');
      setEmail(me.email ?? '');
      setCreatedAt(me.createdAt ?? null);
      setVerified(Boolean(me.isVerified));
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .get<MeResponse>('/users/me')
      .then((r) => {
        if (cancelled || !r.data) return;
        applyMe(r.data);
        const tok = useAuthStore.getState().token;
        if (r.data && tok) {
          setAuth(
            {
              id: r.data.id,
              name: r.data.name,
              email: r.data.email,
              phone: r.data.phone,
              role: r.data.role as User['role'],
              passwordSet: r.data.passwordSet,
              isVerified: r.data.isVerified,
            },
            tok
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          const u = useAuthStore.getState().user;
          if (u) {
            setName(u.name);
            setEmail(u.email ?? '');
          }
          setError('Could not refresh profile. Showing saved details.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyMe, setAuth]);

  const memberSince = createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : null;

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSaving(true);
    try {
      const { data } = await api.patch<User & { passwordSet?: boolean; isVerified?: boolean }>('/users/me', {
        name: name.trim(),
        email: email.trim() || null,
      });
      if (token) {
        setAuth(
          {
            id: data.id,
            name: data.name,
            email: data.email,
            phone: data.phone,
            role: data.role,
            passwordSet: data.passwordSet,
            isVerified: data.isVerified,
          },
          token
        );
      }
      setVerified(Boolean(data.isVerified));
      setSuccess(true);
    } catch (e: unknown) {
      setError(pickApiMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const initial = (name || user?.name || '?').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Account information" backHref="/more" />
      <ContentPanel bottomPadding="sm">
        <main className="app-shell-narrow py-4 space-y-4">
          {loading && (
            <Card className="animate-pulse">
              <div className="h-24 bg-slate-100 rounded-xl" />
            </Card>
          )}

          {!loading && (
            <>
              <Card className="overflow-hidden border-0 shadow-md bg-gradient-to-br from-slate-800 to-slate-900 text-white">
                <div className="px-4 py-6 flex items-center gap-4">
                  <div
                    className="h-16 w-16 rounded-2xl bg-white/15 flex items-center justify-center text-2xl font-semibold ring-2 ring-white/20"
                    aria-hidden
                  >
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold truncate">{name || user?.name || '—'}</h2>
                    <p className="text-sm text-slate-300 truncate">{user?.phone}</p>
                    {memberSince && (
                      <p className="text-xs text-slate-400 mt-1">Member since {memberSince}</p>
                    )}
                    <div className="mt-2">
                      {verified ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-200">
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-200">
                          Not verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              {error && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-button px-3 py-2" role="alert">
                  {error}
                </p>
              )}

              <form onSubmit={onSave} className="space-y-4">
                <Card>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Edit details</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="acc-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                        Full name
                      </label>
                      <input
                        id="acc-name"
                        name="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                        className="w-full px-4 py-3 rounded-button border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                        minLength={2}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="acc-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                        Email
                      </label>
                      <input
                        id="acc-email"
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        inputMode="email"
                        className="w-full px-4 py-3 rounded-button border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                        placeholder="you@example.com"
                      />
                      <p className="text-xs text-slate-500 mt-1.5">Order updates and receipts are sent here when provided.</p>
                    </div>
                    <div>
                      <p className="block text-sm font-medium text-slate-700 mb-1.5">Phone number</p>
                      <p className="w-full px-4 py-3 rounded-button border border-slate-100 bg-slate-50 text-slate-600 text-sm">
                        {user?.phone ?? '—'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1.5">Phone is your login ID. To change it, contact VYBE support.</p>
                    </div>
                  </div>
                </Card>

                {success && (
                  <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-button px-3 py-2" role="status">
                    Your profile was updated.
                  </p>
                )}

                <Button type="submit" fullWidth size="lg" loading={saving}>
                  Save changes
                </Button>
              </form>
            </>
          )}
        </main>
      </ContentPanel>
    </div>
  );
}
