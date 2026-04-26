'use client';

import { useEffect, useState } from 'react';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api from '@/services/api';
import Link from 'next/link';

type MeResponse = { hasPassword?: boolean };

function pickApiMessage(e: unknown): string {
  const m = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(m) && m[0]) return String(m[0]);
  if (typeof m === 'string') return m;
  return 'Could not update password. Please try again.';
}

export default function PasswordPage() {
  const [loadingMe, setLoadingMe] = useState(true);
  const [hasPassword, setHasPassword] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingMe(true);
    api
      .get<MeResponse>('/users/me')
      .then((r) => {
        if (!cancelled) {
          const has = r.data?.hasPassword;
          if (has === false) setHasPassword(false);
          else setHasPassword(true);
        }
      })
      .catch(() => {
        if (!cancelled) setHasPassword(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingMe(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSubmitting(true);
    try {
      const body: {
        currentPassword?: string;
        newPassword: string;
        confirmNewPassword: string;
      } = {
        newPassword,
        confirmNewPassword: confirmPassword,
      };
      if (hasPassword) {
        body.currentPassword = currentPassword;
      }
      await api.patch('/users/me/password', body);
      setSuccess(true);
      setHasPassword(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: unknown) {
      setError(pickApiMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Password" backHref="/more" />
      <ContentPanel bottomPadding="sm">
        <main className="app-shell-narrow py-4 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Use a strong password you don&apos;t use on other sites. You&apos;ll stay signed in on this device until you log out.
          </p>

          {loadingMe ? (
            <Card>
              <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
            </Card>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <Card>
                {hasPassword ? (
                  <div>
                    <label htmlFor="cur-pw" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Current password
                    </label>
                    <input
                      id="cur-pw"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                      className="w-full px-4 py-3 rounded-button border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      required
                    />
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 mb-4">
                    Set a password for this account. You can use it together with your phone or email to sign in on a new device.
                  </p>
                )}

                <div className={hasPassword ? 'mt-4' : undefined}>
                  <label htmlFor="new-pw" className="block text-sm font-medium text-slate-700 mb-1.5">
                    New password
                  </label>
                  <input
                    id="new-pw"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    className="w-full px-4 py-3 rounded-button border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    required
                  />
                </div>

                <div className="mt-4">
                  <label htmlFor="conf-pw" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Confirm new password
                  </label>
                  <input
                    id="conf-pw"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    className="w-full px-4 py-3 rounded-button border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    required
                  />
                </div>

                <p className="text-xs text-slate-500 mt-3">
                  At least 8 characters, with uppercase, lowercase, and a number.
                </p>
              </Card>

              {error && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-button px-3 py-2" role="alert">
                  {error}
                </p>
              )}
              {success && (
                <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-button px-3 py-2" role="status">
                  Password updated successfully.
                </p>
              )}

              <Button type="submit" fullWidth size="lg" loading={submitting}>
                {hasPassword ? 'Update password' : 'Set password'}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-slate-500">
            <Link href="/auth/login" className="text-primary font-medium">
              Back to sign in
            </Link>
          </p>
        </main>
      </ContentPanel>
    </div>
  );
}
