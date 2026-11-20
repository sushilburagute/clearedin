const paths = {
  feed: 'M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h4',
  layers: 'm3 8 9-5 9 5-9 5z M3 12l9 5 9-5 M3 16l9 5 9-5',
  book: 'M3 5q5-2 9 1 4-3 9-1v14q-5-2-9 1-4-3-9-1z M12 6v14',
  help: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3 M12 17h.01',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  sliders: 'M3 6h6m4 0h8 M3 12h11m4 0h3 M3 18h3m4 0h11 M9 3v6m5 0v6M6 15v6',
  briefcase: 'M3 7h18v13H3z M8 7V4h8v3 M3 11q9 5 18 0 M11 13h2',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  hide: 'm3 3 18 18 M10 5q7-1 12 7l-3 4 M6 7q-3 2-4 5s4 7 10 7q3 0 5-2',
  check: 'm4 12 5 5L20 6',
  shield: 'M12 2 4 5v6q0 6 8 11 8-5 8-11V5z m-4 9 3 3 5-6',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  globe:
    'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M2 12h20 M12 2q-8 10 0 20 8-10 0-20',
  code: 'm7 6-6 6 6 6m10-12 6 6-6 6m-4-15-2 18',
  spark: 'm12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z',
  chat: 'M3 3h18v13H9l-6 5z M7 8h10 M7 12h6',
  clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2',
  reset: 'M3 4v6h6 M4 10a8 8 0 1 1 0 5',
} as const;

export type IconName = keyof typeof paths;
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
