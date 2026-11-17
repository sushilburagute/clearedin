import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UI_TOKENS } from '../src/tokens';

function luminance(hex: string) {
  const rgb = hex.match(/[a-f0-9]{2}/gi)!.map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

describe('shared light and dark palette', () => {
  for (const theme of ['light', 'dark'] as const) {
    const tokens = UI_TOKENS[theme];
    it(`${theme}: body, muted, status, and link text meet 4.5:1`, () => {
      for (const background of [tokens.canvas, tokens.surface]) {
        for (const color of [
          tokens.text,
          tokens.muted,
          tokens.accent,
          tokens.warning,
          tokens.error,
        ]) {
          expect(
            contrast(color, background),
            `${color} on ${background}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(tokens.border, background)).toBeGreaterThanOrEqual(3);
      }
      expect(contrast(tokens.onAccent, tokens.accent)).toBeGreaterThanOrEqual(
        4.5,
      );
    });
  }
  it('ships the same colors in CSS and supports reduced motion, focus, and narrow layouts', () => {
    const css = readFileSync(
      new URL('../src/styles.css', import.meta.url),
      'utf8',
    );
    for (const theme of [UI_TOKENS.light, UI_TOKENS.dark]) {
      for (const color of Object.values(theme))
        expect(css.toLowerCase()).toContain(color.toLowerCase());
    }
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toMatch(/max-width:\s*100vw/);
  });
});
