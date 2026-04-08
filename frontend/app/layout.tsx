import type { Metadata, Viewport } from 'next';
import './globals.css';
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from '@clerk/nextjs';
import { AuthListener } from '@/components/auth/AuthListener';
import { BRAND_FULL } from '@/constants/brand';

/** Vercel preview + Deployment Protection returns 401 for static files; skip manifest link so the browser does not request it. */
const isVercelPreview = process.env.VERCEL_ENV === 'preview';

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
  ...(isVercelPreview ? {} : { manifest: '/manifest.json' }),
};

export const viewport: Viewport = {
  themeColor: '#1a1a1a',
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
        <ClerkProvider>
          <header className="flex flex-wrap items-center justify-end gap-2 border-b border-white/10 bg-primary-dark px-4 py-2 text-sm text-white">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button type="button" className="rounded-lg px-3 py-1.5 font-medium text-white/90 hover:bg-white/10">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button type="button" className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white hover:opacity-90">
                  Sign up
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </header>
          <AuthListener />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
