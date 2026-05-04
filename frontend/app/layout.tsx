import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthListener } from '@/components/auth/AuthListener';
import { AuthHydrate } from '@/components/auth/AuthHydrate';
import { BRAND_FULL } from '@/constants/brand';

/**
 * PWA manifest (`/manifest.json`): browsers fetch it without auth. Vercel Deployment Protection
 * returns 401 for that URL, so we must NOT emit `<link rel="manifest">` on Vercel unless you
 * explicitly opt in (and ideally disable Deployment Protection or accept 401 in DevTools).
 *
 * Rules:
 * - `SKIP_PWA_MANIFEST=1` → never link manifest (anywhere).
 * - On Vercel (`VERCEL=1`): manifest is linked ONLY if `NEXT_PUBLIC_ENABLE_PWA_MANIFEST=true`
 *   (strict; missing/false/empty all mean no manifest — avoids accidental 401).
 * - Local dev (no Vercel): manifest on unless `NEXT_PUBLIC_ENABLE_PWA_MANIFEST=false`.
 *
 * `NEXT_PUBLIC_*` is inlined at **build** time — change env → **redeploy** (new build).
 */
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

const enablePwaManifest =
  process.env.SKIP_PWA_MANIFEST !== '1' &&
  (isVercel
    ? process.env.NEXT_PUBLIC_ENABLE_PWA_MANIFEST === 'true'
    : process.env.NEXT_PUBLIC_ENABLE_PWA_MANIFEST !== 'false');

const siteDescription =
  'Food, grocery, and medicine delivery. Order easily from your phone — cash on delivery.';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vybepk.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: BRAND_FULL,
    template: `%s | ${BRAND_FULL}`,
  },
  description: siteDescription,
  openGraph: {
    title: BRAND_FULL,
    description: siteDescription,
    siteName: BRAND_FULL,
    type: 'website',
    locale: 'en_PK',
  },
  twitter: {
    card: 'summary_large_image',
    title: BRAND_FULL,
    description: siteDescription,
  },
  ...(enablePwaManifest ? { manifest: '/manifest.json' } : {}),
};

export const viewport: Viewport = {
  themeColor: '#F9A31E',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <body className="min-h-screen w-full overflow-x-hidden">
        <AuthHydrate />
        <AuthListener />
        {children}
      </body>
    </html>
  );
}
