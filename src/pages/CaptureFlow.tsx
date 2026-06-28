import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraCapture } from '../components/CameraCapture';
import { LightingWarning } from '../components/LightingStatus';
import { PhotoInstructions } from '../components/PhotoInstructions';
import { ProgressBar } from '../components/ProgressBar';
import { QualityFeedback } from '../components/QualityFeedback';
import { useCamera } from '../hooks/useCamera';
import { useLiveLighting } from '../hooks/useLiveLighting';
import { usePhotoValidation } from '../hooks/usePhotoValidation';
import { getStepValidation } from '../config/validation';
import type { CapturedPhoto, PhotoStep } from '../types';
import photographyGuide from '../assets/Photography Guide.jpg';
import './CaptureFlow.css';

interface CaptureFlowProps {
  steps: PhotoStep[];
  /** Where to begin — 0 for the full sequence, or a specific index on retake. */
  startIndex: number;
  /** 'sequential' walks all remaining steps; 'single' captures one and exits. */
  mode: 'sequential' | 'single';
  /** Persist a confirmed photo into app state. */
  onConfirm: (stepId: string, photo: CapturedPhoto) => void;
  /** Finished the sequence (or the single retake) — move to review. */
  onExit: () => void;
  /** Cancel out of the very first step back to the welcome screen. */
  onBackToLanding: () => void;
}

/**
 * Drives the guided capture experience one step at a time while keeping the
 * camera stream alive across steps. Handles capture, local validation, retake
 * and the gated "continue" action.
 */
