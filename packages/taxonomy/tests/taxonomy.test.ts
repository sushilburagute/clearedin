import { CATEGORY_IDS, createDefaultSettings } from '@clearedin/contracts';
import { describe, expect, it } from 'vitest';
import { CATEGORY_DEFINITIONS, CATEGORY_DEFINITION_BY_ID } from '../src/index';

describe('taxonomy seed', () => {
  it('defines every contract category exactly once in stable order', () => {
    expect(CATEGORY_DEFINITIONS.map((entry) => entry.id)).toEqual([
      ...CATEGORY_IDS,
    ]);
    expect(new Set(CATEGORY_DEFINITIONS.map((entry) => entry.id)).size).toBe(
      12,
    );
    for (const entry of CATEGORY_DEFINITIONS) {
      expect(CATEGORY_DEFINITION_BY_ID[entry.id]).toBe(entry);
      expect(entry.definition.length).toBeGreaterThan(0);
      expect(entry.boundary.length).toBeGreaterThan(0);
      expect(entry.positiveExample).not.toBe(entry.negativeExample);
    }
  });

  it('reserves sponsored for a local disclosure and keeps default settings neutral', () => {
    expect(
      CATEGORY_DEFINITIONS.filter(
        (entry) => entry.source === 'local_disclosure',
      ),
    ).toEqual([CATEGORY_DEFINITION_BY_ID.sponsored]);
    expect(Object.values(createDefaultSettings().categoryModes)).toEqual(
      CATEGORY_IDS.map(() => 'show'),
    );
  });

  it('freezes shared definitions against accidental consumer mutation', () => {
    expect(Object.isFrozen(CATEGORY_DEFINITIONS)).toBe(true);
    expect(Object.isFrozen(CATEGORY_DEFINITION_BY_ID)).toBe(true);
    expect(CATEGORY_DEFINITIONS.every((entry) => Object.isFrozen(entry))).toBe(
      true,
    );
  });
});
