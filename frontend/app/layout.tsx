import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthListener } from '@/components/auth/AuthListener';

/** Vercel preview + Deployment Protection returns 401 for static files; skip manifest link so the browser does not request it. */
const isVercelPreview = process.env.VERCEL_ENV === 'preview';

export const metadata: Metadata = {
  title: 'Vibe Super App',
  description: 'Food, grocery, and medicine delivery. Order easily from your phone — cash on delivery.',
  ...(isVercelPreview ? {} : { manifest: '/manifest.json' }),
};

export const viewport: Viewport = {
  themeColor: '#1a1a1a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AuthListener />
        {children}
      </body>
    </html>
  );
}
