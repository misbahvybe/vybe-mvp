'use client';

import Image from 'next/image';
import { useState } from 'react';

/** App mark from PWA icons first; dedicated landing asset if added later; then text. */
const LOGO_SOURCES = ['/icon-512.png', '/icon-192.png', '/landing/logo.png'] as const;

function TextLogo() {
  return (
    <div className="flex flex-col items-end text-right leading-none">
      <span className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">VYBE</span>
      <span className="mt-1 text-xs font-normal uppercase tracking-[0.25em] text-white sm:text-sm">
        SUPERAPP
      </span>
    </div>
  );
}

export function LandingLogo() {
  const [index, setIndex] = useState(0);

  if (index >= LOGO_SOURCES.length) {
    return <TextLogo />;
  }

  return (
    <Image
      src={LOGO_SOURCES[index].trim()}
      alt="VYBE SUPERAPP"
      width={400}
      height={150}
      className="h-14 w-auto max-w-[220px] object-contain object-right sm:h-16 sm:max-w-[260px] md:h-[4.5rem] md:max-w-[300px] lg:h-20 lg:max-w-[340px]"
      onError={() => setIndex((i) => i + 1)}
      priority
    />
  );
}
