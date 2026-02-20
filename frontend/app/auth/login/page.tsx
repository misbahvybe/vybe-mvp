'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', {
        emailOrPhone: emailOrPhone.trim(),
        password,
      });
      setAuth(data.user, data.access_token);
      const role = data.user?.role;
      if (role === 'RIDER') router.push('/rider/dashboard');
      else if (role === 'STORE_OWNER') router.push('/store/dashboard');
      else if (role === 'ADMIN') router.push('/admin');
      else router.push('/dashboard');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Invalid email/phone or password';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-primary-dark">
      <header className="p-4">
        <Link href="/" className="text-white font-medium">← Back</Link>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 bg-surface rounded-t-3xl">
        <Card className="w-full max-w-sm">
          <h1 className="text-xl font-bold text-slate-800 mb-1">Login</h1>
          <p className="text-slate-600 text-sm mb-6">Enter your email or phone and password</p>
          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
          <form onSubmit={handleLogin}>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email or phone</label>
            <input
              type="text"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              placeholder="admin@vybe.pk or 03000000000"
              className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4"
              required
              autoComplete="username"
            />
            <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-4"
              required
              minLength={6}
              autoComplete="current-password"
            />
            <Button type="submit" fullWidth size="lg" loading={loading}>
              Login
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-600">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-primary font-medium">Sign up</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
