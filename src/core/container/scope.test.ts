import { beforeEach, describe, expect, it } from 'vitest';
import { ScopeValidationError } from '../errors/scope-validation.ts';
import { Scope } from './binding.ts';
import { Container } from './container.ts';
import type { DepsTokens } from '../types/deps.ts';

describe('Container Scope Support', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('createScope', () => {
    it('should create a child container', () => {
      class Logger {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        log(_msg: string) {}
      }
      container.register(Logger);

      const scope = container.createScope();

      expect(scope).toBeInstanceOf(Container);
      expect(scope.isRoot()).toBe(false);
      expect(container.isRoot()).toBe(true);
    });

    it('child container should inherit parent bindings', () => {
      class Logger {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        log(_msg: string) {}
      }
      container.register(Logger);

      const scope = container.createScope();

      expect(scope.has(Logger)).toBe(true);
      expect(scope.getBinding(Logger)?.scope).toBe(Scope.SINGLETON);
    });

    it('should not allow registration in child container', () => {
      class NewService {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        data = 'test';
      }
      const scope = container.createScope();

      expect(() => scope.register(NewService)).toThrow(
        /Cannot register bindings in child container/,
      );
    });

    it('should support nested scopes', () => {
      class Logger {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        log(_msg: string) {}
      }
      container.register(Logger);

      const scope1 = container.createScope();
      const scope2 = scope1.createScope();

      expect(scope2.has(Logger)).toBe(true);
      expect(scope2.isRoot()).toBe(false);
    });
  });

  describe('scoped caching', () => {
    it('should cache scoped services per scope', () => {
      let instanceCount = 0;
      class ScopedService {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        id: number;
        constructor() {
          this.id = ++instanceCount;
        }
      }
      container.register(ScopedService, { scope: Scope.SCOPED });

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const instance1a = scope1.resolve(ScopedService);
      const instance1b = scope1.resolve(ScopedService);
      const instance2 = scope2.resolve(ScopedService);

      expect(instance1a).toBe(instance1b);
      expect(instance1a).not.toBe(instance2);
      expect(instanceCount).toBe(2);
    });

    it('should cache scoped services in child container not parent', () => {
      let instanceCount = 0;
      class ScopedService {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        id: number;
        constructor() {
          this.id = ++instanceCount;
        }
      }
      container.register(ScopedService, { scope: Scope.SCOPED });

      const scope = container.createScope();

      const scopedInstance = scope.resolve(ScopedService);
      const anotherInstance = scope.resolve(ScopedService);

      expect(scopedInstance).toBe(anotherInstance);
      expect(instanceCount).toBe(1);
    });

    it('root container should also cache scoped services', () => {
      let instanceCount = 0;
      class ScopedService {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        id: number;
        constructor() {
          this.id = ++instanceCount;
        }
      }
      container.register(ScopedService, { scope: Scope.SCOPED });

      const instance1 = container.resolve(ScopedService);
      const instance2 = container.resolve(ScopedService);

      expect(instance1).toBe(instance2);
      expect(instanceCount).toBe(1);
    });
  });

  describe('singleton across scopes', () => {
    it('singleton should be shared across all scopes', () => {
      let instanceCount = 0;
      class SingletonService {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        id: number;
        constructor() {
          this.id = ++instanceCount;
        }
      }
      container.register(SingletonService);

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const rootInstance = container.resolve(SingletonService);
      const scope1Instance = scope1.resolve(SingletonService);
      const scope2Instance = scope2.resolve(SingletonService);

      expect(rootInstance).toBe(scope1Instance);
      expect(scope1Instance).toBe(scope2Instance);
      expect(instanceCount).toBe(1);
    });
  });

  describe('transient across scopes', () => {
    it('transient should always create new instance', () => {
      let instanceCount = 0;
      class TransientService {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        id: number;
        constructor() {
          this.id = ++instanceCount;
        }
      }
      container.register(TransientService, { scope: Scope.TRANSIENT });

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const instance1 = scope1.resolve(TransientService);
      const instance2 = scope1.resolve(TransientService);
      const instance3 = scope2.resolve(TransientService);

      expect(instance1).not.toBe(instance2);
      expect(instance2).not.toBe(instance3);
      expect(instanceCount).toBe(3);
    });
  });

  describe('mixed scopes', () => {
    it('should handle singleton depending on transient', () => {
      class TransientDep {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        value: number;
        constructor() {
          this.value = Math.random();
        }
      }
      class SingletonService {
        static readonly inject = [TransientDep] as const satisfies DepsTokens<typeof this>;
        dep: TransientDep;
        constructor(dep: TransientDep) {
          this.dep = dep;
        }
      }
      container.register(TransientDep, { scope: Scope.TRANSIENT });
      container.register(SingletonService);

      const instance1 = container.resolve(SingletonService);
      const instance2 = container.resolve(SingletonService);

      expect(instance1).toBe(instance2);
      expect(instance1.dep).toBe(instance2.dep);
    });

    it('should handle scoped depending on singleton', () => {
      class SingletonDep {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        value = 'singleton';
      }
      class ScopedService {
        static readonly inject = [SingletonDep] as const satisfies DepsTokens<typeof this>;
        dep: SingletonDep;
        constructor(dep: SingletonDep) {
          this.dep = dep;
        }
      }
      container.register(SingletonDep);
      container.register(ScopedService, { scope: Scope.SCOPED });

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const instance1 = scope1.resolve(ScopedService);
      const instance2 = scope2.resolve(ScopedService);

      expect(instance1).not.toBe(instance2);
      expect(instance1.dep).toBe(instance2.dep);
    });
  });

  describe('scope validation', () => {
    it('should throw when singleton depends on scoped', () => {
      class ScopedDep {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        value = 'scoped';
      }
      class SingletonService {
        static readonly inject = [ScopedDep] as const satisfies DepsTokens<typeof this>;
        dep: ScopedDep;
        constructor(dep: ScopedDep) {
          this.dep = dep;
        }
      }
      container.register(ScopedDep, { scope: Scope.SCOPED });
      container.register(SingletonService);

      expect(() => container.validateScopes()).toThrow(ScopeValidationError);
    });

    it('should include token names in error message', () => {
      class ScopedDep {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        value = 'scoped';
      }
      class SingletonService {
        static readonly inject = [ScopedDep] as const satisfies DepsTokens<typeof this>;
        dep: ScopedDep;
        constructor(dep: ScopedDep) {
          this.dep = dep;
        }
      }
      container.register(ScopedDep, { scope: Scope.SCOPED });
      container.register(SingletonService);

      try {
        container.validateScopes();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ScopeValidationError);
        const err = error as ScopeValidationError;
        expect(err.parentToken).toBe('SingletonService');
        expect(err.scopedToken).toBe('ScopedDep');
        expect(err.message).toContain('SingletonService');
        expect(err.message).toContain('ScopedDep');
      }
    });

    it('should pass when singleton depends on transient', () => {
      class TransientDep {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        value = 'transient';
      }
      class SingletonService {
        static readonly inject = [TransientDep] as const satisfies DepsTokens<typeof this>;
        dep: TransientDep;
        constructor(dep: TransientDep) {
          this.dep = dep;
        }
      }
      container.register(TransientDep, { scope: Scope.TRANSIENT });
      container.register(SingletonService);

      expect(() => container.validateScopes()).not.toThrow();
    });

    it('should pass when singleton depends on another singleton', () => {
      class SingletonDep {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        value = 'singleton';
      }
      class SingletonService {
        static readonly inject = [SingletonDep] as const satisfies DepsTokens<typeof this>;
        dep: SingletonDep;
        constructor(dep: SingletonDep) {
          this.dep = dep;
        }
      }
      container.register(SingletonDep);
      container.register(SingletonService);

      expect(() => container.validateScopes()).not.toThrow();
    });

    it('should throw when called on child container', () => {
      const scope = container.createScope();

      expect(() => scope.validateScopes()).toThrow(/validateScopes\(\) must be called on the root container/);
    });
  });

  describe('clear', () => {
    it('should only clear scoped cache in child container', () => {
      class ScopedService {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        id = 1;
      }
      class SingletonService {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        id = 2;
      }
      container.register(ScopedService, { scope: Scope.SCOPED });
      container.register(SingletonService);

      const scope = container.createScope();
      scope.resolve(ScopedService);
      scope.resolve(SingletonService);

      scope.clear();

      expect(container.has(ScopedService)).toBe(true);
      expect(container.has(SingletonService)).toBe(true);
    });

    it('should clear all bindings in root container', () => {
      class ScopedService {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        id = 1;
      }
      class SingletonService {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        id = 2;
      }
      container.register(ScopedService, { scope: Scope.SCOPED });
      container.register(SingletonService);

      container.clear();

      expect(container.has(ScopedService)).toBe(false);
      expect(container.has(SingletonService)).toBe(false);
    });
  });

  describe('has and getBinding inheritance', () => {
    it('has should check parent bindings', () => {
      class Logger {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        log(_msg: string) {}
      }
      container.register(Logger);

      const scope = container.createScope();

      expect(scope.has(Logger)).toBe(true);
      class NonExistent {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
      }
      expect(scope.has(NonExistent)).toBe(false);
    });

    it('getBinding should return parent binding', () => {
      class Logger {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        log(_msg: string) {}
      }
      container.register(Logger);

      const scope = container.createScope();
      const binding = scope.getBinding(Logger);

      expect(binding).toBeDefined();
      expect(binding?.scope).toBe(Scope.SINGLETON);
    });
  });

  describe('error messages with parent container', () => {
    it('should include available tokens from parent when token not found in child', () => {
      class Logger {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
        log(_msg: string) {}
      }
      container.register(Logger);

      const scope = container.createScope();

      class NonExistent {
        static readonly inject = [] as const satisfies DepsTokens<typeof this>;
      }
      try {
        scope.resolve(NonExistent);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const err = error as Error;
        expect(err.message).toContain('NonExistent');
        expect(err.message).toContain('Logger');
      }
    });
  });
});
