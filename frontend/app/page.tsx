'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MdRestaurant, MdShoppingBasket, MdLocalPharmacy } from 'react-icons/md';
import { Button } from '@/components/ui/Button';

const SLIDES = [
  {
    id: 'food',
    title: 'Food',
    description: 'Fast delivery from top restaurants across Pakistan. Pay with crypto or cash.',
  },
  {
    id: 'grocery',
    title: 'Groceries',
    description: 'Fresh ingredients delivered fast. One app for food, groceries, medicine.',
  },
  {
    id: 'medicine',
    title: 'Medicine',
    description: 'Prescriptions & health essentials. Fast, verified delivery.',
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
          <div className="relative z-10 w-full max-w-sm px-6 text-center">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">VYBE</h1>
            <p className="mt-2 text-slate-600 text-sm font-medium">
              Everything you need now with crypto
            </p>
          </div>
        </div>
        <div className="bg-primary-dark rounded-t-3xl shadow-soft-lg px-6 mb-10 pt-14 pb-14 safe-bottom min-h-[20px] flex flex-col justify-center">
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
  const SlideIcon = current.id === 'food' ? MdRestaurant : current.id === 'grocery' ? MdShoppingBasket : MdLocalPharmacy;

  return (
    <div className="min-h-screen flex flex-col bg-primary-dark">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="relative h-[45vh] min-h-[320px] bg-white overflow-hidden rounded-b-3xl flex flex-col items-center justify-center">
          <div className="w-24 h-24 rounded-2xl bg-slate-100 flex items-center justify-center">
            <SlideIcon className="w-14 h-14 text-slate-700" />
          </div>
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
            className="w-full px-6 py-3 text-lg font-semibold rounded-button bg-white text-primary-dark hover:bg-slate-100 transition-all cursor-pointer [touch-action:manipulation]"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
