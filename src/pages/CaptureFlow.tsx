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
import { primeTimerFeedback, timerTick } from '../utils/timerFeedback';
import type { CapturedPhoto, PhotoStep } from '../types';
import photographyGuide from '../assets/photography-guide.jpg';
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

/** Length of the optional self-timer countdown. */
const TIMER_SECONDS = 10;

// The self-timer choice lives for the whole page session (not just one mount),
// so it also survives leaving to the review screen and coming back to retake.
let timerPreference = false;

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
  // Optional 10-second self-timer: whether it's armed, and the seconds left
  // while a countdown is running (null = no countdown in progress).
  const [timerEnabled, setTimerEnabled] = useState(timerPreference);
  const [countdown, setCountdown] = useState<number | null>(null);

  const step = steps[currentIndex];
  const stepValidation = getStepValidation(step.id);
  // Show the helper popup before the back-view capture screen (and not once a
  // photo for that step has already been taken). Additive to existing guidance.
  const showBackGuide = step.id === 'back' && !backGuideDismissed && !captured;
  // The second back view has its own short preparation card explaining why it's
  // needed (natural daylight), so it never feels like a duplicate request.
  const showDaylightGuide = step.id === 'back-daylight' && !backGuideDismissed && !captured;
  const showPrepGuide = showBackGuide || showDaylightGuide;
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
    if (status !== 'ready' || captured !== null || showPrepGuide) {
      setAngleDemoVisible(false);
      return;
    }
    setAngleDemoVisible(true);
    const id = window.setTimeout(() => setAngleDemoVisible(false), ANGLE_DEMO_MS);
    return () => window.clearTimeout(id);
  }, [status, captured, step.id, showPrepGuide]);

  // Analyse the live preview while it's on screen (no frozen still showing).
  // Face-required steps measure lighting on the subject (face + hair ROI).
  const { state: lightingState, faceDetected } = useLiveLighting(
    videoRef,
    status === 'ready' && captured === null,
    { useFace: stepValidation.requireFace, stepId: step.id, facing },
  );
  // Block capture while the scene is too dark, backlit or overexposed (red states).
  const lightingBlocked =
    lightingState === 'dark' || lightingState === 'backlit' || lightingState === 'bright';

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

  // The countdown always fires the latest capture handler (same pipeline as a
  // direct shutter tap) without restarting whenever that handler changes.
  const handleCaptureRef = useRef(handleCapture);
  handleCaptureRef.current = handleCapture;

  // Self-timer countdown: 10 → 1, one tick per second, then capture.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 3) timerTick();
    const id = window.setTimeout(() => {
      if (countdown > 1) {
        setCountdown(countdown - 1);
      } else {
        setCountdown(null);
        void handleCaptureRef.current();
      }
    }, 1000);
    return () => window.clearTimeout(id);
  }, [countdown]);

  // Abort a running countdown if the live preview goes away underneath it.
  useEffect(() => {
    if (status !== 'ready') setCountdown(null);
  }, [status]);

  const handleShutter = useCallback(() => {
    // A countdown is already running — ignore repeated taps.
    if (countdown !== null || lightingBlocked) return;
    if (timerEnabled) {
      primeTimerFeedback();
      setCountdown(TIMER_SECONDS);
      return;
    }
    void handleCapture();
  }, [countdown, lightingBlocked, timerEnabled, handleCapture]);

  const handleToggleTimer = useCallback(() => {
    setTimerEnabled((enabled) => {
      timerPreference = !enabled;
      return !enabled;
    });
  }, []);

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
      setCountdown(null);
      reset();
      // Re-arm the preparation popups so they show again on each entry to a back step.
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
        : 'השתמשי והמשיכי';

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
        onCapture={handleShutter}
        captureDisabled={lightingBlocked}
        timerEnabled={timerEnabled}
        onToggleTimer={handleToggleTimer}
        countdown={countdown}
        onCancelCountdown={() => setCountdown(null)}
        onSwitchCamera={() => void switchCamera()}
        switchDisabled={status === 'requesting' || countdown !== null}
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
              לצילום מאחור, בקשי עזרה מאדם נוסף
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
              המשיכי לצילום
            </button>
          </div>
        </div>
      )}

      {showDaylightGuide && (
        <div
          className="back-guide fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="daylight-guide-title"
        >
          <div className="back-guide__card">
            <h2 id="daylight-guide-title" className="back-guide__title">
              עוד תמונה אחת באור טבעי
            </h2>
            <p className="back-guide__body">
              כדי שנוכל לראות את גוון השיער בצורה מדויקת יותר, צלמי תמונה נוספת מאחור באור
              יום טבעי.
            </p>
            <ul className="back-guide__options">
              <li>
                <span aria-hidden="true">☀️</span>
                ליד חלון
              </li>
              <li>
                <span aria-hidden="true">🌤️</span>
                במרפסת
              </li>
              <li>
                <span aria-hidden="true">🌿</span>
                בחוץ באור יום
              </li>
            </ul>
            <p className="back-guide__note">
              עדיף אור טבעי רך, ללא שמש ישירה וחזקה על השיער.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setBackGuideDismissed(true)}
            >
              אני במקום מתאים
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
