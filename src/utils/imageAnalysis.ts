import type {
  LightingSource,
  QualityMetrics,
  QualityResult,
  StepValidationConfig,
  ValidationIssue,
} from '../types';
import { regionStats, type Rect } from './brightness';
import { detectFace, isFaceDetectionAvailable, type FaceDetectionResult } from './faceDetection';
import { centerPortraitRect, centerRect, faceHairRect } from './roi';
import { analyzeSharpness } from './sharpness';

/**
 * Local, in-browser image quality analysis.
 *
 * Everything here runs on a <canvas> against a downscaled copy of the photo —
 * no network, no upload, no persistence.
 *
 * Lighting is judged on the SUBJECT, not the whole frame: when a face/head is
 * detected we analyse a "face + hair" ROI; otherwise (back views, or no face)
 * we analyse the centre of the frame. This stops a dark background from
 * rejecting a well-lit person.
 *
 * We use two canvas sizes on purpose: a small one (ANALYSIS_SIZE) for the cheap
 * luminance histograms, and a larger one (SHARPNESS_SIZE) for blur detection —
 * motion blur is a low-frequency effect that a heavy downscale smooths away.
 */

/** Longest edge (px) used for the brightness/exposure canvas. */
const ANALYSIS_SIZE = 480;

/** Longest edge (px) used for the (larger) blur-detection canvas. */
const SHARPNESS_SIZE = 1000;

const THRESHOLDS = {
  /**
   * Darkness, judged on the ROI (subject). The image fails if ANY holds.
   * Values are 0–255 luminance / 0–1 ratios.
   */
  darkness: {
    averageBelow: 95,
    medianBelow: 85,
    darkPixelRatioAbove: 0.45,
    veryDarkPixelRatioAbove: 0.25,
  },
  /**
   * Overexposure now means white clipping AND loss of detail, so bright-but-
   * textured (e.g. blonde) hair stays valid. Fail only when a large share of
   * the ROI is clipped near pure white *and* the frame has little fine detail.
   */
  overExposure: {
    clipRatioAbove: 0.3,
    detailEdgeDensityBelow: 0.04,
  },
  /**
   * Blur is judged by two metrics on the larger canvas; rejected only when
   * BOTH fall short. Tuned to favour rejecting borderline shots — use the
   * dev-mode logs below to recalibrate against real device photos.
   */
  blur: {
    laplacianBelow: 130,
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
  person: 'לא זוהה אדם בתמונה. אנא מקמי את הראש והשיער מול המצלמה וצלמי שוב.',
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
 * Analyse a captured photo blob against the policy for its step. Returns
 * whether it passes, a single combined list of issues, and the raw metrics.
 */
export async function analyzeImageQuality(
  blob: Blob,
  config: StepValidationConfig,
): Promise<QualityResult> {
  const { source, width: srcW, height: srcH } = await decodeBlob(blob);

  // Run face detection only when the step actually needs it.
  let face: FaceDetectionResult | null = null;
  if (config.requireFace || config.lightingMode === 'face') {
    face = await detectFace(source, srcW, srcH);
  }

  // Brightness/exposure run on the small canvas; blur on the larger one.
  const small = readScaledPixels(source, srcW, srcH, ANALYSIS_SIZE);
  const large = readScaledPixels(source, srcW, srcH, SHARPNESS_SIZE);

  // Release the bitmap now that detection + both canvases are done.
  if ('close' in source && typeof source.close === 'function') {
    source.close();
  }

  const faceAccepted =
    !!face && face.detected && face.confidence >= config.faceConfidenceMin && face.boundingBox.width > 0;

  // Choose the ROI for lighting analysis. Priority for face steps:
  //   1) faceHairROI (face detected)
  //   2) centerPortraitROI (face not detected / detection unavailable)
  // so a dark background never dominates a well-lit subject.
  let lightingSource: LightingSource;
  let rect: Rect;
  if (config.lightingMode === 'face' && faceAccepted) {
    rect = faceHairRect(face!.boundingBox, small.width, small.height);
    lightingSource = 'faceROI';
  } else if (config.lightingMode === 'face') {
    rect = centerPortraitRect(small.width, small.height);
    lightingSource = 'centerPortraitROI';
  } else {
    rect = centerRect(small.width, small.height, 0.65);
    lightingSource = 'centerROI';
  }

  const roi = regionStats(small.data, small.width, small.height, rect);
  const { laplacianVariance, edgeDensity } = analyzeSharpness(
    large.data,
    large.width,
    large.height,
  );
  const shortEdge = Math.min(srcW, srcH);

  const d = THRESHOLDS.darkness;
  const tooDark =
    roi.average < d.averageBelow ||
    roi.median < d.medianBelow ||
    roi.darkPixelRatio > d.darkPixelRatioAbove ||
    roi.veryDarkPixelRatio > d.veryDarkPixelRatioAbove;

  // Overexposed only when a lot of the ROI is clipped white AND detail is lost.
  const overexposed =
    roi.overExposedRatio > THRESHOLDS.overExposure.clipRatioAbove &&
    edgeDensity < THRESHOLDS.overExposure.detailEdgeDensityBelow;

  // Reject blur only when BOTH metrics agree there is too little detail.
  const lapRatio = laplacianVariance / THRESHOLDS.blur.laplacianBelow;
  const edgeRatio = edgeDensity / THRESHOLDS.blur.edgeDensityBelow;
  const sharpnessScore = Math.max(lapRatio, edgeRatio); // < 1 ⇒ both fell short
  const blurry = sharpnessScore < 1;

  // Person required but absent — only when detection actually ran & is available.
  const personMissing = config.requireFace && isFaceDetectionAvailable() && !faceAccepted;

  const issues: ValidationIssue[] = [];
  if (personMissing) issues.push({ code: 'person', message: MESSAGES.person });
  if (tooDark) issues.push({ code: 'dark', message: MESSAGES.dark });
  if (overexposed) issues.push({ code: 'bright', message: MESSAGES.bright });
  if (blurry) issues.push({ code: 'blurry', message: MESSAGES.blurry });
  if (shortEdge < THRESHOLDS.minShortEdge) {
    issues.push({ code: 'resolution', message: MESSAGES.resolution });
  }

  const metrics: QualityMetrics = {
    faceDetected: faceAccepted,
    faceConfidence: face?.confidence ?? 0,
    lightingSource,
    roiAverageLuminance: roi.average,
    roiMedianLuminance: roi.median,
    roiDarkPixelRatio: roi.darkPixelRatio,
    roiVeryDarkPixelRatio: roi.veryDarkPixelRatio,
    roiOverexposedPixelRatio: roi.overExposedRatio,
    laplacianVariance,
    edgeDensity,
    width: srcW,
    height: srcH,
  };

  const passed = issues.length === 0;

  // Dev-only: a single line with everything that drove the decision.
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[imageAnalysis]', {
      stepId: config.stepId,
      faceDetected: faceAccepted,
      confidenceScore: metrics.faceConfidence,
      lightingSource,
      roiAverageLuminance: roi.average,
      roiMedianLuminance: roi.median,
      roiDarkPixelRatio: roi.darkPixelRatio,
      roiOverexposedPixelRatio: roi.overExposedRatio,
      laplacianVariance,
      edgeDensity,
      sharpnessScore,
      finalValidationDecision: passed ? 'PASS' : 'FAIL',
    });
  }

  return { passed, issues, metrics };
}
