'use client';

import Link from 'next/link';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/store/authStore';

export default function AccountPage() {
  const user = useAuthStore((s) => s.user);
  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Account Information" backHref="/more" />
      <ContentPanel bottomPadding="sm">
      <main className="max-w-lg mx-auto px-4 py-4">
        <Card>
          {user && (
            <>
              <p className="text-slate-600 text-sm mb-1">Name</p>
              <p className="font-medium text-slate-800 mb-4">{user.name}</p>
              <p className="text-slate-600 text-sm mb-1">Email</p>
              <p className="font-medium text-slate-800 mb-4">{user.email}</p>
              <p className="text-slate-600 text-sm mb-1">Phone</p>
              <p className="font-medium text-slate-800">{user.phone}</p>
            </>
          )}
        </Card>
      </main>
      </ContentPanel>
    </div>
  );
}
