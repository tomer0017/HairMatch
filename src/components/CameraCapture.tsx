import type { RefObject } from 'react';
import type { CameraErrorKind, CameraStatus } from '../hooks/useCamera';
import type { LightingState } from '../hooks/useLiveLighting';
import { LightingBadge } from './LightingStatus';
import './CameraCapture.css';

interface CameraCaptureProps {
  videoRef: RefObject<HTMLVideoElement>;
  status: CameraStatus;
  errorKind: CameraErrorKind | null;
  /** When set, shows the frozen captured still instead of the live preview. */
  capturedUrl: string | null;
  /** Live lighting verdict, shown as a pill over the preview. */
  lightingState?: LightingState;
  /** Show the Face ID-style head guide overlay (front step only). */
  showFaceGuide?: boolean;
  /** Live face presence (front step only); null hides the indicator. */
  faceDetected?: boolean | null;
  /** Retry starting the camera after an error. */
  onRetry: () => void;
}

const ERROR_COPY: Record<CameraErrorKind, { title: string; body: string }> = {
  permission: {
    title: 'אין גישה למצלמה',
    body: 'כדי לצלם, אנא אשרי גישה למצלמה בהגדרות הדפדפן ונסי שוב.',
  },
  notFound: {
    title: 'לא נמצאה מצלמה',
    body: 'לא הצלחנו לאתר מצלמה במכשיר. ודאי שיש מצלמה זמינה ונסי שוב.',
  },
  unsupported: {
    title: 'הדפדפן אינו נתמך',
    body: 'הדפדפן שלך אינו תומך בצילום ישיר. נסי לפתוח את הקישור בדפדפן אחר.',
  },
  unknown: {
    title: 'שגיאה בהפעלת המצלמה',
    body: 'אירעה תקלה בהפעלת המצלמה. אנא נסי שוב.',
  },
};

/**
 * The camera viewport: live preview, frozen captured still, loading and
 * graceful error states. Purely presentational — capture logic lives in the
 * useCamera hook and the CaptureFlow page.
 */
export function CameraCapture({
  videoRef,
  status,
  errorKind,
  capturedUrl,
  lightingState,
  showFaceGuide = false,
  faceDetected = null,
  onRetry,
}: CameraCaptureProps) {
  const showLivePreview = !capturedUrl && status === 'ready';
  return (
    <div className="camera">
      {/* The video element is always mounted so the ref/stream stays stable;
          we just hide it while showing a captured still or an error. */}
      <video
        ref={videoRef}
        className="camera__video"
        playsInline
        muted
        autoPlay
        data-hidden={capturedUrl !== null || status !== 'ready'}
      />

      {showLivePreview && lightingState && <LightingBadge state={lightingState} />}

      {showLivePreview && showFaceGuide && (
        <div className="face-guide" aria-hidden="true">
          <div className="face-guide__oval" />
          <span className="face-guide__hint">מקמי את הפנים במרכז המסגרת</span>
        </div>
      )}

      {showLivePreview && faceDetected !== null && (
        <div
          className={`face-indicator face-indicator--${faceDetected ? 'on' : 'off'}`}
          role="status"
        >
          {faceDetected ? 'פנים זוהו' : 'לא זוהו פנים'}
        </div>
      )}

      {capturedUrl && (
        <img className="camera__still" src={capturedUrl} alt="התמונה שצולמה" />
      )}

      {!capturedUrl && status === 'requesting' && (
        <div className="camera__overlay">
          <span className="camera__spinner" aria-hidden="true" />
          <span>מפעילה את המצלמה…</span>
        </div>
      )}

      {!capturedUrl && status === 'error' && errorKind && (
        <div className="camera__overlay camera__overlay--error" role="alert">
          <span className="camera__error-icon" aria-hidden="true">
            !
          </span>
          <h3 className="camera__error-title">{ERROR_COPY[errorKind].title}</h3>
          <p className="camera__error-body">{ERROR_COPY[errorKind].body}</p>
          {errorKind !== 'unsupported' && (
            <button type="button" className="btn btn-secondary camera__retry" onClick={onRetry}>
              נסי שוב
            </button>
          )}
        </div>
      )}
    </div>
  );
}
