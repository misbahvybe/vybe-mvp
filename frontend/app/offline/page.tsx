import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';

const OFFLINE_ILLUSTRATION =
  'https://unsplash-assets.imgix.net/empty-states/photos.png?auto=format&fit=crop&q=60';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-primary-dark flex flex-col items-center justify-center px-6">
      <div className="relative w-48 h-48 mb-4">
        <Image
          src={OFFLINE_ILLUSTRATION}
          alt=""
          fill
          className="object-contain"
          sizes="192px"
        />
      </div>
      <h1 className="text-xl font-bold text-slate-800">You&apos;re offline</h1>
      <p className="text-slate-600 text-center mt-2 mb-6">Check your connection and try again.</p>
      <Link href="/">
        <Button variant="primary">Retry</Button>
      </Link>
    </div>
  );
}
