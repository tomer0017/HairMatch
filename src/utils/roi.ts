import type { Rect } from './brightness';

/**
 * Region-of-interest helpers for subject-focused analysis.
 *
 * Lighting is judged on the subject, not the background: when a face/head is
 * detected we expand its box to include nearby hair (faceHairRect); otherwise
 * (e.g. back-of-head shots) we fall back to the centre of the frame.
 */

/** Normalised (0–1) bounding box, as produced by the face detector. */
export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Expand a detected face box into a "face + hair" ROI: +30% upward (hairline /
 * crown), +30% left and +30% right (side hair). The bottom is left as-is.
 * Returns a pixel-space rect clamped to the frame.
 */
export function faceHairRect(box: NormalizedBox, frameW: number, frameH: number): Rect {
  const bx = box.x * frameW;
  const by = box.y * frameH;
  const bw = box.width * frameW;
  const bh = box.height * frameH;

  return clampRect(
    {
      x0: bx - 0.3 * bw,
      y0: by - 0.3 * bh,
      x1: bx + bw + 0.3 * bw,
      y1: by + bh,
    },
    frameW,
    frameH,
  );
}

/** Central crop covering `fraction` of each edge (default 65%). */
export function centerRect(frameW: number, frameH: number, fraction = 0.65): Rect {
  const marginX = (frameW * (1 - fraction)) / 2;
  const marginY = (frameH * (1 - fraction)) / 2;
  return clampRect(
    { x0: marginX, y0: marginY, x1: frameW - marginX, y1: frameH - marginY },
    frameW,
    frameH,
  );
}

function clampRect(rect: Rect, frameW: number, frameH: number): Rect {
  return {
    x0: Math.max(0, Math.floor(rect.x0)),
    y0: Math.max(0, Math.floor(rect.y0)),
    x1: Math.min(frameW, Math.ceil(rect.x1)),
    y1: Math.min(frameH, Math.ceil(rect.y1)),
  };
}
