'use client';

import Image from 'next/image';
import { useState } from 'react';

export function OptionalLandingImage({
  src,
  className,
  width = 400,
  height = 400,
}: {
  src: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  const clean = src.trim();
  if (!clean) return null;
  return (
    <Image
      src={clean}
      alt=""
      width={width}
      height={height}
      className={className}
      onError={() => setVisible(false)}
      aria-hidden
    />
  );
}
