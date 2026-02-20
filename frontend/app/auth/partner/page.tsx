import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function PartnerLandingPage() {
  return (
    <div className="min-h-screen bg-primary-dark flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <h1 className="text-2xl font-bold text-slate-800">Partner Store</h1>
        <p className="mt-2 text-slate-600">Register your store to start receiving orders. Admin approval required.</p>
        <Link href="/auth/login" className="mt-8 block">
          <Button variant="accent" size="lg" fullWidth>Login as Store</Button>
        </Link>
        <Link href="/" className="mt-4 block text-primary text-sm">← Back to home</Link>
      </div>
    </div>
  );
}
