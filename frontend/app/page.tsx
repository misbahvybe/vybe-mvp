'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';

const SLIDES = [
  {
    id: 'food',
    title: 'Food delivered in 90–120 minutes',
    description: '15% commission only — restaurants keep more, you pay less. Order from top restaurants across Pakistan.',
    image: 'https://plus.unsplash.com/premium_photo-1661591247553-cf24f24504ac?q=80&w=1332&auto=format&fit=crop&ixlib=rb-4.1.0',
  },
  {
    id: 'grocery',
    title: 'Groceries & Quick-Commerce',
    description: 'Fresh ingredients delivered fast. One app for food, groceries, medicine — pay with crypto or cash.',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80',
  },
  {
    id: 'medicine',
    title: 'Medicine at Your Doorstep',
    description: 'Prescriptions & health essentials. Fast, verified delivery. Crypto or cash — your choice.',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop&q=80',
  },
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
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white" />
          <div className="relative z-10 w-full max-w-sm px-6 text-center">
            <h1 className="text-2xl font-bold text-slate-800">VYBE Superapp</h1>
            <p className="mt-2 text-slate-600 text-sm font-medium">
              Everything you need. Now with crypto.
            </p>
            <p className="mt-1 text-slate-500 text-xs">
              Revolutionising Pakistan&apos;s digital economy
            </p>
          </div>
        </div>
        <div className=" rounded-t-3xl shadow-soft-lg px-6 mb-10 pt-14 pb-14 safe-bottom  min-h-[20px] flex flex-col justify-center">
          <div className="max-w-sm mx-auto space-y-4">
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
        <div className="relative h-[45vh] min-h-[640px] bg-white overflow-hidden rounded-b-3xl">
          <Image
            src={current.image}
            alt={current.title}
            fill
            className="object-cover rounded-b-3xl"
            sizes="100vw"
            priority
          />
        </div>
        <div className="bg-primary-dark rounded-t-3xl px-6 pt-6 pb-10 safe-bottom flex-1 flex flex-col justify-center relative z-10">
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
          <h2 className="text-lg font-bold text-white mb-2">{current.title}</h2>
          <p className="text-white/90 text-sm mb-5">{current.description}</p>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleContinue();
            }}
            className="w-full px-6 py-3 text-lg font-semibold rounded-button bg-white text-[#1e3a5f] hover:bg-slate-100 transition-all cursor-pointer [touch-action:manipulation]"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
