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
  /** Play the brief Face ID-style intro guide overlay (front step only). */
  showFaceGuide?: boolean;
  /** Live face presence (front step only); null hides the indicator. */
  faceDetected?: boolean | null;
  /** Flip the camera; when set, a floating switch button overlays the preview. */
  onSwitchCamera?: () => void;
  /** Disable the floating switch button (e.g. while the camera is restarting). */
  switchDisabled?: boolean;
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
  onSwitchCamera,
  switchDisabled = false,
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

      {/* Brief intro guide: a smaller dashed oval that fades in, pulses and
          fades out after ~1s, then unmounts — leaving the user free to frame
          the full hair. CaptureFlow controls when it mounts. */}
      {showLivePreview && showFaceGuide && (
        <div className="face-guide face-guide--intro" aria-hidden="true">
          <div className="face-guide__oval" />
          <span className="face-guide__hint">מקמי את הפנים במרכז</span>
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

      {showLivePreview && onSwitchCamera && (
        <button
          type="button"
          className="camera__switch"
          onClick={onSwitchCamera}
          disabled={switchDisabled}
          aria-label="החלפת מצלמה"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M12 9.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"
              fill="currentColor"
            />
            <path
              d="M9 3.8 8 5.5H5.5A2.5 2.5 0 0 0 3 8v3.2M3 11.2 1.4 9.6M3 11.2l1.6-1.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M15 20.2l1-1.7h2.5A2.5 2.5 0 0 0 21 16v-3.2M21 12.8l1.6 1.6M21 12.8l-1.6 1.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
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
