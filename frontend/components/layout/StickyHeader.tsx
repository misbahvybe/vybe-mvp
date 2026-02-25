'use client';

import Link from 'next/link';

interface StickyHeaderProps {
  title: string;
  backHref?: string;
  rightAction?: React.ReactNode;
}

export function StickyHeader({ title, backHref, rightAction }: StickyHeaderProps) {
  const isBrand = !backHref && title === 'VYBE';
  return (
    <header className="sticky top-0 z-40 bg-primary-dark safe-top">
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        <div className="w-10 flex items-center shrink-0">
          {backHref ? (
            <Link href={backHref} className="p-2 -ml-2 text-white" aria-label="Back">
              ←
            </Link>
          ) : null}
        </div>
        <h1 className={`font-bold text-white truncate flex-1 text-center ${isBrand ? 'text-xl tracking-tight' : 'text-lg'}`}>{title}</h1>
        <div className="w-20 flex items-center justify-end gap-0 text-white [&>a]:text-white [&>button]:text-white shrink-0">{rightAction ?? null}</div>
      </div>
    </header>
  );
}
