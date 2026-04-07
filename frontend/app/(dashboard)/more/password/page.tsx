'use client';

import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';

export default function PasswordPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Password" backHref="/more" />
      <ContentPanel bottomPadding="sm">
      <main className="app-shell-narrow py-4">
        <Card>
          <p className="text-slate-600 text-sm">Change password will be available in a future update.</p>
        </Card>
      </main>
      </ContentPanel>
    </div>
  );
}
