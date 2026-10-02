const paths = [
  'M12 3V1 M12 23v-2 M3 12H1 M23 12h-2 M4 4l2 2 M18 18l2 2 M4 20l2-2 M18 6l2-2 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  'M12 2C10 6 5 11 5 15a7 7 0 0 0 14 0c0-4-5-9-7-13Z M8 15c0 2 1 3 3 3',
  'M8 5l1-2h6l1 2h4v15H4V5Z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 22v-3a8 8 0 0 1 16 0v3Z',
  'M5 15l2-9a5 5 0 0 1 10 0l2 9 M5 15h14 M3 16c-4 6 22 6 18 0 M6 12h12',
];
export function PreparationIcon({ index }: { index: number }) {
  return <svg className="landing__tip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[index]} /></svg>;
}
