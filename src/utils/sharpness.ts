/**
 * Blur detection via two complementary edge metrics.
 *
 * 1. Laplacian variance — a focused image has lots of high-frequency detail
 *    (strong edges), so the Laplacian (a second-derivative operator) produces a
 *    wide spread of values -> high variance. A blurry image is smooth -> low
 *    variance.
 *
 * 2. Sobel edge density — the share of pixels whose first-derivative gradient
 *    magnitude crosses an "is this a real edge" threshold. Motion / defocus
 *    blur smears edges below that threshold, collapsing the density.
 *
 * Two metrics catch failure modes a single one misses: flat-but-noisy frames
 * can fake a Laplacian score, while low-texture-but-sharp frames can fake a low
 * one. The caller fails an image only when BOTH agree detail is missing.
 *
 * Browser note: these are heuristics, not guarantees. Run them on a reasonably
 * large copy of the image — motion blur is a low-frequency effect that a heavy
 * downscale smooths away, hiding the very blur we want to catch.
 */

/** Sobel gradient magnitude above which a pixel counts as a real edge. */
const EDGE_MAGNITUDE_THRESHOLD = 70;

/** Raw, un-thresholded sharpness measurements for an image. */
export interface SharpnessMetrics {
  /** Variance of the Laplacian over the grayscale image. Higher = sharper. */
  laplacianVariance: number;
  /** Share of pixels that are strong Sobel edges, 0–1. Higher = sharper. */
  edgeDensity: number;
}

/**
 * Compute both blur metrics in a single pass over a grayscale version of the
 * image. Input is RGBA pixel data plus its dimensions.
 */
export function analyzeSharpness(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): SharpnessMetrics {
  // Convert to a single-channel grayscale buffer first (Rec. 601 weighting).
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  let sum = 0;
  let sumSq = 0;
  let count = 0;
  let edges = 0;

  // Skip the 1px border where the 3x3 kernels would read out of bounds.
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;

      const tl = gray[idx - width - 1];
      const t = gray[idx - width];
      const tr = gray[idx - width + 1];
      const l = gray[idx - 1];
      const c = gray[idx];
      const r = gray[idx + 1];
      const bl = gray[idx + width - 1];
      const b = gray[idx + width];
      const br = gray[idx + width + 1];

      // 3x3 Laplacian:  0 1 0 / 1 -4 1 / 0 1 0
      const laplace = t + b + l + r - 4 * c;
      sum += laplace;
      sumSq += laplace * laplace;

      // 3x3 Sobel gradients.
      const gx = tr + 2 * r + br - (tl + 2 * l + bl);
      const gy = bl + 2 * b + br - (tl + 2 * t + tr);
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      if (magnitude > EDGE_MAGNITUDE_THRESHOLD) edges += 1;

      count += 1;
    }
  }

  if (count === 0) {
    return { laplacianVariance: 0, edgeDensity: 0 };
  }

  const mean = sum / count;
  const laplacianVariance = sumSq / count - mean * mean;
  const edgeDensity = edges / count;

  return { laplacianVariance, edgeDensity };
}
