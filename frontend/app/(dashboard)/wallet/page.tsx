'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api from '@/services/api';

type WalletEntry = {
  id: string;
  entryType: 'CREDIT_REFERRAL' | 'DEBIT_ORDER';
  amount: number;
  note?: string | null;
  createdAt: string;
};

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [entries, setEntries] = useState<WalletEntry[]>([]);

  useEffect(() => {
    api
      .get<{ balance?: number; entries?: WalletEntry[] }>('/users/me/referral-wallet')
      .then((r) => {
        setBalance(Number(r.data?.balance ?? 0));
        setEntries(r.data?.entries ?? []);
      })
      .catch(() => {
        setBalance(0);
        setEntries([]);
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Wallet" backHref="/dashboard" />
      <ContentPanel>
      <main className="app-shell-narrow py-4">
        <Card className="text-center py-8 mb-6">
          <span className="block w-20 h-20 mx-auto mb-4 relative">
            <Image src="/wallet.png" alt="" width={80} height={80} className="object-contain mx-auto" />
          </span>
          <p className="text-4xl font-bold text-slate-800 mb-1">PKR {balance.toFixed(2)}</p>
          <p className="text-slate-600 text-sm mb-2">Referral discount balance</p>
          <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-medium mb-4">
            Non-cash credits only
          </span>
          <p className="text-slate-500 text-xs max-w-xs mx-auto mb-4">
            This wallet is for referral rewards only. Credits can be used as order discounts and cannot be withdrawn.
          </p>
          <Button variant="outline" size="lg" className="mt-2 min-h-[44px]" disabled>
            Cash withdrawal disabled
          </Button>
        </Card>
        <h2 className="text-lg font-bold text-slate-800 mb-3">Transaction history</h2>
        {entries.length === 0 ? (
          <Card className="py-12 text-center">
            <p className="text-slate-500 text-sm">No transactions yet</p>
            <p className="text-slate-400 text-xs mt-1">Referral reward credits and order debits will appear here</p>
          </Card>
        ) : (
          <Card className="space-y-2">
            {entries.map((entry) => {
              const isCredit = entry.entryType === 'CREDIT_REFERRAL';
              return (
                <div key={entry.id} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {isCredit ? 'Referral reward credited' : 'Used at checkout'}
                    </p>
                    <p className="text-xs text-slate-500">{entry.note ?? 'Referral wallet transaction'}</p>
                  </div>
                  <div className={`text-sm font-semibold ${isCredit ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {isCredit ? '+' : '-'} Rs {Number(entry.amount).toFixed(2)}
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </main>
      </ContentPanel>
    </div>
  );
}
