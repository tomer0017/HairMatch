/**
 * Optional haptic / audio cues for the self-timer's final seconds.
 *
 * Purely best-effort: mobile browsers may block either one (iOS Safari has no
 * vibration API and mutes Web Audio with the silent switch on), so every call
 * is guarded and the timer never depends on them.
 */

let audioContext: AudioContext | null = null;

/**
 * Create / resume the audio context. Must be called from a user gesture (the
 * shutter tap) so iOS Safari allows the later countdown beeps.
 */
export function primeTimerFeedback(): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioContext ??= new Ctor();
    if (audioContext.state === 'suspended') void audioContext.resume().catch(() => {});
  } catch {
    audioContext = null;
  }
}

/** A short, quiet tick + vibration. Silently does nothing when unsupported. */
export function timerTick(): void {
  try {
    navigator.vibrate?.(40);
  } catch {
    /* vibration unsupported or blocked */
  }

  try {
    const ctx = audioContext;
    if (!ctx || ctx.state !== 'running') return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.13);
  } catch {
    /* audio unsupported or blocked */
  }
}
