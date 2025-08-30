import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { defineApp, appHooks, onApplicationInitialized } from './define-app.ts';
import { defineModuleFactory } from './define-module-factory.ts';

// Isolated tests that might interfere with other tests due to global hook state
describe('defineApp - isolated tests', () => {
  afterEach(() => {
    // Clear all hooks after each test to prevent global state interference
    appHooks.clear();
  });
  describe('error handling', () => {
    it('should handle errors in initialization hooks', async () => {
      let errorCaught = false;

      onApplicationInitialized(() => {
        throw new Error('Init error');
      });

      const testModule = defineModuleFactory.handler(() => {
        return { test: true };
      });

      try {
        await defineApp(() => testModule);
      } catch (error) {
        errorCaught = true;
        assert.ok(error instanceof Error);
        assert.strictEqual(error.message, 'Init error');
      }

      assert.strictEqual(errorCaught, true);
    });
  });
});
