import type { CapturedPhoto, PhotoStep } from '../types';
import { StepCard } from './StepCard';
import './FinalReview.css';

interface FinalReviewProps {
  steps: PhotoStep[];
  photos: Record<string, CapturedPhoto>;
  onRetake: (stepIndex: number) => void;
}

/** Responsive grid of all five captured photos with their labels. */
export function FinalReview({ steps, photos, onRetake }: FinalReviewProps) {
  return (
    <section className="review">
      <header className="review__header">
        <h1 className="review__title">תמונות הבדיקה שלך</h1>
        <p className="review__subtitle">
          עברי על התמונות. אם משהו לא מושלם, אפשר לצלם מחדש לפני השליחה.
        </p>
      </header>

      <div className="review__grid">
        {steps.map((step, index) => {
          const photo = photos[step.id];
          if (!photo) return null;
          return (
            <StepCard
              key={step.id}
              label={step.label}
              url={photo.url}
              index={index + 1}
              onRetake={() => onRetake(index)}
            />
          );
        })}
      </div>
    </section>
  );
}
