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
  brightness: number;
  overExposure: number;
  sharpness: number;
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
