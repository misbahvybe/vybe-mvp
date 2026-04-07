import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthListener } from '@/components/auth/AuthListener';

/** Vercel preview + Deployment Protection returns 401 for static files; skip manifest link so the browser does not request it. */
const isVercelPreview = process.env.VERCEL_ENV === 'preview';

export const metadata: Metadata = {
  title: 'VYBE Superapp',
  description: 'Food, grocery, and medicine delivery. Order easily from your phone — cash on delivery.',
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
        <AuthListener />
        {children}
      </body>
    </html>
  );
}
