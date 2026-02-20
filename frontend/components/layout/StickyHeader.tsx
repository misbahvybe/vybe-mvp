'use client';

import Link from 'next/link';

interface StickyHeaderProps {
  title: string;
  backHref?: string;
  rightAction?: React.ReactNode;
}

export function StickyHeader({ title, backHref, rightAction }: StickyHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-primary-dark safe-top">
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        <div className="w-10 flex items-center">
          {backHref ? (
            <Link href={backHref} className="p-2 -ml-2 text-white" aria-label="Back">
              ←
            </Link>
          ) : null}
        </div>
        <h1 className="text-lg font-bold text-white truncate">{title}</h1>
        <div className="w-10 flex items-center justify-end text-white [&>a]:text-white [&>button]:text-white">{rightAction ?? null}</div>
      </div>
    </header>
  );
}
