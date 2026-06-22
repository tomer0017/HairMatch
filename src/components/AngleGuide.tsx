/**
 * Salon-portrait reference photos of the same woman from each capture angle.
 * Used both as the large "this is the photo you need" demo and as the compact
 * corner thumbnail. The component API, sizing, positioning, animations and the
 * demo→thumbnail transition are all driven by the CSS classes passed in — this
 * file only resolves the right image for the angle.
 */
import frontImg from '../assets/angles/front.png';
import rightImg from '../assets/angles/right.png';
import leftImg from '../assets/angles/left.png';
import backImg from '../assets/angles/back.png';

/** The five supported guide angles. */
export type AngleKind = 'front' | 'right' | 'left' | 'back' | 'top';

/** Map a capture step id to the illustration that demonstrates its angle. */
export function angleForStep(stepId: string): AngleKind {
  switch (stepId) {
    case 'front':
      return 'front';
    case 'right-profile':
      return 'right';
    case 'left-profile':
      return 'left';
    // Both back captures share the back-of-head illustration.
    case 'back-1':
    case 'back-2':
    default:
      return 'back';
  }
}

// The supplied image asset for each angle. 'top' is unused by the current step
// mapping but kept type-complete; it falls back to the back-of-head photo.
const ANGLE_IMAGES: Record<AngleKind, string> = {
  front: frontImg,
  right: rightImg,
  left: leftImg,
  back: backImg,
  top: backImg,
};

interface AngleGuideProps {
  angle: AngleKind;
  className?: string;
}

/** Renders the supplied reference photo for one angle. */
export function AngleGuide({ angle, className }: AngleGuideProps) {
  return <img className={className} src={ANGLE_IMAGES[angle]} alt="" aria-hidden="true" />;
}
