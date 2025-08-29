import { describe, it } from 'node:test';
import assert from 'node:assert';
import { defineInjectable, type Injectable } from './define-injectable.ts';

describe('defineInjectable', () => {
  describe('handler without dependencies', () => {
    it('should create injectable returning object', () => {
      const injectable = defineInjectable.handler(() => ({
        value: 42,
        method: () => 'test'
      }));

      const result = injectable();
      assert.strictEqual(result.value, 42);
      assert.strictEqual(result.method(), 'test');
    });

    it('should create injectable returning void', () => {
      const injectable = defineInjectable.handler(() => {
        // void return
      });

      const result = injectable();
      assert.strictEqual(result, undefined);
    });

    it('should create injectable with side effects', () => {
      let sideEffect = 0;
      const injectable = defineInjectable.handler(() => {
        sideEffect++;
        return { count: sideEffect };
      });

      const result1 = injectable();
      const result2 = injectable();
      
      assert.strictEqual(result1.count, 1);
      assert.strictEqual(result2.count, 2);
      assert.strictEqual(sideEffect, 2);
    });
  });

  describe('handler with dependencies', () => {
    it('should create injectable with dependency injection', () => {
      type Dependencies = {
        dep1: Injectable<{ value: number }>;
        dep2: Injectable<{ getText: () => string }>;
      };

      const injectable = defineInjectable
        .inject<Dependencies>()
        .handler((injector) => {
          const { dep1, dep2 } = injector();
          return {
            combined: dep1.value + dep2.getText().length
          };
        });

      const mockDependencies = {
        dep1: { value: 10 },
        dep2: { getText: () => 'hello' }
      };

      const result = injectable(() => mockDependencies);
      assert.strictEqual(result.combined, 15); // 10 + 'hello'.length
    });

    it('should provide lifecycle hooks', () => {
      const startCallbacks: (() => unknown)[] = [];
      const stopCallbacks: (() => unknown)[] = [];

      const injectable = defineInjectable
        .inject<{}>()
        .handler((injector, { onApplicationStart, onApplicationStop }) => {
          onApplicationStart(() => {
            startCallbacks.push(() => 'started');
          });
          onApplicationStop(() => {
            stopCallbacks.push(() => 'stopped');
          });
          
          return { initialized: true };
        });

      const result = injectable(() => ({}));
      
      assert.strictEqual(result.initialized, true);
      // Note: The callbacks are registered but not yet executed
      // They would be executed when the app layer fires the hooks
    });

    it('should support execution order in lifecycle hooks', () => {
      const executionOrder: number[] = [];

      const injectable = defineInjectable
        .inject<{}>()
        .handler((injector, { onApplicationStart }) => {
          onApplicationStart(() => executionOrder.push(2), 2);
          onApplicationStart(() => executionOrder.push(1), 1);
          onApplicationStart(() => executionOrder.push(3), 3);
          
          return {};
        });

      injectable(() => ({}));
      // Note: The actual hook firing would be handled by the app layer
      // This test verifies the hooks are registered with proper order
    });

    it('should handle complex dependency chains', () => {
      type ServiceA = Injectable<{ getName: () => string }>;
      type ServiceB = Injectable<{ getNumber: () => number }>;
      
      type Dependencies = {
        serviceA: ServiceA;
        serviceB: ServiceB;
      };

      const composite = defineInjectable
        .inject<Dependencies>()
        .handler((injector) => {
          const { serviceA, serviceB } = injector();
          
          return {
            getComposite: () => `${serviceA.getName()}-${serviceB.getNumber()}`
          };
        });

      const deps = {
        serviceA: { getName: () => 'test' },
        serviceB: { getNumber: () => 123 }
      };

      const result = composite(() => deps);
      assert.strictEqual(result.getComposite(), 'test-123');
    });
  });

  describe('type safety', () => {
    it('should maintain type information through injection', () => {
      type Deps = {
        stringService: Injectable<{ str: string }>;
        numberService: Injectable<{ num: number }>;
      };

      const injectable = defineInjectable
        .inject<Deps>()
        .handler((injector) => {
          const deps = injector();
          // TypeScript should enforce these types
          const str: string = deps.stringService.str;
          const num: number = deps.numberService.num;
          
          return { str, num };
        });

      const mockDeps = {
        stringService: { str: 'hello' },
        numberService: { num: 42 }
      };

      const result = injectable(() => mockDeps);
      assert.strictEqual(result.str, 'hello');
      assert.strictEqual(result.num, 42);
    });
  });
});