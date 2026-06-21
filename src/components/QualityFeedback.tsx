import type { QualityResult } from '../types';
import './QualityFeedback.css';

interface QualityFeedbackProps {
  analyzing: boolean;
  result: QualityResult | null;
}

/**
 * Shows the validation state after a capture: a spinner while analysing,
 * a success confirmation, or the list of detected issues.
 */
export function QualityFeedback({ analyzing, result }: QualityFeedbackProps) {
  if (analyzing) {
    return (
      <div className="feedback feedback--analyzing" role="status">
        <span className="feedback__spinner" aria-hidden="true" />
        <span>בודקים את התמונה…</span>
      </div>
    );
  }

  if (!result) return null;

  if (result.passed) {
    return (
      <div className="feedback feedback--success" role="status">
        <span className="feedback__icon" aria-hidden="true">
          ✓
        </span>
        <span>תמונה תקינה</span>
      </div>
    );
  }

  return (
    <div className="feedback feedback--error" role="alert">
      <span className="feedback__title">יש לתקן לפני שממשיכים:</span>
      <ul className="feedback__list">
        {result.issues.map((issue) => (
          <li key={issue.code}>{issue.message}</li>
        ))}
      </ul>
    </div>
  );
}
