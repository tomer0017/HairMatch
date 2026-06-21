import { useCallback, useEffect, useRef, useState } from 'react';

/** Status of the camera lifecycle. */
export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'error';

/** Which physical camera is in use. */
export type CameraFacing = 'user' | 'environment';

/** Reason a camera failed to start — drives the Hebrew error copy. */
export type CameraErrorKind = 'permission' | 'notFound' | 'unsupported' | 'unknown';

interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  status: CameraStatus;
  errorKind: CameraErrorKind | null;
  /** The camera currently requested ('user' = selfie, 'environment' = rear). */
  facing: CameraFacing;
  /** Start (or restart) the stream. Safe to call repeatedly. */
  start: () => Promise<void>;
  /** Stop all tracks and release the camera. */
  stop: () => void;
  /** Flip between the selfie and rear camera, restarting the stream cleanly. */
  switchCamera: () => Promise<void>;
  /** Capture the current frame as a JPEG blob at the camera's native size. */
  capture: () => Promise<{ blob: Blob; width: number; height: number } | null>;
}

/**
 * Encapsulates getUserMedia lifecycle, stream attachment and frame capture.
 *
 * Browser notes:
 * - We request the rear camera with facingMode { ideal: 'environment' } so the
 *   browser falls back gracefully to the front camera if no rear one exists.
 * - getUserMedia requires a secure context (HTTPS or localhost).
 * - Tracks must be stopped explicitly or the camera indicator stays on.
 */
export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [errorKind, setErrorKind] = useState<CameraErrorKind | null>(null);
  // Default to the selfie/front camera. Kept in a ref so `start` stays stable
  // while still reading the latest choice after a switch.
  const [facing, setFacing] = useState<CameraFacing>('user');
  const facingRef = useRef<CameraFacing>('user');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorKind('unsupported');
      setStatus('error');
      return;
    }

    // Always release any existing stream first — prevents leaked tracks and a
    // camera indicator that stays on after a switch.
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    setStatus('requesting');
    setErrorKind(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingRef.current },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // playsInline is required for iOS Safari to avoid fullscreen takeover.
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play().catch(() => {
          /* autoplay can reject silently; the stream is still attached */
        });
      }

      setStatus('ready');
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setErrorKind('permission');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setErrorKind('notFound');
      } else {
        setErrorKind('unknown');
      }
      setStatus('error');
    }
  }, []);

  const switchCamera = useCallback(async () => {
    const next: CameraFacing = facingRef.current === 'user' ? 'environment' : 'user';
    facingRef.current = next;
    setFacing(next);
    // `start` reads facingRef and stops the previous stream before re-acquiring.
    await start();
  }, [start]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;

    const width = video.videoWidth;
    const height = video.videoHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
    });

    if (!blob) return null;
    return { blob, width, height };
  }, []);

  // Always release the camera when the component using the hook unmounts.
  useEffect(() => stop, [stop]);

  return { videoRef, status, errorKind, facing, start, stop, switchCamera, capture };
}
