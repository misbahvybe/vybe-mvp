'use client';

import Link from 'next/link';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';

export default function PaymentPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="How you pay" backHref="/more" />
      <ContentPanel bottomPadding="sm">
        <main className="app-shell-narrow py-4 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            VYBE is built for easy checkout. Here is how payment works in the app today.
          </p>

          <Card>
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden>
                💵
              </span>
              <div>
                <h2 className="font-semibold text-slate-900">Cash on delivery (COD)</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Pay the rider in cash when your order arrives. This is the default and most common option.
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-amber-50/80 border-amber-100">
            <h2 className="text-sm font-semibold text-amber-900">Cards &amp; mobile wallets</h2>
            <p className="text-sm text-amber-900/80 mt-1">
              Saved cards and in-app card checkout may be enabled for your account or region. If you do not see them at
              checkout, your order is still fully supported with COD.
            </p>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-slate-800 mb-2">At checkout</h2>
            <p className="text-sm text-slate-600">
              Choose the payment method shown on the checkout screen. You can review fees and the total before you place
              the order.
            </p>
            <div className="mt-4">
              <Link
                href="/profile/payment-methods"
                className="inline-flex items-center justify-center px-5 py-2.5 text-base rounded-button font-medium bg-primary-dark text-white hover:opacity-90 transition-all w-full sm:w-auto text-center no-underline"
              >
                Open saved payment methods
              </Link>
            </div>
          </Card>
        </main>
      </ContentPanel>
    </div>
  );
}
