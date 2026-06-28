/**
 * Options for the pre-camera hair questionnaire.
 *
 * Labels are the Hebrew strings shown to the client and also placed in the
 * WhatsApp share text. The `id === 'other'` length option reveals a free-text
 * field for an exact description.
 */

export interface QuestionOption {
  id: string;
  /** Hebrew label shown on the card and used in the WhatsApp message. */
  label: string;
  /** Optional short hint shown under the label. */
  hint?: string;
}

export const HAIR_LENGTH_OPTIONS: QuestionOption[] = [
  { id: 'short', label: 'קצר', hint: 'מעל הכתפיים' },
  { id: 'medium', label: 'בינוני', hint: 'באורך הכתפיים' },
  { id: 'long', label: 'ארוך', hint: 'עד אמצע הגב' },
  { id: 'very-long', label: 'ארוך מאוד', hint: 'עד המותניים ומטה' },
  { id: 'other', label: 'אחר' },
];
