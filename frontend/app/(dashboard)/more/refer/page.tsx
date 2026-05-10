'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api from '@/services/api';

const DEFAULT_SHARE_URL = 'https://vybepk.com';

export default function ReferPage() {
  const [copied, setCopied] = useState(false);
  const [loadingReferral, setLoadingReferral] = useState(true);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [completedReferrals, setCompletedReferrals] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const shareUrl = useMemo(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return process.env.NEXT_PUBLIC_APP_URL || DEFAULT_SHARE_URL;
  }, []);

  useEffect(() => {
    setLoadingReferral(true);
    api
      .get<{
        referralCode?: string | null;
        totalReferrals?: number;
        completedReferrals?: number;
        rewardWalletBalance?: number;
      }>('/users/me/referrals')
      .then((r) => {
        setReferralCode(r.data?.referralCode ?? null);
        setTotalReferrals(Number(r.data?.totalReferrals ?? 0));
        setCompletedReferrals(Number(r.data?.completedReferrals ?? 0));
        setWalletBalance(Number(r.data?.rewardWalletBalance ?? 0));
      })
      .catch(() => {
        setReferralCode(null);
        setTotalReferrals(0);
        setCompletedReferrals(0);
        setWalletBalance(0);
      })
      .finally(() => setLoadingReferral(false));
  }, []);

  const shareText = referralCode
    ? `Join VYBE with my referral code ${referralCode} and get started with fast delivery.`
    : 'Order groceries, pharmacy, and more on VYBE — one app, delivered fast.';
  const referralShareUrl = referralCode ? `${shareUrl}?ref=${encodeURIComponent(referralCode)}` : shareUrl;

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(referralCode ? referralCode : referralShareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [referralCode, referralShareUrl]);

  const onShare = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'VYBE', text: shareText, url: referralShareUrl });
      } catch {
        // user cancelled or share failed
      }
    } else {
      void copy();
    }
  }, [copy, shareText, referralShareUrl]);

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Invite friends" backHref="/more" />
      <ContentPanel bottomPadding="sm">
        <main className="app-shell-narrow py-4 space-y-4">
          <div className="text-center space-y-2">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-2xl" aria-hidden>
              🎁
            </div>
            <h1 className="text-xl font-bold text-slate-900">Share VYBE</h1>
            <p className="text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
              Share your code. When your friend completes their first order, you receive non-cash discount credit.
            </p>
          </div>

          <Card>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Referral code</p>
            <p className="text-sm break-all text-slate-800 font-mono bg-slate-50 rounded-button px-3 py-2.5 border border-slate-100">
              {loadingReferral ? 'Loading...' : (referralCode ?? 'Code unavailable')}
            </p>
            <p className="text-xs text-slate-500 mt-2">Share link: {referralShareUrl}</p>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <Button type="button" fullWidth onClick={copy} variant="outline" size="md">
                {copied ? 'Copied!' : referralCode ? 'Copy code' : 'Copy link'}
              </Button>
              <Button type="button" fullWidth onClick={onShare} size="md">
                Share
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              &quot;Share&quot; uses your device&apos;s menu when available; otherwise the link is copied.
            </p>
          </Card>

          <Card className="bg-slate-50/80 border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800 mb-2">Your referral dashboard</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-white border border-slate-200 p-2">
                <p className="text-slate-500 text-xs">Total referrals</p>
                <p className="font-semibold text-slate-900">{totalReferrals}</p>
              </div>
              <div className="rounded-md bg-white border border-slate-200 p-2">
                <p className="text-slate-500 text-xs">Completed first orders</p>
                <p className="font-semibold text-slate-900">{completedReferrals}</p>
              </div>
              <div className="rounded-md bg-white border border-slate-200 p-2 col-span-2">
                <p className="text-slate-500 text-xs">Referral wallet balance</p>
                <p className="font-semibold text-slate-900">Rs {walletBalance.toFixed(2)}</p>
              </div>
            </div>
          </Card>
        </main>
      </ContentPanel>
    </div>
  );
}
