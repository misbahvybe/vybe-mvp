'use client';

import { Wallet } from 'lucide-react';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function WalletPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Wallet" backHref="/dashboard" />
      <ContentPanel>
      <main className="max-w-lg mx-auto px-4 py-4">
        <Card className="text-center py-8 mb-6">
          <Wallet className="w-12 h-12 text-primary mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-4xl font-bold text-slate-800 mb-1">PKR 0.00</p>
          <p className="text-slate-600 text-sm mb-2">Available balance</p>
          <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-medium mb-4">
            Binance wallet integration coming soon
          </span>
          <p className="text-slate-500 text-xs max-w-xs mx-auto mb-4">
            Pakistan&apos;s first regulated crypto payments. Use your Binance wallet everywhere on VYBE.
          </p>
          <Button variant="outline" size="lg" className="mt-2 min-h-[44px]" disabled>
            Add Money (Coming Soon)
          </Button>
        </Card>
        <h2 className="text-lg font-bold text-slate-800 mb-3">Transaction history</h2>
        <Card className="py-12 text-center">
          <p className="text-slate-500 text-sm">No transactions yet</p>
          <p className="text-slate-400 text-xs mt-1">Your transaction history will appear here</p>
        </Card>
      </main>
      </ContentPanel>
    </div>
  );
}
