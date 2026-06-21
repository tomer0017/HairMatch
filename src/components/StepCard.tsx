import './StepCard.css';

interface StepCardProps {
  label: string;
  url: string;
  index: number;
  onRetake: () => void;
}

/** A single labelled photo tile in the final review grid, with a retake action. */
export function StepCard({ label, url, index, onRetake }: StepCardProps) {
  return (
    <figure className="step-card">
      <div className="step-card__media">
        <img src={url} alt={label} loading="lazy" />
        <span className="step-card__badge">{index}</span>
      </div>
      <figcaption className="step-card__footer">
        <span className="step-card__label">{label}</span>
        <button type="button" className="step-card__retake" onClick={onRetake}>
          צלמי מחדש
        </button>
      </figcaption>
    </figure>
  );
}
