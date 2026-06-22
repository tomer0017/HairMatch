import { useMemo, useState } from 'react';
import type { CapturedPhoto, HairProfile, PhotoStep } from '../types';
import {
  blobToFile,
  canShareFiles,
  createShareableFiles,
  downloadAllAsZip,
  downloadFile,
} from '../utils/fileHelpers';
import './ShareActions.css';

interface ShareActionsProps {
  steps: PhotoStep[];
  photos: Record<string, CapturedPhoto>;
  hairProfile: HairProfile | null;
}

/** Build the Hebrew hair-profile lines appended to the WhatsApp share text. */
function buildHairProfileText(profile: HairProfile | null): string {
  if (!profile) return '';
  const lines = [`סוג שיער: ${profile.hairType}`, `אורך שיער: ${profile.hairLength}`];
  if (profile.hairLengthDescription) {
    lines.push(`פירוט: ${profile.hairLengthDescription}`);
  }
  return lines.join('\n');
}

/**
 * Final action area: share the photos via the native share sheet (the client
 * then picks WhatsApp themselves), or fall back to per-file / ZIP downloads.
 *
 * The app never sends a message automatically — it only hands the files to the
 * OS share sheet or to the browser's download mechanism.
 */
export function ShareActions({ steps, photos, hairProfile }: ShareActionsProps) {
  const files = useMemo(() => createShareableFiles(steps, photos), [steps, photos]);
  const shareSupported = useMemo(() => canShareFiles(files), [files]);
  const shareText = useMemo(() => {
    const hairText = buildHairProfileText(hairProfile);
    const base = 'התמונות לבדיקת התאמת התוספות';
    return hairText ? `${base}\n\n${hairText}` : base;
  }, [hairProfile]);

  const [sharing, setSharing] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const handleShare = async () => {
    setNote(null);
    setSharing(true);
    try {
      await navigator.share({
        files,
        title: 'תמונות שיער לבדיקה',
        text: shareText,
      });
    } catch (err) {
      // AbortError = the user closed the sheet; that is not a real error.
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setNote('השיתוף לא הושלם. אפשר לנסות שוב או להוריד את התמונות.');
      }
    } finally {
      setSharing(false);
    }
  };

  const handleZip = async () => {
    setZipping(true);
    try {
      await downloadAllAsZip(files);
    } catch {
      setNote('ההורדה נכשלה. נסי להוריד כל תמונה בנפרד.');
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="share">
      {shareSupported ? (
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleShare}
          disabled={sharing}
        >
          {sharing ? 'פותחת שיתוף…' : 'שלחי את התמונות לספר'}
        </button>
      ) : (
        <div className="share__fallback">
          <p className="share__fallback-note">
            המכשיר שלך אינו תומך בשליחה ישירה של התמונות. אפשר להוריד את התמונות
            ולשלוח אותן ידנית בוואטסאפ.
          </p>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleZip}
            disabled={zipping}
          >
            {zipping ? 'מכינה קובץ…' : 'הורידי את כל התמונות'}
          </button>

          <div className="share__downloads">
            {steps.map((step) => {
              const photo = photos[step.id];
              if (!photo) return null;
              return (
                <button
                  key={step.id}
                  type="button"
                  className="share__download"
                  onClick={() => downloadFile(blobToFile(photo.blob, step.fileName))}
                >
                  הורדה · {step.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {note && (
        <p className="share__message" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
