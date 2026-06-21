import type { QualityResult, ValidationIssue } from '../types';
import { calculateDarknessMetrics, calculateOverExposure } from './brightness';
import { analyzeSharpness } from './sharpness';

/**
 * Local, in-browser image quality analysis.
 *
 * Everything here runs on a <canvas> against a downscaled copy of the photo —
 * no network, no upload, no persistence.
 *
 * We use two canvas sizes on purpose: a small one (ANALYSIS_SIZE) for the cheap
 * brightness/exposure histograms, and a larger one (SHARPNESS_SIZE) for blur
 * detection. Motion blur is a low-frequency effect that a heavy downscale
 * smooths away, so judging sharpness on the tiny canvas would let smeared
 * photos through.
 */

/** Longest edge (px) used for the brightness/exposure canvas. */
const ANALYSIS_SIZE = 480;

/** Longest edge (px) used for the (larger) blur-detection canvas. */
const SHARPNESS_SIZE = 1000;

/**
 * Tuning thresholds.
 *
 * Darkness is judged by several luminance metrics (0–255) rather than the
 * average alone, so a stray light source can't lift a shadowed subject past
 * validation. The image fails if ANY of these conditions hold.
 */
const THRESHOLDS = {
  darkness: {
    /** Fail if whole-frame mean luminance is below this. */
    averageBelow: 95,
    /** Fail if whole-frame median luminance is below this. */
    medianBelow: 85,
    /** Fail if more than this share of pixels are below luminance 70. */
    darkPixelRatioAbove: 0.45,
    /** Fail if more than this share of pixels are below luminance 50. */
    veryDarkPixelRatioAbove: 0.25,
    /** Fail if the central crop mean luminance is below this. */
    centerAverageBelow: 100,
    /** Fail if the central crop median luminance is below this. */
    centerMedianBelow: 90,
  },
  /** Above this share of blown-out pixels (0–1) the image is overexposed. */
  overExposureAbove: 0.35,
  /**
   * Blur is judged by two metrics on the larger canvas. The image is rejected
   * only when BOTH fall short — sharp photos reliably clear at least one, while
   * motion / defocus / smudge blur drags both down together. Tuned to favour
   * rejecting borderline shots; use the dev-mode logs below to recalibrate
   * against real device photos.
   */
  blur: {
    /** Below this Laplacian variance there is little high-frequency detail. */
    laplacianBelow: 130,
    /** Below this strong-edge density (0–1) the frame has few crisp edges. */
    edgeDensityBelow: 0.055,
  },
  /** Minimum original resolution on the shortest edge (px). */
  minShortEdge: 600,
};

const MESSAGES: Record<ValidationIssue['code'], string> = {
  dark: 'התמונה חשוכה מדי. עברי למקום מואר יותר וצלמי שוב.',
  bright: 'התמונה בהירה מדי. נסי להימנע משמש ישירה או תאורה חזקה.',
  blurry: 'התמונה מטושטשת מדי. אנא החזיקי את המצלמה יציבה וצלמי שוב.',
  resolution: 'איכות התמונה נמוכה מדי. אנא צלמי שוב.',
};

/**
 * Draw a bitmap onto a downscaled canvas (longest edge clamped to maxSize) and
 * return its pixel data + size.
 */
function readScaledPixels(
  source: ImageBitmap | HTMLImageElement,
  sourceWidth: number,
  sourceHeight: number,
  maxSize: number,
): { data: Uint8ClampedArray; width: number; height: number } {
  const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D context is not available in this browser.');
  }

  ctx.drawImage(source, 0, 0, width, height);
  return { data: ctx.getImageData(0, 0, width, height).data, width, height };
}

/** Decode a blob into an ImageBitmap, with a fallback for older Safari. */
async function decodeBlob(
  blob: Blob,
): Promise<{ source: ImageBitmap | HTMLImageElement; width: number; height: number }> {
  // createImageBitmap is the fast path and is widely supported.
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  }

  // Fallback: decode via an <img> element (older Safari).
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image for analysis.'));
    };
    img.src = url;
  });
}

/**
 * Analyse a captured photo blob and return whether it passes, along with a
 * list of any detected issues and the raw metrics.
 */
export async function analyzeImageQuality(blob: Blob): Promise<QualityResult> {
  const { source, width: srcW, height: srcH } = await decodeBlob(blob);

  // Brightness/exposure run on the small canvas; blur on the larger one.
  const small = readScaledPixels(source, srcW, srcH, ANALYSIS_SIZE);
  const large = readScaledPixels(source, srcW, srcH, SHARPNESS_SIZE);

  // Release the bitmap now that both canvases have been drawn.
  if ('close' in source && typeof source.close === 'function') {
    source.close();
  }

  const { overall, center } = calculateDarknessMetrics(small.data, small.width, small.height);
  const overExposure = calculateOverExposure(small.data);
  const { laplacianVariance, edgeDensity } = analyzeSharpness(
    large.data,
    large.width,
    large.height,
  );
  const shortEdge = Math.min(srcW, srcH);

  const d = THRESHOLDS.darkness;
  const tooDark =
    overall.average < d.averageBelow ||
    overall.median < d.medianBelow ||
    overall.darkPixelRatio > d.darkPixelRatioAbove ||
    overall.veryDarkPixelRatio > d.veryDarkPixelRatioAbove ||
    center.average < d.centerAverageBelow ||
    center.median < d.centerMedianBelow;

  // Reject only when BOTH blur metrics agree there is too little detail.
  const lapRatio = laplacianVariance / THRESHOLDS.blur.laplacianBelow;
  const edgeRatio = edgeDensity / THRESHOLDS.blur.edgeDensityBelow;
  const sharpnessScore = Math.max(lapRatio, edgeRatio); // < 1 ⇒ both fell short
  const blurry = sharpnessScore < 1;

  const issues: ValidationIssue[] = [];

  if (tooDark) {
    issues.push({ code: 'dark', message: MESSAGES.dark });
  }
  if (overExposure > THRESHOLDS.overExposureAbove) {
    issues.push({ code: 'bright', message: MESSAGES.bright });
  }
  if (blurry) {
    issues.push({ code: 'blurry', message: MESSAGES.blurry });
  }
  if (shortEdge < THRESHOLDS.minShortEdge) {
    issues.push({ code: 'resolution', message: MESSAGES.resolution });
  }

  const metrics = {
    averageLuminance: overall.average,
    medianLuminance: overall.median,
    darkPixelRatio: overall.darkPixelRatio,
    veryDarkPixelRatio: overall.veryDarkPixelRatio,
    centerAverageLuminance: center.average,
    centerMedianLuminance: center.median,
    overExposure,
    laplacianVariance,
    edgeDensity,
    width: srcW,
    height: srcH,
  };

  // Dev-only: surface the metrics that drove each decision.
  if (import.meta.env.DEV) {
    /* eslint-disable no-console */
    console.debug('[imageAnalysis] darkness metrics', {
      averageLuminance: metrics.averageLuminance,
      medianLuminance: metrics.medianLuminance,
      darkPixelRatio: metrics.darkPixelRatio,
      veryDarkPixelRatio: metrics.veryDarkPixelRatio,
      centerAverageLuminance: metrics.centerAverageLuminance,
      centerMedianLuminance: metrics.centerMedianLuminance,
      tooDark,
    });
    console.debug('[imageAnalysis] sharpness metrics', {
      laplacianVariance,
      edgeDensity,
      sharpnessScore, // normalised to the thresholds; < 1 ⇒ blurry
      blurry,
    });
    /* eslint-enable no-console */
  }

  return {
    passed: issues.length === 0,
    issues,
    metrics,
  };
}
