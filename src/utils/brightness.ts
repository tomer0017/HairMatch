/**
 * Brightness & exposure metrics computed from raw pixel data.
 *
 * Browser note: all analysis runs locally on a <canvas>. Nothing is uploaded.
 * We operate on perceived luminance (Rec. 601 weighting) rather than a raw
 * average of channels, which matches human perception more closely.
 */

/** Perceived luminance of a single pixel (0–255). */
function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Average perceived brightness across all pixels, normalised to 0–1.
 * 0 = pure black, 1 = pure white.
 */
export function calculateBrightness(data: Uint8ClampedArray): number {
  let total = 0;
  const pixelCount = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    total += luminance(data[i], data[i + 1], data[i + 2]);
  }

  return total / pixelCount / 255;
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
