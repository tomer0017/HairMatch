/** Decorative framing only: never participates in detection or capture. */
export function FramingGuide({ stepId }: { stepId?: string }) {
  const profile = stepId === 'right-profile' || stepId === 'left-profile';
  const path = stepId === 'top'
    ? 'M50 43 C49 13 68 6 100 6 C132 6 151 13 150 43 C150 73 132 99 100 105 C68 99 50 73 50 43 Z'
    : profile
      ? 'M42 192 C42 159 44 133 50 107 C53 94 47 78 49 58 C51 25 69 9 97 9 C126 9 140 29 139 49 L151 70 Q154 75 142 78 L143 88 Q146 94 134 96 L126 108 L126 127 Q159 134 169 161 L177 192'
      : 'M26 192 C26 155 35 135 43 111 C49 93 44 71 49 48 C56 20 74 9 100 9 C126 9 144 20 151 48 C156 71 151 93 157 111 C165 135 174 155 174 192';
  return (
    <svg className={`framing-guide${stepId === 'top' ? ' framing-guide--top' : ''}`} viewBox="0 0 200 210" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <path d={path} transform={stepId === 'left-profile' ? 'translate(200 0) scale(-1 1)' : undefined} />
    </svg>
  );
}
