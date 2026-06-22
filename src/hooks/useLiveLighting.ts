import { useEffect, useRef, useState } from 'react';
import {
  calculateLightingMetrics,
  regionStats,
  type LiveLightingMetrics,
} from '../utils/brightness';
import { detectFaceSync, ensureFaceDetector } from '../utils/faceDetection';
import { centerPortraitRect, faceCoreRect, faceHairRect } from '../utils/roi';

/**
 * Lighting verdict for the live preview.
 * - 'pending' : not enough information yet (camera warming up / inactive)
 * - 'ok'      : good lighting (🟢)
 * - 'low'     : usable but a bit dim (🟠) — capture still allowed
 * - 'dark'    : too dark to shoot (🔴) — capture blocked
 * - 'bright'  : overexposed (🔴) — capture blocked
 */
export type LightingState = 'pending' | 'ok' | 'low' | 'dark' | 'bright';

/** Where the live lighting metrics were measured. */
export type LiveLightingSource = 'faceROI' | 'centerPortraitROI' | 'wholeFrame';

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
  /** Red — overexposed (clipping). */
  brightOverExposedRatio: 0.4,
  brightAverage: 230,
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

/**
 * Subject-aware classification for face steps. Overexposure is still judged on
 * the full face+hair ROI, but darkness is judged primarily on the CORE face ROI
 * (skin) — so a dark background or dark hair around a well-lit face never trips
 * a false "too dark" warning. Only when the subject itself is dim do we fall
 * back to the full-ROI verdict.
 */
function classifySubject(roiM: LiveLightingMetrics, coreM: LiveLightingMetrics): LightingState {
  if (roiM.overExposedRatio > LIVE.brightOverExposedRatio || roiM.average > LIVE.brightAverage) {
    return 'bright';
  }
  const subjectWellLit =
    coreM.average >= LIVE.lowAverage &&
    coreM.median >= LIVE.darkMedian &&
    coreM.veryDarkPixelRatio <= LIVE.veryDarkPixelRatio;
  if (subjectWellLit) return 'ok';
  return classify(roiM);
}

/** Map full region stats onto the lighter live-metrics shape. */
function toLiveMetrics(s: {
  average: number;
  median: number;
  darkPixelRatio: number;
  veryDarkPixelRatio: number;
  overExposedRatio: number;
}): LiveLightingMetrics {
  return {
    average: s.average,
    median: s.median,
    darkPixelRatio: s.darkPixelRatio,
    veryDarkPixelRatio: s.veryDarkPixelRatio,
    overExposedRatio: s.overExposedRatio,
  };
}

interface UseLiveLightingOptions {
  /** Measure lighting on the subject (face → portrait centre) instead of frame. */
  useFace?: boolean;
  /** Current step id (debug only). */
  stepId?: string;
  /** Active camera facing mode (debug only). */
  facing?: string;
}

interface UseLiveLightingResult {
  state: LightingState;
  metrics: LiveLightingMetrics | null;
  /** Whether a face is currently detected (only meaningful when useFace). */
  faceDetected: boolean;
  /** Which region the latest sample was measured from. */
  lightingSource: LiveLightingSource;
}

/**
 * Continuously analyses the live camera preview (locally, on a tiny canvas) so
 * the UI can warn about poor lighting and block capture before a bad photo is
 * ever taken. Sampling only runs while `active` is true.
 *
 * When `useFace` is set, lighting is measured on the subject — the face + hair
 * ROI when a face is detected, otherwise a centred portrait ROI — so a dark
 * background doesn't trigger a false warning. The canvas is reused across
 * samples.
 */
export function useLiveLighting(
  videoRef: React.RefObject<HTMLVideoElement>,
  active: boolean,
  options: UseLiveLightingOptions = {},
): UseLiveLightingResult {
  const { useFace = false, stepId, facing } = options;
  const [state, setState] = useState<LightingState>('pending');
  const [metrics, setMetrics] = useState<LiveLightingMetrics | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [lightingSource, setLightingSource] = useState<LiveLightingSource>('wholeFrame');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastLogRef = useRef('');

  useEffect(() => {
    if (!active) {
      setState('pending');
      setMetrics(null);
      setFaceDetected(false);
      return;
    }

    // Kick off detector loading once; samples use it as soon as it's ready.
    if (useFace) void ensureFaceDetector();

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
      const { data } = ctx.getImageData(0, 0, w, h);

      let m: LiveLightingMetrics;
      let source: LiveLightingSource;
      let detected = false;
      let nextState: LightingState;

      if (useFace) {
        // Subject-aware: face ROI → portrait centre ROI (never whole frame),
        // so the dark background can't dominate the verdict.
        const face = detectFaceSync(video, video.videoWidth, video.videoHeight);
        if (face?.detected && face.boundingBox.width > 0) {
          detected = true;
          m = toLiveMetrics(regionStats(data, w, h, faceHairRect(face.boundingBox, w, h)));
          // Core face skin drives the darkness decision (dark bg/hair ignored).
          const core = toLiveMetrics(regionStats(data, w, h, faceCoreRect(face.boundingBox, w, h)));
          source = 'faceROI';
          nextState = classifySubject(m, core);
        } else {
          m = toLiveMetrics(regionStats(data, w, h, centerPortraitRect(w, h)));
          source = 'centerPortraitROI';
          nextState = classify(m);
        }
      } else {
        m = calculateLightingMetrics(data);
        source = 'wholeFrame';
        nextState = classify(m);
      }

      if (cancelled) return;
      setMetrics(m);
      setState(nextState);
      setFaceDetected(detected);
      setLightingSource(source);

      if (import.meta.env.DEV) {
        const key = `${facing}|${stepId}|${detected}|${source}|${nextState}`;
        if (key !== lastLogRef.current) {
          lastLogRef.current = key;
          // Whole-frame stats are a warning/debug signal only — they never block
          // capture when the subject ROI is well lit.
          const whole = calculateLightingMetrics(data);
          // eslint-disable-next-line no-console
          console.debug('[liveLighting]', {
            stepId,
            activeFacingMode: facing,
            faceDetected: detected,
            lightingSource: source,
            subjectRoiAverage: m.average,
            subjectRoiMedian: m.median,
            subjectRoiDarkPixelRatio: m.darkPixelRatio,
            wholeFrameAverage: whole.average,
            wholeFrameDarkPixelRatio: whole.darkPixelRatio,
            finalLiveLightingStatus: nextState,
          });
        }
      }
    };

    sample();
    const id = window.setInterval(sample, SAMPLE_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [active, useFace, stepId, facing, videoRef]);

  return { state, metrics, faceDetected, lightingSource };
}
