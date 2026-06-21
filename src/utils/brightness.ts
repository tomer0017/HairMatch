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

/** Fraction (0–1) of the shortest edges trimmed off to isolate the centre. */
const CENTER_CROP = 0.6; // analyse the central 60% of the frame

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
}

/** Full set of brightness metrics for the whole frame and its centre. */
export interface DarknessMetrics {
  overall: LuminanceStats;
  center: LuminanceStats;
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
    };
  }

  return {
    average: total / pixelCount,
    median: medianFromHistogram(histogram, pixelCount),
    darkPixelRatio: dark / pixelCount,
    veryDarkPixelRatio: veryDark / pixelCount,
    shadowClipRatio: shadowClipped / pixelCount,
  };
}

/**
 * Compute darkness metrics for the whole frame and its central crop.
 * All luminance values are on a 0–255 scale.
 */
export function calculateDarknessMetrics(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): DarknessMetrics {
  const overall = statsForRegion(data, width, 0, 0, width, height);

  // Central crop: keep CENTER_CROP of each edge, trimming equal margins.
  const marginX = Math.floor((width * (1 - CENTER_CROP)) / 2);
  const marginY = Math.floor((height * (1 - CENTER_CROP)) / 2);
  const center = statsForRegion(
    data,
    width,
    marginX,
    marginY,
    width - marginX,
    height - marginY,
  );

  return { overall, center };
}

/**
 * Share of pixels that are "blown out" (clipped near pure white), 0–1.
 * A high value indicates overexposure / direct sunlight washing out detail.
 */
export function calculateOverExposure(data: Uint8ClampedArray): number {
  let clipped = 0;
  const pixelCount = data.length / 4;
  const CLIP_THRESHOLD = 244; // near-white

  for (let i = 0; i < data.length; i += 4) {
    if (luminance(data[i], data[i + 1], data[i + 2]) >= CLIP_THRESHOLD) {
      clipped += 1;
    }
  }

  return clipped / pixelCount;
}
