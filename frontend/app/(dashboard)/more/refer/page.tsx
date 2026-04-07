'use client';

import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';

export default function ReferPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Reference Friends" backHref="/more" />
      <ContentPanel bottomPadding="sm">
      <main className="app-shell-narrow py-4">
        <Card>
          <p className="text-slate-600 text-sm">Referral program will be available in a future update.</p>
        </Card>
      </main>
      </ContentPanel>
    </div>
  );
}
