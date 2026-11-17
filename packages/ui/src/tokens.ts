/** Stable, website-safe token names; CSS exports the same values as --ci-*. */
export const UI_TOKENS = {
  light: {
    canvas: '#F7F8FA',
    surface: '#FFFFFF',
    text: '#17212B',
    muted: '#52606D',
    accent: '#0F766E',
    onAccent: '#FFFFFF',
    border: '#7B8794',
    warning: '#92400E',
    error: '#B42318',
  },
  dark: {
    canvas: '#151D25',
    surface: '#202C36',
    text: '#F2F5F7',
    muted: '#B9C5CF',
    accent: '#6EE7D2',
    onAccent: '#102821',
    border: '#8D9BA8',
    warning: '#FCD58A',
    error: '#FFADA6',
  },
  spacing: [4, 8, 12, 16, 24, 32, 48],
  fontFamily: 'Segoe UI, system-ui, sans-serif',
} as const;
