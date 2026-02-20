'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

export default function SignupPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submitSignup = async () => {
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/signup', form);
      setStep('otp');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Signup failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { phone: form.phone, code: otp });
      setAuth(data.user, data.access_token);
      router.push('/dashboard');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Invalid OTP';
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
          <h1 className="text-xl font-bold text-slate-800 mb-1">Create account</h1>
          <p className="text-slate-600 text-sm mb-6">Sign up as customer. We&apos;ll send OTP to your WhatsApp.</p>
          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
          {step === 'form' ? (
            <>
              <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary outline-none mb-4"
              />
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary outline-none mb-4"
              />
              <label className="block text-sm font-medium text-slate-700 mb-2">WhatsApp Number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="03XXXXXXXXX"
                className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary outline-none mb-4"
              />
              <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary outline-none mb-4"
              />
              <label className="block text-sm font-medium text-slate-700 mb-2">Confirm Password</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary outline-none mb-6"
              />
              <Button fullWidth size="lg" loading={loading} onClick={submitSignup}>
                Continue
              </Button>
            </>
          ) : (
            <>
              <p className="text-slate-600 text-sm mb-2">Enter 6-digit code sent to {form.phone}</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full px-4 py-3 rounded-button border border-slate-300 text-center text-lg tracking-widest focus:ring-2 focus:ring-primary outline-none mb-4"
              />
              <Button fullWidth size="lg" loading={loading} onClick={verifyOtp}>
                Verify & Continue
              </Button>
              <button
                type="button"
                onClick={() => setStep('form')}
                className="mt-4 w-full text-sm text-primary"
              >
                Change number
              </button>
            </>
          )}
        </Card>
        <p className="mt-6 text-slate-600 text-sm">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-primary font-medium">Login</Link>
        </p>
      </div>
    </div>
  );
}
