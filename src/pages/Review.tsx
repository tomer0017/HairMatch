import { FinalReview } from '../components/FinalReview';
import { ShareActions } from '../components/ShareActions';
import type { CapturedPhoto, PhotoStep } from '../types';
import './Review.css';

interface ReviewProps {
  steps: PhotoStep[];
  photos: Record<string, CapturedPhoto>;
  onRetake: (stepIndex: number) => void;
}

/** Final review screen: photo grid plus the share / download actions. */
export function Review({ steps, photos, onRetake }: ReviewProps) {
  return (
    <div className="review-page fade-in">
      <FinalReview steps={steps} photos={photos} onRetake={onRetake} />

      <div className="review-page__actions">
        <ShareActions steps={steps} photos={photos} />
        <p className="review-page__hint">
          לאחר השליחה, בחרי בוואטסאפ מתוך תפריט השיתוף ושלחי את התמונות לספר.
        </p>
      </div>
    </div>
  );
}
