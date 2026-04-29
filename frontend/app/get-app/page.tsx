import type { Metadata } from 'next';
import { BRAND_FULL } from '@/constants/brand';
import { GetAppClient } from './GetAppClient';

function publicSiteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return 'https://vybepk.com';
  try {
    return new URL(raw.includes('://') ? raw : `https://${raw}`).origin;
  } catch {
    return 'https://vybepk.com';
  }
}

export const metadata: Metadata = {
  title: 'Open app',
  description: `Scan the QR code or copy the link to open ${BRAND_FULL} on your phone.`,
};

export default function GetAppPage() {
  return <GetAppClient siteUrl={publicSiteOrigin()} />;
}
