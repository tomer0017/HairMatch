import './ProgressBar.css';

interface ProgressBarProps {
  current: number; // 1-based step number
  total: number;
}

/** Slim progress indicator with the Hebrew "X מתוך N" counter. */
export function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = Math.round((current / total) * 100);

  return (
    <div className="progress" aria-label={`שלב ${current} מתוך ${total}`}>
      <div className="progress__header">
        <span className="progress__count">
          {current} מתוך {total}
        </span>
        <span className="progress__label">צילום תמונות</span>
      </div>
      <div className="progress__track" role="presentation">
        <div className="progress__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
