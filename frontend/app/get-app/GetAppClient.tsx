'use client';

import { useState } from 'react';
import Link from 'next/link';
import QRCode from 'react-qr-code';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BRAND_FULL } from '@/constants/brand';

type Props = { siteUrl: string };

export function GetAppClient({ siteUrl }: Props) {
  const [copied, setCopied] = useState(false);
  const target = siteUrl.replace(/\/+$/, '');

  async function copy() {
    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <Link
          href="/"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Back to home
        </Link>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Scan to open
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">
          {BRAND_FULL}
        </h1>
        <p className="mt-1 max-w-sm text-sm text-slate-600">
          Point your camera at the code — you will be taken to our website.
        </p>
        <div className="mt-8 rounded-2xl bg-white p-5 shadow-soft">
          <QRCode value={target} size={224} />
        </div>
        <p className="mt-6 max-w-md break-all text-sm text-slate-700">{target}</p>
        <Button
          type="button"
          variant="accent"
          size="lg"
          className="mt-6 inline-flex items-center gap-2"
          onClick={copy}
        >
          {copied ? (
            <>
              <Check className="h-5 w-5 shrink-0" aria-hidden />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-5 w-5 shrink-0" aria-hidden />
              Copy link
            </>
          )}
        </Button>
      </main>
    </div>
  );
}
