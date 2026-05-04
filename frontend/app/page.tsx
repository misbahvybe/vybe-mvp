import Link from 'next/link';
import Image from 'next/image';
import { Caveat, Permanent_Marker, Inter } from 'next/font/google';
import { LandingLogo } from '@/components/landing/LandingLogo';
import { LandingViewportLock } from '@/components/landing/LandingViewportLock';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-landing-sans',
  display: 'swap',
});

const caveat = Caveat({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-landing-script',
  display: 'swap',
});

const permanentMarker = Permanent_Marker({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-landing-marker',
  display: 'swap',
});

/**
 * Landing assets live in /public/landing/
 * - hero-collage.svg (or .png) — use unoptimized for SVG (Next/Image default blocks SVG optimization)
 * - deco-*.png — must match filenames on disk (.jpg here causes 404 → hidden)
 */
const ASSETS = {
  heroCollage: '/landing/hero-collage.svg',
  decoTopLeft: '/landing/deco-top-left.png',
  decoBottomLeft: '/landing/deco-bottom-left.png',
  decoBottomRight: '/landing/deco-bottom-right.png',
} as const;

/** Landing-only accent (amber); app shell still uses `primary` in Tailwind. */
const LANDING_ACCENT = '#F9A31E';

export default function LandingPage() {
  return (
    <div
      className={`relative flex h-dvh max-h-dvh flex-col overflow-hidden bg-black text-white ${inter.variable} ${caveat.variable} ${permanentMarker.variable} font-sans antialiased`}
    >
      <LandingViewportLock />
      

      <div
        className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
        aria-hidden
      >
        {/* Top deco: mirror of bottom — strip at top; image bottom-aligned; top ~1/4 clipped above viewport. */}
        <div className="absolute left-0 top-0 h-[min(20dvh,220px)] w-[min(46vw,300px)] overflow-hidden sm:h-[min(24dvh,270px)] sm:w-[min(40vw,340px)] md:h-[min(26dvh,300px)]">
          <img
            src={ASSETS.decoTopLeft}
            alt=""
            decoding="async"
            className="absolute bottom-0 left-0 h-[calc(100%*4/3)] w-auto max-w-none -translate-x-[18%] object-contain opacity-90 [object-position:left_bottom] sm:-translate-x-[22%]"
            aria-hidden
          />
        </div>
        {/* Bottom decos: ~3/4 of image visible; bottom ~1/4 clipped (image height = 4/3 of window). */}
        <div className="absolute bottom-0 left-0 h-[min(20dvh,220px)] w-[min(46vw,300px)] overflow-hidden sm:h-[min(24dvh,270px)] sm:w-[min(40vw,340px)] md:h-[min(26dvh,300px)]">
          <img
            src={ASSETS.decoBottomLeft}
            alt=""
            decoding="async"
            className="absolute left-0 top-0 h-[calc(100%*4/3)] w-auto max-w-none -translate-x-[18%] object-contain opacity-90 [object-position:left_top] sm:-translate-x-[22%]"
            aria-hidden
          />
        </div>
        <div className="absolute bottom-0 right-0 h-[min(20dvh,220px)] w-[min(48vw,320px)] overflow-hidden sm:h-[min(24dvh,270px)] sm:w-[min(42vw,360px)] md:h-[min(26dvh,300px)]">
          <img
            src={ASSETS.decoBottomRight}
            alt=""
            decoding="async"
            className="absolute right-0 top-0 h-[calc(100%*4/3)] w-auto max-w-none translate-x-[18%] object-contain opacity-90 [object-position:right_top] sm:translate-x-[22%]"
            aria-hidden
          />
        </div>
      </div>

      <header className="relative z-30 flex shrink-0 justify-end px-4 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-8 sm:pb-2 sm:pt-[max(1rem,env(safe-area-inset-top))]">
        <Link href="/" className="block text-right" aria-label="VYBE Superapp home">
          <LandingLogo />
        </Link>
      </header>

      <main className="relative z-10 mx-auto grid min-h-0 w-full max-w-[1400px] flex-1 grid-cols-1 content-center items-center gap-2 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-0 sm:gap-5 sm:px-8 sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:pt-1 md:gap-8 lg:grid-cols-2 lg:gap-10 lg:px-10 lg:pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:pt-2 xl:px-12">
        <div className="order-2 min-h-0 min-w-0 max-w-xl justify-self-center text-center lg:order-1 lg:justify-self-start lg:pl-8 lg:text-left xl:pl-12 2xl:pl-24">
          <h1 className="space-y-0 leading-[0.95]">
            <span
              className={`${caveat.className} block text-[clamp(1.65rem,5.2vw,3.75rem)] font-semibold leading-[0.95] tracking-wide text-white sm:text-[clamp(1.85rem,5vw,3.75rem)]`}
            >
              Delivery for
            </span>
            <span
              className={`${permanentMarker.className} block py-0.5 text-[clamp(2.35rem,9.5vw,6.5rem)] leading-[0.9] tracking-tight sm:py-1 sm:leading-[0.92]`}
              style={{ color: LANDING_ACCENT }}
            >
              Pakistan&apos;s
            </span>
            <span
              className={`${caveat.className} block text-[clamp(1.65rem,5.2vw,3.85rem)] font-semibold leading-[0.95] tracking-wide text-white sm:text-[clamp(1.85rem,5vw,3.85rem)]`}
            >
              best local restaurants
            </span>
          </h1>

          <p
            className={`mx-auto mt-3 max-w-md text-sm font-medium leading-snug text-white/95 sm:mt-5 sm:text-base sm:leading-relaxed md:mt-6 md:text-lg lg:mx-0 ${inter.className}`}
          >
            Fair pricing for restaurants — keep more of what you earn.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:mt-6 md:mt-8 lg:justify-start">
            <Link
              href="/auth/signup"
              className={`inline-flex rounded-full bg-primary px-8 py-3 text-center text-sm font-bold lowercase tracking-wide text-white shadow-lg transition-transform hover:scale-[1.02] hover:bg-accent-hover active:scale-[0.98] sm:px-10 sm:py-3.5 sm:text-base md:py-4 md:text-lg ${inter.className}`}
              style={{ boxShadow: `0 12px 40px ${LANDING_ACCENT}55` }}
            >
              order now
            </Link>
            <Link
              href="/get-app"
              className={`inline-flex rounded-full border-2 border-transparent px-8 py-3 text-center text-sm font-bold tracking-wide text-white shadow-lg transition-transform hover:scale-[1.02] border-white active:scale-[0.98] sm:px-10 sm:py-3.5 sm:text-base md:py-4 md:text-lg ${inter.className}`}
              
            >
              Get the app
            </Link>
          </div>
        </div>

        <div className="relative order-1 flex min-h-0 w-full max-w-full justify-center justify-self-center sm:max-w-[min(96vw,620px)] lg:order-2 lg:h-full lg:min-h-0 lg:max-h-none lg:max-w-[min(58vw,760px)] lg:justify-self-end">
          <div className="relative flex h-full min-h-0 w-full max-h-[min(28dvh,220px)] items-center justify-center sm:max-h-[min(32dvh,260px)] md:max-h-[min(36dvh,300px)] lg:max-h-[min(calc(100dvh-5.75rem),100%)]">
            {ASSETS.heroCollage.endsWith('.svg') ? (
              // eslint-disable-next-line @next/next/no-img-element -- next/image skips SVG optimization without extra config; <img> is reliable for local SVGs
              <img
                src={ASSETS.heroCollage}
                alt="VYBE — noodles, wings, and fresh meals"
                width={900}
                height={900}
                className="max-h-full w-full object-contain object-center drop-shadow-2xl"
                decoding="async"
                fetchPriority="high"
              />
            ) : (
              <Image
                src={ASSETS.heroCollage}
                alt="VYBE — noodles, wings, and fresh meals"
                width={900}
                height={900}
                className="max-h-full w-full object-contain object-center drop-shadow-2xl"
                priority
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
