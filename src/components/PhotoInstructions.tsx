import type { PhotoStep } from '../types';
import { PoseGuide } from './PoseGuide';
import './PhotoInstructions.css';

interface PhotoInstructionsProps {
  step: PhotoStep;
}

/** Step title, an illustrative pose guide, and the short instruction text. */
export function PhotoInstructions({ step }: PhotoInstructionsProps) {
  return (
    <div className="instructions">
      <div className="instructions__guide" aria-hidden="true">
        <PoseGuide stepId={step.id} />
      </div>
      <div className="instructions__text">
        <h2 className="instructions__title">{step.label}</h2>
        <p className="instructions__body">{step.instruction}</p>
      </div>
    </div>
  );
}
