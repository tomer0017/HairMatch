import type { LightingState } from '../hooks/useLiveLighting';
import './LightingStatus.css';

/** Live status pill copy + colour tone per lighting state. */
const STATUS: Record<Exclude<LightingState, 'pending'>, { dot: string; label: string; tone: string }> = {
  ok: { dot: '🟢', label: 'תאורה תקינה', tone: 'ok' },
  low: { dot: '🟠', label: 'יש מעט תאורה', tone: 'low' },
  dark: { dot: '🔴', label: 'אין מספיק תאורה', tone: 'bad' },
  bright: { dot: '🔴', label: 'התאורה חזקה מדי', tone: 'bad' },
};

/** Prominent blocking-warning copy, shown only for the red states. */
const WARNING: Record<'dark' | 'bright', { title: string; body: string }> = {
  dark: {
    title: 'אין מספיק תאורה לצילום',
    body: 'תאורת הסביבה חשוכה מדי.\nאנא עברי למקום מואר יותר לפני הצילום.',
  },
  bright: {
    title: 'התמונה צפויה להיות שרופה',
    body: 'יש יותר מדי אור בתמונה.\nהתרחקי משמש ישירה או ממקור אור חזק.',
  },
};

/**
 * Small live status pill, intended to overlay the camera preview.
 * Renders nothing until the first sample arrives.
 */
export function LightingBadge({ state }: { state: LightingState }) {
  if (state === 'pending') return null;
  const { dot, label, tone } = STATUS[state];
  return (
    <div className={`lighting-badge lighting-badge--${tone}`} role="status">
      <span aria-hidden="true">{dot}</span>
      <span>{label}</span>
    </div>
  );
}

/**
 * Prominent warning card shown below the preview when lighting blocks capture
 * (too dark or overexposed). Renders nothing otherwise.
 */
export function LightingWarning({ state }: { state: LightingState }) {
  if (state !== 'dark' && state !== 'bright') return null;
  const { title, body } = WARNING[state];
  return (
    <div className="lighting-warning" role="alert">
      <span className="lighting-warning__title">{title}</span>
      <p className="lighting-warning__body">{body}</p>
    </div>
  );
}
