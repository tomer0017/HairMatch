import type { QualityResult, ValidationIssue } from '../types';
import { calculateDarknessMetrics, calculateOverExposure } from './brightness';
import { calculateSharpness } from './sharpness';

/**
 * Local, in-browser image quality analysis.
 *
 * Everything here runs on a <canvas> against a downscaled copy of the photo —
 * no network, no upload, no persistence. The downscale (ANALYSIS_SIZE) keeps
 * the pixel loops fast on mobile while preserving enough detail for the
 * brightness/exposure/blur heuristics.
 */

/** Longest edge (px) used for the analysis canvas. */
const ANALYSIS_SIZE = 480;

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
  /** Below this Laplacian variance the image is considered blurry. */
  sharpnessBelow: 60,
  /** Minimum original resolution on the shortest edge (px). */
  minShortEdge: 600,
};

const MESSAGES: Record<ValidationIssue['code'], string> = {
  dark: 'התמונה חשוכה מדי. עברי למקום מואר יותר וצלמי שוב.',
  bright: 'התמונה בהירה מדי. נסי להימנע משמש ישירה או תאורה חזקה.',
  blurry: 'התמונה מטושטשת. נקי את העדשה וצלמי שוב.',
  resolution: 'איכות התמונה נמוכה מדי. אנא צלמי שוב.',
};

/** Draw a bitmap onto a downscaled canvas and return its 2D context + size. */
function createAnalysisCanvas(
  source: ImageBitmap | HTMLImageElement,
  sourceWidth: number,
  sourceHeight: number,
): { ctx: CanvasRenderingContext2D; width: number; height: number } {
  const scale = Math.min(1, ANALYSIS_SIZE / Math.max(sourceWidth, sourceHeight));
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
  return { ctx, width, height };
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
  const { ctx, width, height } = createAnalysisCanvas(source, srcW, srcH);

  // Release the bitmap as soon as it is drawn.
  if ('close' in source && typeof source.close === 'function') {
    source.close();
  }

  const { data } = ctx.getImageData(0, 0, width, height);

  const { overall, center } = calculateDarknessMetrics(data, width, height);
  const overExposure = calculateOverExposure(data);
  const sharpness = calculateSharpness(data, width, height);
  const shortEdge = Math.min(srcW, srcH);

  const d = THRESHOLDS.darkness;
  const tooDark =
    overall.average < d.averageBelow ||
    overall.median < d.medianBelow ||
    overall.darkPixelRatio > d.darkPixelRatioAbove ||
    overall.veryDarkPixelRatio > d.veryDarkPixelRatioAbove ||
    center.average < d.centerAverageBelow ||
    center.median < d.centerMedianBelow;

  const issues: ValidationIssue[] = [];

  if (tooDark) {
    issues.push({ code: 'dark', message: MESSAGES.dark });
  }
  if (overExposure > THRESHOLDS.overExposureAbove) {
    issues.push({ code: 'bright', message: MESSAGES.bright });
  }
  if (sharpness < THRESHOLDS.sharpnessBelow) {
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
    sharpness,
    width: srcW,
    height: srcH,
  };

  // Dev-only: surface the darkness metrics that drove the decision.
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[imageAnalysis] darkness metrics', {
      averageLuminance: metrics.averageLuminance,
      medianLuminance: metrics.medianLuminance,
      darkPixelRatio: metrics.darkPixelRatio,
      veryDarkPixelRatio: metrics.veryDarkPixelRatio,
      centerAverageLuminance: metrics.centerAverageLuminance,
      centerMedianLuminance: metrics.centerMedianLuminance,
      tooDark,
    });
  }

  return {
    passed: issues.length === 0,
    issues,
    metrics,
  };
}
