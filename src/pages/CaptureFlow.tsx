import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraCapture } from '../components/CameraCapture';
import { LightingWarning } from '../components/LightingStatus';
import { PhotoInstructions } from '../components/PhotoInstructions';
import { ProgressBar } from '../components/ProgressBar';
import { QualityFeedback } from '../components/QualityFeedback';
import { useCamera } from '../hooks/useCamera';
import { useLiveLighting } from '../hooks/useLiveLighting';
import { usePhotoValidation } from '../hooks/usePhotoValidation';
import type { CapturedPhoto, PhotoStep } from '../types';
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
  const { videoRef, status, errorKind, start, capture } = useCamera();
  const { analyzing, result, validate, reset } = usePhotoValidation();

  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [captured, setCaptured] = useState<CapturedPhoto | null>(null);

  // Analyse the live preview while it's on screen (no frozen still showing).
  const { state: lightingState } = useLiveLighting(
    videoRef,
    status === 'ready' && captured === null,
  );
  // Block capture while the scene is too dark or overexposed (red states).
  const lightingBlocked = lightingState === 'dark' || lightingState === 'bright';

  // Hold the temp object URL of an unconfirmed capture so we can revoke it.
  const pendingUrlRef = useRef<string | null>(null);

  const step = steps[currentIndex];

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
    await validate(frame.blob);
  }, [capture, validate, lightingBlocked]);

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

      <CameraCapture
        videoRef={videoRef}
        status={status}
        errorKind={errorKind}
        capturedUrl={captured?.url ?? null}
        lightingState={lightingState}
        onRetry={() => void start()}
      />

      <div className="capture__feedback" aria-live="polite">
        {!captured && <LightingWarning state={lightingState} />}
        <QualityFeedback analyzing={analyzing} result={captured ? result : null} />
      </div>

      <div className="capture__actions">
        {!captured ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleCapture()}
            disabled={status !== 'ready' || lightingBlocked}
          >
            צלמי תמונה
          </button>
        ) : (
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" onClick={handleRetake}>
              צלמי מחדש
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleContinue}
              disabled={!canContinue}
            >
              {continueLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
