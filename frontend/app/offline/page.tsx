import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';

const OFFLINE_ILLUSTRATION =
  'https://unsplash-assets.imgix.net/empty-states/photos.png?auto=format&fit=crop&q=60';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-primary-dark flex flex-col items-center justify-center px-4 sm:px-8 w-full min-w-0">
      <div className="w-full max-w-md text-center flex flex-col items-center">
      <div className="relative w-40 h-40 sm:w-48 sm:h-48 mb-4 shrink-0">
        <Image
          src={OFFLINE_ILLUSTRATION}
          alt=""
          fill
          className="object-contain"
          sizes="192px"
        />
      </div>
      <h1 className="text-xl sm:text-2xl font-bold text-white">You&apos;re offline</h1>
      <p className="text-white/80 text-center mt-2 mb-6 text-sm sm:text-base px-2">Check your connection and try again.</p>
      <Link href="/">
        <Button variant="primary">Retry</Button>
      </Link>
      </div>
    </div>
  );
}
