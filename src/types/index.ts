/**
 * Shared application types.
 */

/** A single guided capture step in the flow. */
export interface PhotoStep {
  /** Stable id, also used as the share filename base (e.g. "front"). */
  id: string;
  /** Hebrew label shown to the user (e.g. "מבט קדמי"). */
  label: string;
  /** Short Hebrew instruction for how to take the photo. */
  instruction: string;
  /** File name used when creating the shareable image (e.g. "front.jpg"). */
  fileName: string;
}

/** A captured photo, held only in React state — never uploaded or persisted. */
export interface CapturedPhoto {
  blob: Blob;
  /** Object URL for previewing the blob. Must be revoked when discarded. */
  url: string;
  width: number;
  height: number;
}

/** Severity of a validation message. */
export type ValidationLevel = 'error';

/** One detected quality problem with the captured image. */
export interface ValidationIssue {
  code: 'dark' | 'bright' | 'blurry' | 'resolution';
  message: string;
}

/** Raw numeric metrics produced by the analysis pass (useful for debugging). */
export interface QualityMetrics {
  /** Mean perceived luminance of the whole frame, 0–255 (Rec. 601). */
  averageLuminance: number;
  /** Median perceived luminance of the whole frame, 0–255. */
  medianLuminance: number;
  /** Share of frame pixels darker than the "dark" threshold, 0–1. */
  darkPixelRatio: number;
  /** Share of frame pixels darker than the "very dark" threshold, 0–1. */
  veryDarkPixelRatio: number;
  /** Mean perceived luminance of the central crop, 0–255. */
  centerAverageLuminance: number;
  /** Median perceived luminance of the central crop, 0–255. */
  centerMedianLuminance: number;
  overExposure: number;
  /** Laplacian variance (blur metric); higher = sharper. */
  laplacianVariance: number;
  /** Strong-edge density (blur metric), 0–1; higher = sharper. */
  edgeDensity: number;
  width: number;
  height: number;
}

/** Full result of analysing a captured image. */
export interface QualityResult {
  passed: boolean;
  issues: ValidationIssue[];
  metrics: QualityMetrics;
}

/** High-level screens of the application. */
export type AppScreen = 'landing' | 'capture' | 'review';
