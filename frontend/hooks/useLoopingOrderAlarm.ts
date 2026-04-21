'use client';

import { useCallback, useEffect, useRef } from 'react';

/** Public asset; replace with a longer alarm .wav/.ogg for a more noticeable ringtone. */
const ALARM_SRC = '/beep.wav';

/**
 * Plays a looping alarm while `shouldRing` is true (new order awaiting accept/reject).
 * Stops when `shouldRing` becomes false or when `stopAlarm()` is called (e.g. on button click).
 */
export function useLoopingOrderAlarm(shouldRing: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAlarm = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    try {
      a.pause();
      a.currentTime = 0;
      a.loop = false;
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!shouldRing) {
      stopAlarm();
      return;
    }
    if (typeof window === 'undefined') return;

    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(ALARM_SRC);
        audioRef.current.preload = 'auto';
      }
      const a = audioRef.current;
      a.loop = true;
      a.volume = 1;
      void a.play().catch(() => {});
    } catch {
      // ignore
    }

    return () => stopAlarm();
  }, [shouldRing, stopAlarm]);

  return { stopAlarm };
}
