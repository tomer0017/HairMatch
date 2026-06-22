import { useState } from 'react';
import {
  HAIR_LENGTH_OPTIONS,
  HAIR_TYPE_OPTIONS,
  type QuestionOption,
} from '../config/questionnaire';
import type { HairProfile } from '../types';
import './Questionnaire.css';

interface QuestionnaireProps {
  /** Called once both steps are answered, just before the camera opens. */
  onComplete: (profile: HairProfile) => void;
  /** Back to the landing screen (from the first step). */
  onBack: () => void;
}

const OTHER_ID = 'other';

/**
 * Two-step pre-camera questionnaire: hair type, then hair length. Purely a
 * data-collection screen — it does not touch the camera, AI analysis, or image
 * processing. On completion it hands a HairProfile up so it can later be added
 * to the WhatsApp share text.
 */
export function Questionnaire({ onComplete, onBack }: QuestionnaireProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [typeId, setTypeId] = useState<string | null>(null);
  const [lengthId, setLengthId] = useState<string | null>(null);
  const [lengthDescription, setLengthDescription] = useState('');

  const selectedType = HAIR_TYPE_OPTIONS.find((o) => o.id === typeId);
  const selectedLength = HAIR_LENGTH_OPTIONS.find((o) => o.id === lengthId);
  const lengthIsOther = lengthId === OTHER_ID;

  const canContinueType = Boolean(selectedType);
  const canFinish =
    Boolean(selectedLength) && (!lengthIsOther || lengthDescription.trim().length > 0);

  const handleFinish = () => {
    if (!selectedType || !selectedLength || !canFinish) return;
    onComplete({
      hairType: selectedType.label,
      hairLength: selectedLength.label,
      ...(lengthIsOther ? { hairLengthDescription: lengthDescription.trim() } : {}),
    });
  };

  return (
    <div className="quiz fade-in" key={step}>
      <header className="quiz__header">
        <span className="quiz__step">שלב {step} מתוך 2</span>
        <h1 className="quiz__title">
          {step === 1 ? 'מהו מרקם השיער שלך?' : 'מהו אורך השיער שלך?'}
        </h1>
      </header>

      {step === 1 ? (
        <OptionList
          options={HAIR_TYPE_OPTIONS}
          name="hair-type"
          selectedId={typeId}
          onSelect={setTypeId}
        />
      ) : (
        <>
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
        </>
      )}

      <div className="quiz__actions">
        {step === 1 ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setStep(2)}
            disabled={!canContinueType}
          >
            המשך
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleFinish}
            disabled={!canFinish}
          >
            המשך למצלמה
          </button>
        )}

        <button
          type="button"
          className="btn btn-ghost"
          onClick={step === 1 ? onBack : () => setStep(1)}
        >
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
