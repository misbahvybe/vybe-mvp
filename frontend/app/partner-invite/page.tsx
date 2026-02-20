'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';

export default function PartnerInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    api
      .post('/auth/validate-invite', { token })
      .then((res) => {
        if (res.data.valid) {
          setStatus('valid');
          setUserName(res.data.name || '');
        } else {
          setStatus('invalid');
        }
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      setError('Password must contain uppercase, lowercase, and number');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/set-password', {
        token,
        password,
        confirmPassword,
      });
      setAuth(data.user, data.access_token);
      if (data.user.role === 'RIDER') router.push('/rider/dashboard');
      else if (data.user.role === 'STORE_OWNER') router.push('/store/dashboard');
      else router.push('/');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to set password';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-primary-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-primary-dark flex flex-col items-center justify-center px-6">
        <Card className="max-w-sm w-full text-center py-8">
          <h1 className="text-xl font-bold text-slate-800 mb-2">Invalid or Expired</h1>
          <p className="text-slate-600 text-sm mb-6">
            This invitation link is invalid or expired. Please contact admin.
          </p>
          <Link href="/">
            <Button variant="outline" size="lg">Back to Home</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-dark flex flex-col items-center justify-center px-6">
      <Card className="max-w-sm w-full">
        <h1 className="text-xl font-bold text-slate-800 mb-1">Set Your Password</h1>
        <p className="text-slate-600 text-sm mb-6">Welcome, {userName}. Create a secure password to complete your account setup.</p>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700 mb-2">New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 chars, uppercase, lowercase, number"
            className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary outline-none mb-4"
            required
            minLength={8}
          />
          <label className="block text-sm font-medium text-slate-700 mb-2">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary outline-none mb-4"
            required
          />
          <Button type="submit" fullWidth size="lg" loading={loading}>
            Set Password & Continue
          </Button>
        </form>
      </Card>
    </div>
  );
}
