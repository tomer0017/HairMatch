import { useState } from 'react';
import { HAIR_LENGTH_OPTIONS, type QuestionOption } from '../config/questionnaire';
import type { HairProfile } from '../types';
import './Questionnaire.css';

interface QuestionnaireProps {
  /** Called once the question is answered, just before the camera opens. */
  onComplete: (profile: HairProfile) => void;
  /** Back to the landing screen. */
  onBack: () => void;
}

const OTHER_ID = 'other';

/**
 * Single-step pre-camera questionnaire: hair length. Purely a data-collection
 * screen — it does not touch the camera, AI analysis, or image processing. On
 * completion it hands a HairProfile up so it can later be added to the WhatsApp
 * share text.
 */
export function Questionnaire({ onComplete, onBack }: QuestionnaireProps) {
  const [lengthId, setLengthId] = useState<string | null>(null);
  const [lengthDescription, setLengthDescription] = useState('');

  const selectedLength = HAIR_LENGTH_OPTIONS.find((o) => o.id === lengthId);
  const lengthIsOther = lengthId === OTHER_ID;

  const canFinish =
    Boolean(selectedLength) && (!lengthIsOther || lengthDescription.trim().length > 0);

  const handleFinish = () => {
    if (!selectedLength || !canFinish) return;
    onComplete({
      hairLength: selectedLength.label,
      ...(lengthIsOther ? { hairLengthDescription: lengthDescription.trim() } : {}),
    });
  };

  return (
    <div className="quiz fade-in">
      <header className="quiz__header">
        <h1 className="quiz__title">מהו אורך השיער שלך?</h1>
      </header>

      <OptionList
        options={HAIR_LENGTH_OPTIONS}
        name="hair-length"
        selectedId={lengthId}
        onSelect={setLengthId}
      />

      {lengthIsOther && (
        <div className="quiz__other">
          <label className="quiz__other-label" htmlFor="length-description">
            תיאור אורך השיער
          </label>
          <input
            id="length-description"
            className="quiz__other-input"
            type="text"
            value={lengthDescription}
            onChange={(e) => setLengthDescription(e.target.value)}
            placeholder='לדוגמה: עד תחתית הגב, 85 ס"מ'
            autoFocus
          />
        </div>
      )}

      <div className="quiz__actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleFinish}
          disabled={!canFinish}
        >
          המשך למצלמה
        </button>

        <button type="button" className="btn btn-ghost" onClick={onBack}>
          חזרה
        </button>
      </div>
    </div>
  );
}

interface OptionListProps {
  options: QuestionOption[];
  name: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Large, touch-friendly single-select cards. */
function OptionList({ options, name, selectedId, onSelect }: OptionListProps) {
  return (
    <div className="quiz__options" role="radiogroup">
      {options.map((option) => {
        const selected = option.id === selectedId;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            name={name}
            className={`quiz-card${selected ? ' quiz-card--selected' : ''}`}
            onClick={() => onSelect(option.id)}
          >
            <span className="quiz-card__text">
              <span className="quiz-card__label">{option.label}</span>
              {option.hint && <span className="quiz-card__hint">{option.hint}</span>}
            </span>
            <span className="quiz-card__check" aria-hidden="true">
              {selected ? '✓' : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
