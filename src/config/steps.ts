import type { PhotoStep } from '../types';

/**
 * The five required capture steps, in order.
 * The client must successfully capture exactly these five photos.
 */
export const PHOTO_STEPS: PhotoStep[] = [
  {
    id: 'front',
    label: 'מבט קדמי',
    instruction: 'עמדי מול המצלמה כך שכל השיער יופיע בתמונה.',
    fileName: 'front.jpg',
  },
  {
    id: 'right-profile',
    label: 'פרופיל ימין',
    instruction: 'הפני את צד ימין של הראש לכיוון המצלמה.',
    fileName: 'right-profile.jpg',
  },
  {
    id: 'left-profile',
    label: 'פרופיל שמאל',
    instruction: 'הפני את צד שמאל של הראש לכיוון המצלמה.',
    fileName: 'left-profile.jpg',
  },
  {
    id: 'top',
    label: 'מבט מלמעלה',
    instruction: 'הרכיני את הראש מטה כך שקודקוד השיער יופיע במלואו לכיוון המצלמה.',
    fileName: 'top.jpg',
  },
  {
    id: 'back',
    label: 'מבט אחורי',
    instruction: 'בקשי ממישהו לצלם את השיער מאחור כך שכל האורך יופיע.',
    fileName: 'back.jpg',
  },
];

export const TOTAL_STEPS = PHOTO_STEPS.length;
