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
  code: 'dark' | 'bright' | 'blurry' | 'resolution' | 'person';
  message: string;
}

/** Where the lighting metrics were measured. */
export type LightingSource = 'faceROI' | 'centerROI' | 'wholeFrame';

/**
 * Per-step validation policy. Profiles use a lower face-confidence floor since
 * hair often covers part of the face; back views skip face detection entirely.
 */
export interface StepValidationConfig {
  stepId: string;
  /** Require a detected face/head to pass (front + profiles). */
  requireFace: boolean;
  /** Minimum detector confidence to accept a face for this step. */
  faceConfidenceMin: number;
  /** 'face' uses the face ROI when found (else centre); 'center' always centre. */
  lightingMode: 'face' | 'center';
}

/** Raw numeric metrics produced by the analysis pass (useful for debugging). */
export interface QualityMetrics {
  /** Whether a face/head was accepted for this step. */
  faceDetected: boolean;
  /** Detector confidence for the chosen face, 0–1. */
  faceConfidence: number;
  /** Which region the lighting metrics came from. */
  lightingSource: LightingSource;
  /** Mean perceived luminance inside the ROI, 0–255 (Rec. 601). */
  roiAverageLuminance: number;
  /** Median perceived luminance inside the ROI, 0–255. */
  roiMedianLuminance: number;
  /** Share of ROI pixels darker than the "dark" threshold, 0–1. */
  roiDarkPixelRatio: number;
  /** Share of ROI pixels darker than the "very dark" threshold, 0–1. */
  roiVeryDarkPixelRatio: number;
  /** Share of ROI pixels clipped near pure white, 0–1. */
  roiOverexposedPixelRatio: number;
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
