import type { StepValidationConfig } from '../types';

/**
 * Per-step validation policy, keyed by PhotoStep id.
 *
 * - Front: a face must be detected (standard confidence).
 * - Profiles: a face must be detected, but with a lower confidence floor —
 *   hair frequently covers the forehead / cheek / eye / jawline.
 * - Back / top views: no face exists, so face detection is skipped and lighting
 *   is measured on the centre of the frame.
 */
const STEP_VALIDATION: Record<string, StepValidationConfig> = {
  front: { stepId: 'front', requireFace: true, faceConfidenceMin: 0.5, lightingMode: 'face' },
  'right-profile': {
    stepId: 'right-profile',
    requireFace: true,
    faceConfidenceMin: 0.25,
    lightingMode: 'face',
  },
  'left-profile': {
    stepId: 'left-profile',
    requireFace: true,
    faceConfidenceMin: 0.25,
    lightingMode: 'face',
  },
  back: { stepId: 'back', requireFace: false, faceConfidenceMin: 0, lightingMode: 'center' },
  // Same policy as the standard back view — natural light is requested through
  // guidance only; a browser camera can't verify the light source.
  'back-daylight': {
    stepId: 'back-daylight',
    requireFace: false,
    faceConfidenceMin: 0,
    lightingMode: 'center',
  },
  top: { stepId: 'top', requireFace: false, faceConfidenceMin: 0, lightingMode: 'center' },
};

/** Validation policy for a step id, defaulting to a lenient centre-frame check. */
export function getStepValidation(stepId: string): StepValidationConfig {
  return (
    STEP_VALIDATION[stepId] ?? {
      stepId,
      requireFace: false,
      faceConfidenceMin: 0,
      lightingMode: 'center',
    }
  );
}
