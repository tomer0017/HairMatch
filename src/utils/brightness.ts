/**
 * Brightness & exposure metrics computed from raw pixel data.
 *
 * Browser note: all analysis runs locally on a <canvas>. Nothing is uploaded.
 * We operate on perceived luminance (Rec. 601 weighting) rather than a raw
 * average of channels, which matches human perception more closely.
 *
 * Darkness can't be judged by the average alone: a single bright window or
 * lamp can lift the mean while the subject stays in shadow. We therefore look
 * at several complementary metrics (average, median, dark-pixel ratios, shadow
 * clipping) and weight the centre of the frame, where the subject is expected
 * to be.
 */

/** Perceived luminance of a single pixel (0–255, Rec. 601). */
function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Luminance thresholds (0–255) used by the darkness metrics. */
const DARK_PIXEL_THRESHOLD = 70; // "dark" pixel
const VERY_DARK_PIXEL_THRESHOLD = 50; // "very dark" pixel
const SHADOW_CLIP_THRESHOLD = 16; // crushed-to-black shadow
const OVEREXPOSED_PIXEL_THRESHOLD = 244; // blown-out / clipped-white pixel

/** Aggregate luminance statistics for a region of pixels. */
export interface LuminanceStats {
  /** Mean perceived luminance, 0–255. */
  average: number;
  /** Median perceived luminance, 0–255. */
  median: number;
  /** Share of pixels darker than DARK_PIXEL_THRESHOLD, 0–1. */
  darkPixelRatio: number;
  /** Share of pixels darker than VERY_DARK_PIXEL_THRESHOLD, 0–1. */
  veryDarkPixelRatio: number;
  /** Share of pixels crushed into near-black shadow, 0–1. */
  shadowClipRatio: number;
  /** Share of pixels clipped near pure white, 0–1. */
  overExposedRatio: number;
}

/** A pixel-space rectangle, half-open: [x0, x1) × [y0, y1). */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Find the median from a 256-bin luminance histogram. */
function medianFromHistogram(histogram: number[], pixelCount: number): number {
  if (pixelCount === 0) return 0;
  const half = pixelCount / 2;
  let cumulative = 0;
  for (let level = 0; level < 256; level += 1) {
    cumulative += histogram[level];
    if (cumulative >= half) return level;
  }
  return 255;
}

/**
 * Walk a rectangular region of an RGBA buffer and accumulate luminance stats.
 * The region is [x0, x1) × [y0, y1) in pixel coordinates.
 */
function statsForRegion(
  data: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): LuminanceStats {
  const histogram = new Array<number>(256).fill(0);
  let total = 0;
  let dark = 0;
  let veryDark = 0;
  let shadowClipped = 0;
  let overExposed = 0;
  let pixelCount = 0;

  for (let y = y0; y < y1; y += 1) {
    let i = (y * width + x0) * 4;
    for (let x = x0; x < x1; x += 1, i += 4) {
      const y601 = luminance(data[i], data[i + 1], data[i + 2]);
      total += y601;
      histogram[Math.round(y601)] += 1;
      if (y601 < DARK_PIXEL_THRESHOLD) dark += 1;
      if (y601 < VERY_DARK_PIXEL_THRESHOLD) veryDark += 1;
      if (y601 < SHADOW_CLIP_THRESHOLD) shadowClipped += 1;
      if (y601 >= OVEREXPOSED_PIXEL_THRESHOLD) overExposed += 1;
      pixelCount += 1;
    }
  }

  if (pixelCount === 0) {
    return {
      average: 0,
      median: 0,
      darkPixelRatio: 0,
      veryDarkPixelRatio: 0,
      shadowClipRatio: 0,
      overExposedRatio: 0,
    };
  }

  return {
    average: total / pixelCount,
    median: medianFromHistogram(histogram, pixelCount),
    darkPixelRatio: dark / pixelCount,
    veryDarkPixelRatio: veryDark / pixelCount,
    shadowClipRatio: shadowClipped / pixelCount,
    overExposedRatio: overExposed / pixelCount,
  };
}

/**
 * Luminance stats for an arbitrary ROI (clamped to the buffer bounds), on a
 * 0–255 scale. Used for subject-focused (faceROI / centerROI) analysis.
 */
export function regionStats(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  rect: Rect,
): LuminanceStats {
  const x0 = Math.max(0, Math.min(width, Math.floor(rect.x0)));
  const y0 = Math.max(0, Math.min(height, Math.floor(rect.y0)));
  const x1 = Math.max(x0, Math.min(width, Math.ceil(rect.x1)));
  const y1 = Math.max(y0, Math.min(height, Math.ceil(rect.y1)));
  return statsForRegion(data, width, x0, y0, x1, y1);
}

/** Lightweight luminance metrics for the live camera preview. */
export interface LiveLightingMetrics {
  /** Mean perceived luminance, 0–255. */
  average: number;
  /** Median perceived luminance, 0–255. */
  median: number;
  /** Share of pixels darker than DARK_PIXEL_THRESHOLD, 0–1. */
  darkPixelRatio: number;
  /** Share of pixels darker than VERY_DARK_PIXEL_THRESHOLD, 0–1. */
  veryDarkPixelRatio: number;
  /** Share of pixels clipped near pure white, 0–1. */
  overExposedRatio: number;
}

/**
 * Single-pass luminance metrics for the live preview. Kept deliberately cheap
 * (one loop, a histogram for the median) so it can run a few times per second
 * on a small sampled frame without janking the camera.
 */
export function calculateLightingMetrics(data: Uint8ClampedArray): LiveLightingMetrics {
  const histogram = new Array<number>(256).fill(0);
  const pixelCount = data.length / 4;
  let total = 0;
  let dark = 0;
  let veryDark = 0;
  let overExposed = 0;

  for (let i = 0; i < data.length; i += 4) {
    const y601 = luminance(data[i], data[i + 1], data[i + 2]);
    total += y601;
    histogram[Math.round(y601)] += 1;
    if (y601 < DARK_PIXEL_THRESHOLD) dark += 1;
    if (y601 < VERY_DARK_PIXEL_THRESHOLD) veryDark += 1;
    if (y601 >= OVEREXPOSED_PIXEL_THRESHOLD) overExposed += 1;
  }

  if (pixelCount === 0) {
    return {
      average: 0,
      median: 0,
      darkPixelRatio: 0,
      veryDarkPixelRatio: 0,
      overExposedRatio: 0,
    };
  }

  return {
    average: total / pixelCount,
    median: medianFromHistogram(histogram, pixelCount),
    darkPixelRatio: dark / pixelCount,
    veryDarkPixelRatio: veryDark / pixelCount,
    overExposedRatio: overExposed / pixelCount,
  };
}
