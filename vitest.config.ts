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
        // - Dead code in container.ts:
        //   - Line 139: resolver.has() only used for external resolvers
        //   - Line 177: fallback instantiation (inject validated at registration)
        //   - Line 202: child container bindings (children can't register)
        //   - Line 255: fallback deps extraction (inject validated at registration)
        lines: 95,
        functions: 93,
        branches: 94,
        statements: 95,
      },
    },
  },
});
