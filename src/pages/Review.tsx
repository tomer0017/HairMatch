import { FinalReview } from '../components/FinalReview';
import { ShareActions } from '../components/ShareActions';
import type { CapturedPhoto, HairProfile, PhotoStep } from '../types';
import './Review.css';

interface ReviewProps {
  steps: PhotoStep[];
  photos: Record<string, CapturedPhoto>;
  hairProfile: HairProfile | null;
  onRetake: (stepIndex: number) => void;
}

/** Final review screen: photo grid plus the share / download actions. */
export function Review({ steps, photos, hairProfile, onRetake }: ReviewProps) {
  return (
    <div className="review-page fade-in">
      <FinalReview steps={steps} photos={photos} onRetake={onRetake} />

      <div className="review-page__actions">
        <ShareActions steps={steps} photos={photos} hairProfile={hairProfile} />
        <p className="review-page__hint">
          לאחר השליחה, בחרי בוואטסאפ מתוך תפריט השיתוף ושלחי את התמונות לספר.
        </p>
      </div>
    </div>
  );
}
