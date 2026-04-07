import { Suspense } from 'react';
import { Loader } from '@/components/ui/Loader';

export default function PartnerInviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-primary-dark flex items-center justify-center">
        <Loader size={44} />
      </div>
    }>
      {children}
    </Suspense>
  );
}
