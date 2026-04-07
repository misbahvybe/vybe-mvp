'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { BRAND_FULL } from '@/constants/brand';

const SLIDES = [
  { id: 'food', title: 'Food', description: 'Fast delivery from restaurants near you. Pay cash when your order arrives.', image: '/food-plate.png' },
  { id: 'grocery', title: 'Groceries', description: 'Fresh groceries to your door — one simple app for daily needs.', image: '/grocery-shopping-basket.png' },
  { id: 'medicine', title: 'Medicine', description: 'Health essentials delivered quickly and reliably.', image: '/medicine-box.png' },
];

export default function LandingPage() {
  const [slide, setSlide] = useState(0);
  const [showCta, setShowCta] = useState(false);

  const handleContinue = () => {
    if (slide < SLIDES.length - 1) {
      setSlide((s) => s + 1);
    } else {
      setShowCta(true);
    }
  };

  if (showCta) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="relative flex-1 min-h-[400px] rounded-b-3xl bg-white flex flex-col items-center justify-center overflow-hidden">
          <div className="relative z-10 w-full max-w-sm sm:max-w-md lg:max-w-lg px-4 sm:px-6 text-center">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight px-2">{BRAND_FULL}</h1>
            <p className="mt-2 text-slate-600 text-sm font-medium">
              Order food, groceries &amp; medicine — simple and fast
            </p>
          </div>
        </div>
        <div className="bg-primary-dark rounded-t-3xl shadow-soft-lg px-4 sm:px-8 mb-10 pt-14 pb-14 safe-bottom min-h-[20px] flex flex-col justify-center w-full min-w-0">
          <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg mx-auto space-y-4">
            <Link href="/auth/signup" className="block">
              <Button variant="accent" size="lg" fullWidth>
                Order Now
              </Button>
            </Link>
            <div className="pt-2 text-center space-y-1">
              <Link href="/auth/login" className="block text-white/90 text-sm font-medium hover:text-white">
                Customer Login
              </Link>
              <Link href="/auth/signup" className="block text-white/80 mt-10 mb-10 text-sm hover:text-white">
                Sign up
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const current = SLIDES[slide];

  return (
    <div className="min-h-screen flex flex-col bg-primary-dark">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="relative h-[55vh] sm:h-[60vh] min-h-[200px] max-h-[640px] bg-white overflow-hidden rounded-b-3xl flex flex-col items-center justify-center px-4">
          <div className="w-full max-w-[min(88vw,312px)] aspect-square max-h-[min(50vh,312px)] rounded-2xl bg-white flex items-center justify-center p-3">
            <Image
              src={current.image}
              alt={current.title}
              width={312}
              height={312}
              className="object-contain w-full h-full max-w-[280px] sm:max-w-[312px]"
              sizes="(max-width: 640px) 85vw, 312px"
            />
          </div>
        </div>
        <div className="bg-primary-dark rounded-t-3xl px-4 sm:px-8 pt-6 pb-10 safe-bottom flex-1 flex flex-col justify-center relative z-10 w-full min-w-0">
          <div className="flex justify-center gap-2 mb-3">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSlide(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === slide ? 'bg-white w-6' : 'bg-white/50'
                }`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white mb-2">{current.title}</h2>
          <p className="text-white/90 text-sm sm:text-base mb-5 max-w-xl">{current.description}</p>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleContinue();
            }}
            className="w-full px-6 py-3 text-lg font-semibold rounded-button bg-white text-primary-dark hover:bg-slate-100 transition-all cursor-pointer [touch-action:manipulation]"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
