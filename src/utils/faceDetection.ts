import type { Detection, FaceDetector } from '@mediapipe/tasks-vision';

/**
 * Lightweight, fully client-side face/head detection (MediaPipe BlazeFace).
 *
 * The WASM runtime and the .tflite model are self-hosted in /public/mediapipe —
 * nothing is uploaded and no cloud inference is used. The detector is created
 * once (lazily) and reused for both the live preview and post-capture stills.
 *
 * Graceful degradation: if the model can't load (old browser, blocked assets),
 * every call returns null and callers fall back to whole-/centre-frame analysis
 * so the app keeps working and never hard-blocks the user on detection alone.
 */

/** Result of a single detection pass. Bounding box is normalised to 0–1. */
export interface FaceDetectionResult {
  detected: boolean;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
}

type FrameSource = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap;

const WASM_PATH = `${import.meta.env.BASE_URL}mediapipe/wasm`;
const MODEL_PATH = `${import.meta.env.BASE_URL}mediapipe/models/blaze_face_short_range.tflite`;

/** Floor passed to the model; callers apply their own per-step thresholds. */
const MODEL_CONFIDENCE_FLOOR = 0.2;

const NO_FACE: FaceDetectionResult = {
  detected: false,
  confidence: 0,
  boundingBox: { x: 0, y: 0, width: 0, height: 0 },
};

type DetectorState = 'unloaded' | 'loading' | 'ready' | 'failed';

let detector: FaceDetector | null = null;
let detectorState: DetectorState = 'unloaded';
let loadPromise: Promise<FaceDetector | null> | null = null;
let lastTimestamp = 0;

/** Throttle the DEV detection log so the hot preview loop doesn't flood console. */
let lastDetectLog = 0;
const DETECT_LOG_INTERVAL_MS = 1000;

/**
 * Human-readable description of the frame source, so the DEV log proves which
 * element MediaPipe actually analysed — it must always be the live <video>,
 * never an overlay thumbnail, reference <img>, badge or other DOM node.
 */
function describeSource(source: FrameSource): Record<string, unknown> {
  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    return {
      kind: 'HTMLVideoElement',
      className: source.className,
      id: source.id || null,
      currentSrc: source.currentSrc || null,
      hasStream: source.srcObject instanceof MediaStream,
      videoWidth: source.videoWidth,
      videoHeight: source.videoHeight,
    };
  }
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    return { kind: 'HTMLImageElement', className: source.className, src: source.src };
  }
  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    return { kind: 'HTMLCanvasElement', className: source.className };
  }
  return { kind: source?.constructor?.name ?? typeof source };
}

/** True unless the detector permanently failed to load. */
export function isFaceDetectionAvailable(): boolean {
  return detectorState !== 'failed';
}

/** Lazily create (or return) the shared detector. Resolves to null on failure. */
export function ensureFaceDetector(): Promise<FaceDetector | null> {
  if (detectorState === 'ready') return Promise.resolve(detector);
  if (detectorState === 'failed') return Promise.resolve(null);
  if (loadPromise) return loadPromise;

  detectorState = 'loading';
  loadPromise = (async () => {
    try {
      // Lazy-loaded so the (large) MediaPipe runtime is only fetched when a
      // step actually needs face detection — keeps initial load light.
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      detector = await FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH },
        runningMode: 'VIDEO',
        minDetectionConfidence: MODEL_CONFIDENCE_FLOOR,
      });
      detectorState = 'ready';
      return detector;
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[faceDetection] init failed; continuing without detection', err);
      }
      detectorState = 'failed';
      detector = null;
      return null;
    }
  })();

  return loadPromise;
}

/** Pick the highest-confidence detection that has a bounding box. */
function pickBest(detections: Detection[]): Detection | null {
  let best: Detection | null = null;
  let bestScore = -1;
  for (const d of detections) {
    if (!d.boundingBox) continue;
    const score = d.categories?.[0]?.score ?? 0;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

function runDetection(
  det: FaceDetector,
  source: FrameSource,
  width: number,
  height: number,
): FaceDetectionResult | null {
  if (width === 0 || height === 0) return null;

  // detectForVideo requires strictly increasing timestamps (ms).
  const timestamp = Math.max(lastTimestamp + 1, Math.round(performance.now()));
  lastTimestamp = timestamp;

  let result;
  try {
    result = det.detectForVideo(source, timestamp);
  } catch (err) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[faceDetection] detect error', err);
    }
    return null;
  }

  const best = pickBest(result.detections);

  if (import.meta.env.DEV) {
    const now = performance.now();
    if (now - lastDetectLog >= DETECT_LOG_INTERVAL_MS) {
      lastDetectLog = now;
      const bb = best?.boundingBox;
      // eslint-disable-next-line no-console
      console.debug('[faceDetection]', {
        // Proof of what was analysed: must be the live camera <video>, never an
        // overlay thumbnail / reference image / badge / label.
        source: describeSource(source),
        analyzedDimensions: { width, height },
        faceCount: result.detections.length,
        detected: !!best?.boundingBox,
        // Raw pixel box from the model (relative to the analysed video frame)…
        boundingBoxPx: bb
          ? { x: bb.originX, y: bb.originY, width: bb.width, height: bb.height }
          : null,
        // …and the normalised 0–1 box returned to callers.
        boundingBoxNorm: bb
          ? {
              x: bb.originX / width,
              y: bb.originY / height,
              width: bb.width / width,
              height: bb.height / height,
            }
          : null,
        confidence: best?.categories?.[0]?.score ?? 0,
      });
    }
  }

  if (!best || !best.boundingBox) return NO_FACE;

  const bb = best.boundingBox;
  return {
    detected: true,
    confidence: best.categories?.[0]?.score ?? 0,
    boundingBox: {
      x: bb.originX / width,
      y: bb.originY / height,
      width: bb.width / width,
      height: bb.height / height,
    },
  };
}

/**
 * Detect a face on a still source, loading the detector if needed.
 * Returns null when detection is unavailable.
 */
export async function detectFace(
  source: FrameSource,
  width: number,
  height: number,
): Promise<FaceDetectionResult | null> {
  const det = await ensureFaceDetector();
  if (!det) return null;
  return runDetection(det, source, width, height);
}

/**
 * Non-blocking detection for the hot preview loop: uses the already-loaded
 * detector and returns null if it isn't ready yet (call ensureFaceDetector
 * once up front to start loading).
 */
export function detectFaceSync(
  source: FrameSource,
  width: number,
  height: number,
): FaceDetectionResult | null {
  if (detectorState !== 'ready' || !detector) return null;
  return runDetection(detector, source, width, height);
}
