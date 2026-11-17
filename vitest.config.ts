import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/**/tests/**/*.test.ts',
      'tests/evaluation/**/*.test.ts',
    ],
    environment: 'node',
    passWithNoTests: false,
  },
});
