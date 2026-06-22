/**
 * Stylised salon-portrait illustrations of the same woman from each capture
 * angle. Used both as the large "this is the photo you need" demo and as the
 * compact corner thumbnail. Pure SVG so they stay crisp at any size, share one
 * consistent palette, and add no asset-loading cost.
 *
 * Want real photos instead? Drop front/right/left/back/top images into the
 * markup below — the component contract (one illustration per angle) stays the
 * same and the demo→thumbnail animation keeps working unchanged.
 */

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

interface AngleGuideProps {
  angle: AngleKind;
  className?: string;
}

// Shared warm palette, tuned to the app's accent tones.
const C = {
  bg1: '#f3ead9',
  bg2: '#e7d6bd',
  hair: '#5c3d28',
  hairDark: '#4a3020',
  hairLight: '#7a5132',
  skin: '#e9c6a4',
  skinShade: '#d8ad86',
  top: '#ffffff',
  line: '#3a281b',
};

/** Renders the illustration for one angle, filling its container (3:4). */
export function AngleGuide({ angle, className }: AngleGuideProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 320"
      role="img"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="ag-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.bg1} />
          <stop offset="1" stopColor={C.bg2} />
        </linearGradient>
      </defs>
      <rect width="240" height="320" fill="url(#ag-bg)" />
      {angle === 'front' && <Front />}
      {angle === 'right' && <Profile dir="right" />}
      {angle === 'left' && <Profile dir="left" />}
      {angle === 'back' && <Back />}
      {angle === 'top' && <Top />}
    </svg>
  );
}

/** White tank-top shoulders shared by the facing/back poses. */
function Shoulders() {
  return (
    <path
      d="M120 250c34 0 58 14 70 34 8 13 12 25 12 36H38c0-11 4-23 12-36 12-20 36-34 70-34z"
      fill={C.top}
    />
  );
}

function Front() {
  return (
    <g>
      <Shoulders />
      {/* Hair mass behind the head + face framing */}
      <path
        d="M120 44c40 0 64 28 64 70 0 30-4 52-10 86-4 22-10 38-18 44 4-22 6-40 4-64-2 8-6 14-12 18 6-24 4-50-4-66-10 12-32 18-48 18s-38-6-48-18c-8 16-10 42-4 66-6-4-10-10-12-18-2 24 0 42 4 64-8-6-14-22-18-44-6-34-10-56-10-86 0-42 24-70 64-70z"
        fill={C.hair}
      />
      {/* Neck */}
      <path d="M104 196h32v40c0 9-7 16-16 16s-16-7-16-16z" fill={C.skinShade} />
      {/* Face */}
      <ellipse cx="120" cy="150" rx="44" ry="54" fill={C.skin} />
      {/* Hair top sweeping over the forehead */}
      <path
        d="M120 96c-30 0-50 22-52 52 6-16 18-26 34-30-8 6-12 14-12 24 8-16 30-22 30-22s22 6 30 22c0-10-4-18-12-24 16 4 28 14 34 30-2-30-22-52-52-52z"
        fill={C.hairLight}
      />
      {/* Brows */}
      <path d="M98 138c6-4 14-4 20 0" stroke={C.line} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M122 138c6-4 14-4 20 0" stroke={C.line} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* Eyes */}
      <ellipse cx="106" cy="150" rx="5" ry="4" fill={C.line} />
      <ellipse cx="134" cy="150" rx="5" ry="4" fill={C.line} />
      {/* Nose + lips */}
      <path d="M120 156v14c0 3-3 5-6 6" stroke={C.skinShade} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M110 182c6 5 14 5 20 0" stroke="#b9745f" strokeWidth="4" fill="none" strokeLinecap="round" />
    </g>
  );
}

/** Side profile. dir='right' faces the viewer's right; 'left' mirrors it. */
function Profile({ dir }: { dir: 'right' | 'left' }) {
  // Drawn facing right; mirror horizontally for the left profile.
  const transform = dir === 'left' ? 'translate(240,0) scale(-1,1)' : undefined;
  return (
    <g transform={transform}>
      <Shoulders />
      {/* Hair flowing down the back (left side of a right-facing head) */}
      <path
        d="M70 70c-24 14-30 44-28 78 2 28 8 50 16 88 4-26 6-44 4-66 4 10 8 16 14 20-6-26-6-56 2-78-10 18-12 0-8-22 6-28 0-32-12-20z"
        fill={C.hair}
      />
      {/* Neck */}
      <path d="M104 196c-2 14 0 28 4 40 4 9 14 12 22 8s10-14 6-22c-6-12-10-20-10-30z" fill={C.skinShade} />
      {/* Face silhouette with forehead, nose, lips, chin facing right */}
      <path
        d="M84 96c-14 14-18 36-12 58 3 11 4 20 4 28l16 4 6-10 12-2-4-12 8-8-10-4 6-12c8-22 4-44-10-56-6-5-14-2-22 6z"
        fill={C.skin}
      />
      {/* Hair crown over the forehead */}
      <path
        d="M84 96c10-12 26-18 42-12 14 6 20 20 20 36-8-16-20-24-36-24-12 0-22 6-28 16-2-6-2-12 2-16z"
        fill={C.hairLight}
      />
      {/* Brow + eye + nostril */}
      <path d="M120 128c5 0 9 2 12 5" stroke={C.line} strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="126" cy="140" rx="4" ry="3.5" fill={C.line} />
      <path d="M104 162c3 2 6 2 8 0" stroke={C.skinShade} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Lips */}
      <path d="M100 174c5 3 11 2 14-1" stroke="#b9745f" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Back() {
  return (
    <g>
      <Shoulders />
      {/* Nape of neck peeking above the top */}
      <path d="M106 214h28v30h-28z" fill={C.skinShade} />
      {/* Full mane of hair from behind */}
      <path
        d="M120 40c44 0 68 30 68 76 0 36-6 64-14 102-4 18-12 28-22 30 4-26 4-50 0-78-2 14-6 24-12 30 4-30 2-64-6-96-6-20-8-40-14-50-6 10-8 30-14 50-8 32-10 66-6 96-6-6-10-16-12-30-4 28-4 52 0 78-10-2-18-12-22-30-8-38-14-66-14-102 0-46 24-76 68-76z"
        fill={C.hair}
      />
      {/* Centre part + flowing strands for depth */}
      <path d="M120 48v150" stroke={C.hairDark} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M96 80c-6 40-8 90-2 130" stroke={C.hairLight} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
      <path d="M144 80c6 40 8 90 2 130" stroke={C.hairLight} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
    </g>
  );
}

function Top() {
  return (
    <g>
      <Shoulders />
      {/* Tilted-forward head: crown fills the frame, face hidden below */}
      <path
        d="M120 40c46 0 74 32 74 84 0 44-12 86-32 110-12 14-26 22-42 22s-30-8-42-22c-20-24-32-66-32-110 0-52 28-84 74-84z"
        fill={C.hair}
      />
      {/* Crown swirl / centre part radiating outward */}
      <path d="M120 72v44" stroke={C.hairDark} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path
        d="M120 96c-18 6-34 22-44 44M120 96c18 6 34 22 44 44"
        stroke={C.hairLight}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d="M120 110c-26 14-44 40-52 76M120 110c26 14 44 40 52 76"
        stroke={C.hairLight}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* A sliver of forehead/skin at the very bottom where the head bows down */}
      <path d="M92 244c8 12 18 18 28 18s20-6 28-18c-9 6-18 9-28 9s-19-3-28-9z" fill={C.skinShade} />
    </g>
  );
}
