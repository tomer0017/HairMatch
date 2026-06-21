/**
 * Blur detection via Laplacian variance.
 *
 * A focused image has lots of high-frequency detail (strong edges), so the
 * Laplacian (a second-derivative edge operator) produces a wide spread of
 * values -> high variance. A blurry image is smooth -> low variance.
 *
 * Browser note: this is a heuristic, not a guarantee. Lighting, texture and
 * subject distance all affect the score, so the threshold in imageAnalysis is
 * deliberately forgiving to avoid frustrating false rejections.
 */

/**
 * Compute the variance of the Laplacian over a grayscale version of the image.
 * Higher = sharper. Input is RGBA pixel data plus its dimensions.
 */
export function calculateSharpness(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  // Convert to a single-channel grayscale buffer first.
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // 3x3 Laplacian kernel:  0  1  0 / 1 -4 1 / 0  1  0
  // Skip the 1px border where the kernel would read out of bounds.
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const laplace =
        gray[idx - width] +
        gray[idx + width] +
        gray[idx - 1] +
        gray[idx + 1] -
        4 * gray[idx];

      sum += laplace;
      sumSq += laplace * laplace;
      count += 1;
    }
  }

  if (count === 0) return 0;

  const mean = sum / count;
  return sumSq / count - mean * mean;
}
