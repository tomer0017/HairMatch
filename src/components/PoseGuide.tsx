interface PoseGuideProps {
  stepId: string;
}

/**
 * Lightweight inline-SVG pose guides — a stylised head silhouette oriented to
 * match each capture angle. Purely decorative; kept as a placeholder visual.
 */
export function PoseGuide({ stepId }: PoseGuideProps) {
  switch (stepId) {
    case 'front':
      return <FrontHead />;
    case 'right-profile':
      return <ProfileHead direction="right" />;
    case 'left-profile':
      return <ProfileHead direction="left" />;
    default:
      return <BackHead />;
  }
}

function FrontHead() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M24 6c-7 0-11 5-11 12 0 6 3 9 3 13 0 2 1 3 3 3h10c2 0 3-1 3-3 0-4 3-7 3-13 0-7-4-12-11-12z"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <circle cx="19" cy="20" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="29" cy="20" r="1.6" fill="currentColor" stroke="none" />
      <path d="M21 27c1 1.5 5 1.5 6 0" strokeLinecap="round" />
    </svg>
  );
}

function ProfileHead({ direction }: { direction: 'left' | 'right' }) {
  // Mirror horizontally for the opposite side.
  const transform = direction === 'left' ? 'scale(-1,1) translate(-48,0)' : undefined;
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
      <g transform={transform}>
        <path
          d="M30 7c-8 0-14 6-14 14 0 4 1 6 1 9 0 3 2 5 5 5h3c2 0 3-1 3-3v-3"
          fill="currentColor"
          fillOpacity="0.12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="22" cy="20" r="1.6" fill="currentColor" stroke="none" />
        <path d="M16 22h-3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function BackHead() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M24 6c-8 0-12 5-12 13 0 8 3 13 4 18 0 2 1 3 3 3h10c2 0 3-1 3-3 1-5 4-10 4-18 0-8-4-13-12-13z"
        fill="currentColor"
        fillOpacity="0.12"
        strokeLinejoin="round"
      />
      <path d="M19 16c2 3 8 3 10 0M21 24c1.5 2 4.5 2 6 0" strokeLinecap="round" />
    </svg>
  );
}
