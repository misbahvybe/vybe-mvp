import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function RiderLandingPage() {
  return (
    <div className="min-h-screen bg-primary-dark flex flex-col items-center justify-center px-4 sm:px-8 w-full min-w-0">
      <div className="text-center w-full max-w-sm sm:max-w-md">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Become a Captain</h1>
        <p className="mt-2 text-white/85 text-sm sm:text-base">Login with your captain account to start accepting deliveries.</p>
        <Link href="/auth/login" className="mt-8 block">
          <Button variant="accent" size="lg" fullWidth>Login as Captain</Button>
        </Link>
        <Link href="/" className="mt-4 block text-white/90 hover:text-white text-sm">← Back to home</Link>
      </div>
    </div>
  );
}
