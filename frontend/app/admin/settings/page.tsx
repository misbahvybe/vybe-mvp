'use client';

import { Card } from '@/components/ui/Card';

export default function AdminSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Settings</h1>
      <Card className="p-6 max-w-xl">
        <p className="text-slate-600 mb-4">Global platform configuration. Changes require backend update.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Commission %</label>
            <p className="text-lg font-semibold">15%</p>
            <p className="text-xs text-slate-500">Platform commission on restaurant orders</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Service Fee (PKR)</label>
            <p className="text-lg font-semibold">Rs 23.49</p>
            <p className="text-xs text-slate-500">Per order service fee</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Fee (PKR)</label>
            <p className="text-lg font-semibold">Rs 150</p>
            <p className="text-xs text-slate-500">Fixed delivery fee per order</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">OTP Expiry</label>
            <p className="text-lg font-semibold">3 minutes</p>
            <p className="text-xs text-slate-500">Configurable via OTP_EXPIRY_MINUTES</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Invite Expiry</label>
            <p className="text-lg font-semibold">24 hours</p>
            <p className="text-xs text-slate-500">Partner invite link validity</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Crypto Payments</label>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-1 bg-amber-100 text-amber-800 text-sm rounded">Coming Soon</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Binance wallet integration</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