export function CaptureFlow({
  steps,
  startIndex,
  mode,
  onConfirm,
  onExit,
  onBackToLanding,
}: CaptureFlowProps) {
  const { videoRef, status, errorKind, facing, start, switchCamera, capture } = useCamera();
  const { analyzing, result, validate, reset } = usePhotoValidation();

  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [captured, setCaptured] = useState<CapturedPhoto | null>(null);
  // Whether the brief front-step intro guide is currently animating on screen.
  const [faceGuideVisible, setFaceGuideVisible] = useState(false);
  // Whether the large angle demonstration is playing before it shrinks into
  // the corner thumbnail (plays once per step when the live preview opens).
  const [angleDemoVisible, setAngleDemoVisible] = useState(false);
  // The back view needs a second person to take it, so an extra guidance popup
  // is shown before its capture screen. Dismissed via its "המשך" button.
  const [backGuideDismissed, setBackGuideDismissed] = useState(false);

  const step = steps[currentIndex];
  const stepValidation = getStepValidation(step.id);
  // Show the helper popup before the back-view capture screen (and not once a
  // photo for that step has already been taken). Additive to existing guidance.
  const showBackGuide = step.id === 'back' && !backGuideDismissed && !captured;
  // The front portrait step gets the brief Face ID-style intro guide + live
  // face indicator. The guide only plays momentarily, then frees up the frame.
  const isFrontStep = step.id === 'front';

  /** Total on-screen lifetime of the intro guide (matches the CSS animation). */
  const FACE_GUIDE_MS = 1800;

  // Play the intro guide once each time the live preview opens on the front
  // step. It fades in, pulses, then unmounts — leaving the user free to frame
  // the full hair. Face detection + lighting validation keep running after.
  useEffect(() => {
    if (!isFrontStep || status !== 'ready' || captured !== null) {
      setFaceGuideVisible(false);
      return;
    }
    setFaceGuideVisible(true);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[captureFlow]', {
        stepId: step.id,
        activeFacingMode: facing,
        overlayAnimationShown: true,
      });
    }
    const id = window.setTimeout(() => setFaceGuideVisible(false), FACE_GUIDE_MS);
    return () => window.clearTimeout(id);
  }, [isFrontStep, status, captured, step.id, facing]);

  /** On-screen lifetime of the large angle demo (matches the CSS animation). */
  const ANGLE_DEMO_MS = 1100;

  // Play the large angle demonstration each time the live preview opens on a
  // step (new step or after a retake). It fades in, holds, then shrinks into
  // the corner thumbnail — which stays put for the rest of the capture.
  useEffect(() => {
    if (status !== 'ready' || captured !== null) {
      setAngleDemoVisible(false);
      return;
    }
    setAngleDemoVisible(true);
    const id = window.setTimeout(() => setAngleDemoVisible(false), ANGLE_DEMO_MS);
    return () => window.clearTimeout(id);
  }, [status, captured, step.id]);

  // Analyse the live preview while it's on screen (no frozen still showing).
  // Face-required steps measure lighting on the subject (face + hair ROI).
  const { state: lightingState, faceDetected } = useLiveLighting(
    videoRef,
    status === 'ready' && captured === null,
    { useFace: stepValidation.requireFace, stepId: step.id, facing },
  );
  // Block capture while the scene is too dark or overexposed (red states).
  const lightingBlocked = lightingState === 'dark' || lightingState === 'bright';

  // Hold the temp object URL of an unconfirmed capture so we can revoke it.
  const pendingUrlRef = useRef<string | null>(null);

  // Start the camera once on mount — we arrive here from a user gesture
  // (the "התחילי" or "צלמי מחדש" tap), so permission can be requested now.
  useEffect(() => {
    void start();
  }, [start]);

  const clearPending = useCallback(() => {
    if (pendingUrlRef.current) {
      URL.revokeObjectURL(pendingUrlRef.current);
      pendingUrlRef.current = null;
    }
  }, []);

  // Revoke any leftover temp URL when unmounting.
  useEffect(() => clearPending, [clearPending]);

  const handleCapture = useCallback(async () => {
    // Guard against capturing while lighting blocks it (e.g. via keyboard).
    if (lightingBlocked) return;
    const frame = await capture();
    if (!frame) return;

    const url = URL.createObjectURL(frame.blob);
    pendingUrlRef.current = url;

    const photo: CapturedPhoto = {
      blob: frame.blob,
      url,
      width: frame.width,
      height: frame.height,
    };
    setCaptured(photo);
    await validate(frame.blob, stepValidation);
  }, [capture, validate, lightingBlocked, stepValidation]);

  const handleRetake = useCallback(() => {
    clearPending();
    setCaptured(null);
    reset();
  }, [clearPending, reset]);

  const goToStep = useCallback(
    (index: number) => {
      // The confirmed photo's URL now belongs to app state — don't revoke it.
      pendingUrlRef.current = null;
      setCaptured(null);
      reset();
      // Re-arm the back-view popup so it shows again on each entry to that step.
      setBackGuideDismissed(false);
      setCurrentIndex(index);
    },
    [reset],
  );

  const handleContinue = useCallback(() => {
    if (!captured || !result?.passed) return;
    onConfirm(step.id, captured);

    const isLast = currentIndex >= steps.length - 1;
    if (mode === 'single' || isLast) {
      pendingUrlRef.current = null;
      onExit();
      return;
    }
    goToStep(currentIndex + 1);
  }, [captured, result, onConfirm, step, currentIndex, steps.length, mode, onExit, goToStep]);

  const handleBack = useCallback(() => {
    if (mode === 'single') {
      // Cancel the retake and keep the previously stored photo.
      onExit();
      return;
    }
    if (currentIndex > 0) {
      goToStep(currentIndex - 1);
      return;
    }
    onBackToLanding();
  }, [mode, currentIndex, goToStep, onExit, onBackToLanding]);

  const canContinue = Boolean(captured && result?.passed && !analyzing);
  const continueLabel =
    mode === 'single'
      ? 'שמרי וחזרי'
      : currentIndex >= steps.length - 1
        ? 'סיום וצפייה בתמונות'
        : 'המשיכי';

  return (
    <div className="capture fade-in">
      <div className="capture__topbar">
        <button
          type="button"
          className="capture__back"
          onClick={handleBack}
          aria-label="חזרה"
        >
          <span aria-hidden="true">›</span>
        </button>
        <ProgressBar current={currentIndex + 1} total={steps.length} />
      </div>

      {/* Keyed so only the instruction block re-animates on step change —
          the <video> element below stays mounted so the stream is preserved. */}
      <div className="fade-in" key={step.id}>
        <PhotoInstructions step={step} />
      </div>

      {/* Gentle professional tip: a bright background improves how clearly the
          hair's shape, length, colour and texture come through. */}
      <p className="capture__tip">
        <span className="capture__tip-icon" aria-hidden="true">
          💡
        </span>
        לתוצאה מדויקת, הצטלמי בתאורה ברורה ועם רקע בהיר מאחור
      </p>

      <CameraCapture
        videoRef={videoRef}
        status={status}
        errorKind={errorKind}
        capturedUrl={captured?.url ?? null}
        lightingState={lightingState}
        showFaceGuide={isFrontStep && faceGuideVisible}
        faceDetected={isFrontStep ? faceDetected : null}
        angleStepId={step.id}
        angleLabel={step.label}
        showAngleDemo={angleDemoVisible}
        onCapture={() => void handleCapture()}
        captureDisabled={lightingBlocked}
        onSwitchCamera={() => void switchCamera()}
        switchDisabled={status === 'requesting'}
        onRetake={captured ? handleRetake : undefined}
        onContinue={captured ? handleContinue : undefined}
        continueLabel={continueLabel}
        continueDisabled={!canContinue}
        onRetry={() => void start()}
      />

      <div className="capture__feedback" aria-live="polite">
        {!captured && <LightingWarning state={lightingState} />}
        <QualityFeedback analyzing={analyzing} result={captured ? result : null} />
      </div>

      {showBackGuide && (
        <div
          className="back-guide fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="back-guide-title"
        >
          <div className="back-guide__card">
            <h2 id="back-guide-title" className="back-guide__title">
              לצילום תמונה זו יש להעזר באדם נוסף
            </h2>
            <img
              className="back-guide__image"
              src={photographyGuide}
              alt="צילום השיער מאחור בעזרת אדם נוסף"
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setBackGuideDismissed(true)}
            >
              המשך
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
