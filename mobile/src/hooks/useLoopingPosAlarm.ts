import { useCallback, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';

/**
 * Plays a looping beep while `shouldRing` is true (e.g. new order in POS auto mode,
 * or pending list when manual). Stops when `shouldRing` becomes false or `stopAlarm()` runs.
 */
export function useLoopingPosAlarm(shouldRing: boolean) {
  const soundRef = useRef<Audio.Sound | null>(null);

  const stopAlarm = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    soundRef.current = null;
    try {
      await s.stopAsync();
      await s.unloadAsync();
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!shouldRing) {
      void stopAlarm();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/sounds/beep.wav'),
          { isLooping: true, shouldPlay: true, volume: 1 },
        );
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
      void stopAlarm();
    };
  }, [shouldRing, stopAlarm]);

  return { stopAlarm };
}
