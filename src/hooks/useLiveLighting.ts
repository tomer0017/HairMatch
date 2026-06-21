import { useEffect, useRef, useState } from 'react';
import { calculateLightingMetrics, type LiveLightingMetrics } from '../utils/brightness';

/**
 * Lighting verdict for the live preview.
 * - 'pending' : not enough information yet (camera warming up / inactive)
 * - 'ok'      : good lighting (🟢)
 * - 'low'     : usable but a bit dim (🟠) — capture still allowed
 * - 'dark'    : too dark to shoot (🔴) — capture blocked
 * - 'bright'  : overexposed (🔴) — capture blocked
 */
export type LightingState = 'pending' | 'ok' | 'low' | 'dark' | 'bright';

/** How often to sample the preview (ms). 300–500ms keeps it cheap & responsive. */
const SAMPLE_INTERVAL_MS = 400;

/** Longest edge (px) of the sampled frame — tiny is plenty for luminance. */
const SAMPLE_SIZE = 160;

/**
 * Live-preview thresholds. Kept in step with the post-capture darkness gate so
 * a scene that would fail validation is flagged (and capture blocked) up front.
 */
const LIVE = {
  /** Red — too dark. */
  darkAverage: 95,
  darkMedian: 85,
  darkPixelRatio: 0.45,
  veryDarkPixelRatio: 0.25,
  /** Orange — dim but acceptable. */
  lowAverage: 125,
  lowDarkPixelRatio: 0.3,
  /** Red — overexposed. */
  brightOverExposedRatio: 0.35,
  brightAverage: 225,
};

function classify(m: LiveLightingMetrics): LightingState {
  if (m.overExposedRatio > LIVE.brightOverExposedRatio || m.average > LIVE.brightAverage) {
    return 'bright';
  }
  if (
    m.average < LIVE.darkAverage ||
    m.median < LIVE.darkMedian ||
    m.darkPixelRatio > LIVE.darkPixelRatio ||
    m.veryDarkPixelRatio > LIVE.veryDarkPixelRatio
  ) {
    return 'dark';
  }
  if (m.average < LIVE.lowAverage || m.darkPixelRatio > LIVE.lowDarkPixelRatio) {
    return 'low';
  }
  return 'ok';
}

interface UseLiveLightingResult {
  state: LightingState;
  metrics: LiveLightingMetrics | null;
}

/**
 * Continuously analyses the live camera preview (locally, on a tiny canvas) so
 * the UI can warn about poor lighting and block capture before a bad photo is
 * ever taken. Sampling only runs while `active` is true.
 */
export function useLiveLighting(
  videoRef: React.RefObject<HTMLVideoElement>,
  active: boolean,
): UseLiveLightingResult {
  const [state, setState] = useState<LightingState>('pending');
  const [metrics, setMetrics] = useState<LiveLightingMetrics | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) {
      setState('pending');
      setMetrics(null);
      return;
    }

    const canvas = canvasRef.current ?? document.createElement('canvas');
    canvasRef.current = canvas;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let cancelled = false;

    const sample = () => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || !ctx) return;

      const scale = Math.min(1, SAMPLE_SIZE / Math.max(video.videoWidth, video.videoHeight));
      const w = Math.max(1, Math.round(video.videoWidth * scale));
      const h = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);

      const m = calculateLightingMetrics(ctx.getImageData(0, 0, w, h).data);
      if (cancelled) return;
      setMetrics(m);
      setState(classify(m));
    };

    sample();
    const id = window.setInterval(sample, SAMPLE_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [active, videoRef]);

  return { state, metrics };
}
