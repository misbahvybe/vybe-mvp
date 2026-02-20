'use client';

import { ReactNode } from 'react';

interface ContentPanelProps {
  children: ReactNode;
  className?: string;
  /** Padding bottom for nav (pb-24) or without nav (pb-20) */
  bottomPadding?: 'nav' | 'none' | 'sm';
}

export function ContentPanel({ children, className = '', bottomPadding = 'nav' }: ContentPanelProps) {
  const pb = bottomPadding === 'nav' ? 'pb-24' : bottomPadding === 'sm' ? 'pb-20' : 'pb-10';
  return (
    <div className={`bg-surface rounded-t-3xl flex-1 min-h-0 ${pb} ${className}`}>
      {children}
    </div>
  );
}
