let sharedCtx: AudioContext | null = null;

/**
 * Short attention chime for a new order (web admin / POS). May stay silent
 * until the user has interacted with the page (browser autoplay policy).
 */
export function playNewOrderChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext) as typeof AudioContext | undefined;
    if (Ctx) {
      if (!sharedCtx) sharedCtx = new Ctx();
      const ctx = sharedCtx;
      void ctx.resume();
      const now = ctx.currentTime;
      for (let i = 0; i < 2; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 880;
        gain.gain.value = 0.18;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t0 = now + i * 0.2;
        osc.start(t0);
        osc.stop(t0 + 0.1);
      }
      return;
    }
  } catch {
    // fall through
  }
  try {
    const a = new Audio('/beep.wav');
    a.volume = 0.88;
    void a.play().catch(() => {});
  } catch {
    // ignore
  }
}
