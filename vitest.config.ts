import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      exclude: [
        'node_modules',
        'dist',
        '**/index.ts', // Exclude barrel files
        '**/*.test.ts',
        '**/*.type-tests.ts',
        'src/core/controller/controller.ts', // No executable code, just type declarations
      ],
      thresholds: {
        // Realistic thresholds - remaining uncovered lines are:
        // - Dead code (private getRoot() method never called)
        // - Unreachable code (child bindings can't be registered)
        // - Environment-dependent (captureStackTrace else branch)
        // - Hard-to-simulate server errors
        lines: 98,
        functions: 98,
        branches: 93,
        statements: 98,
      },
    },
  },
});
