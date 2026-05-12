import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    dts: {
      oxc: true,
    },
    exports: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
    typecheck: {
      enabled: true,
      include: ['src/**/*.test-d.ts'],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        100: true,
      },
    },
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
