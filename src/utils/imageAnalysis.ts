import type { QualityResult, ValidationIssue } from '../types';
import { calculateBrightness, calculateOverExposure } from './brightness';
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

/** Tuning thresholds. Deliberately forgiving to avoid false rejections. */
const THRESHOLDS = {
  /** Below this average brightness (0–1) the image is too dark. */
  darkBelow: 0.22,
  /** Above this share of blown-out pixels (0–1) the image is overexposed. */
  overExposureAbove: 0.35,
  /** Below this Laplacian variance the image is considered blurry. */
  sharpnessBelow: 60,
  /** Minimum original resolution on the shortest edge (px). */
  minShortEdge: 600,
};

const MESSAGES: Record<ValidationIssue['code'], string> = {
  dark: 'תמונה חשוכה מדי. אנא עברי למקום מואר יותר וצלמי שוב.',
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

  const brightness = calculateBrightness(data);
  const overExposure = calculateOverExposure(data);
  const sharpness = calculateSharpness(data, width, height);
  const shortEdge = Math.min(srcW, srcH);

  const issues: ValidationIssue[] = [];

  if (brightness < THRESHOLDS.darkBelow) {
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

  return {
    passed: issues.length === 0,
    issues,
    metrics: { brightness, overExposure, sharpness, width: srcW, height: srcH },
  };
}
