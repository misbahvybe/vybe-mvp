'use client';

import { useCallback, useMemo, useState } from 'react';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const DEFAULT_SHARE_URL = 'https://vybepk.com';

export default function ReferPage() {
  const [copied, setCopied] = useState(false);
  const shareUrl = useMemo(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return process.env.NEXT_PUBLIC_APP_URL || DEFAULT_SHARE_URL;
  }, []);

  const shareText = 'Order groceries, pharmacy, and more on VYBE — one app, delivered fast.';

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [shareUrl]);

  const onShare = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'VYBE', text: shareText, url: shareUrl });
      } catch {
        // user cancelled or share failed
      }
    } else {
      void copy();
    }
  }, [copy, shareText, shareUrl]);

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
              Tell friends where to get fast delivery. Optional referral rewards will appear here in a future update.
            </p>
          </div>

          <Card>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Link to share</p>
            <p className="text-sm break-all text-slate-800 font-mono bg-slate-50 rounded-button px-3 py-2.5 border border-slate-100">
              {shareUrl}
            </p>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <Button type="button" fullWidth onClick={copy} variant="outline" size="md">
                {copied ? 'Copied!' : 'Copy link'}
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
            <h2 className="text-sm font-semibold text-slate-800 mb-2">Coming soon</h2>
            <ul className="text-sm text-slate-600 space-y-1.5 list-disc list-inside">
              <li>Personal referral code</li>
              <li>Rewards when friends place their first order</li>
            </ul>
          </Card>
        </main>
      </ContentPanel>
    </div>
  );
}
