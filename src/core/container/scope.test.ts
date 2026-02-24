import { beforeEach, describe, expect, it } from 'vitest';
import { ScopeValidationError } from '../errors/scope-validation.ts';
import { BindingScope } from './binding.ts';
import { Container } from './container.ts';

describe('Container Scope Support', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('createScope', () => {
    it('should create a child container', () => {
      container.register('Logger', () => ({ log: (_msg: string) => {} }));

      const scope = container.createScope();

      expect(scope).toBeInstanceOf(Container);
      expect(scope.isRoot()).toBe(false);
      expect(container.isRoot()).toBe(true);
    });

    it('child container should inherit parent bindings', () => {
      container.register('Logger', () => ({ log: (_msg: string) => {} }));

      const scope = container.createScope();

      expect(scope.has('Logger')).toBe(true);
      expect(scope.getBinding('Logger')?.scope).toBe(BindingScope.TRANSIENT);
    });

    it('should not allow registration in child container', () => {
      const scope = container.createScope();

      expect(() => scope.register('NewService', () => ({}))).toThrow(/Cannot register bindings in child container/);
    });

    it('should support nested scopes', () => {
      container.register('Logger', () => ({ log: (_msg: string) => {} }));

      const scope1 = container.createScope();
      const scope2 = scope1.createScope();

      expect(scope2.has('Logger')).toBe(true);
      expect(scope2.isRoot()).toBe(false);
    });
  });

  describe('scoped caching', () => {
    it('should cache scoped services per scope', () => {
      let instanceCount = 0;
      container.register('ScopedService', () => ({ id: ++instanceCount })).asScoped();

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const instance1a = scope1.resolve('ScopedService');
      const instance1b = scope1.resolve('ScopedService');
      const instance2 = scope2.resolve('ScopedService');

      expect(instance1a).toBe(instance1b);
      expect(instance1a).not.toBe(instance2);
      expect(instanceCount).toBe(2);
    });

    it('should cache scoped services in child container not parent', () => {
      let instanceCount = 0;
      container.register('ScopedService', () => ({ id: ++instanceCount })).asScoped();

      const scope = container.createScope();

      const scopedInstance = scope.resolve('ScopedService');
      const anotherInstance = scope.resolve('ScopedService');

      expect(scopedInstance).toBe(anotherInstance);
      expect(instanceCount).toBe(1);
    });

    it('root container should also cache scoped services', () => {
      let instanceCount = 0;
      container.register('ScopedService', () => ({ id: ++instanceCount })).asScoped();

      const instance1 = container.resolve('ScopedService');
      const instance2 = container.resolve('ScopedService');

      expect(instance1).toBe(instance2);
      expect(instanceCount).toBe(1);
    });
  });

  describe('singleton across scopes', () => {
    it('singleton should be shared across all scopes', () => {
      let instanceCount = 0;
      container.register('SingletonService', () => ({ id: ++instanceCount })).asSingleton();

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const rootInstance = container.resolve('SingletonService');
      const scope1Instance = scope1.resolve('SingletonService');
      const scope2Instance = scope2.resolve('SingletonService');

      expect(rootInstance).toBe(scope1Instance);
      expect(scope1Instance).toBe(scope2Instance);
      expect(instanceCount).toBe(1);
    });
  });

  describe('transient across scopes', () => {
    it('transient should always create new instance', () => {
      let instanceCount = 0;
      container.register('TransientService', () => ({ id: ++instanceCount }));

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const instance1 = scope1.resolve('TransientService');
      const instance2 = scope1.resolve('TransientService');
      const instance3 = scope2.resolve('TransientService');

      expect(instance1).not.toBe(instance2);
      expect(instance2).not.toBe(instance3);
      expect(instanceCount).toBe(3);
    });
  });

  describe('mixed scopes', () => {
    it('should handle singleton depending on transient', () => {
      container.register('TransientDep', () => ({ value: Math.random() }));
      container
        .register('SingletonService', (c) => ({
          dep: c.resolve('TransientDep'),
        }))
        .asSingleton();

      const instance1 = container.resolve<{ dep: { value: number } }>('SingletonService');
      const instance2 = container.resolve<{ dep: { value: number } }>('SingletonService');

      expect(instance1).toBe(instance2);
      expect(instance1.dep).toBe(instance2.dep);
    });

    it('should handle scoped depending on singleton', () => {
      container.register('SingletonDep', () => ({ value: 'singleton' })).asSingleton();
      container
        .register('ScopedService', (c) => ({
          dep: c.resolve('SingletonDep'),
        }))
        .asScoped();

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const instance1 = scope1.resolve<{ dep: { value: string } }>('ScopedService');
      const instance2 = scope2.resolve<{ dep: { value: string } }>('ScopedService');

      expect(instance1).not.toBe(instance2);
      expect(instance1.dep).toBe(instance2.dep);
    });
  });

  describe('scope validation', () => {
    it('should throw when singleton depends on scoped', () => {
      container.register('ScopedDep', () => ({ value: 'scoped' })).asScoped();
      container
        .register('SingletonService', (c) => ({
          dep: c.resolve('ScopedDep'),
        }))
        .asSingleton();

      expect(() => container.validateScopes()).toThrow(ScopeValidationError);
    });

    it('should include token names in error message', () => {
      container.register('ScopedDep', () => ({ value: 'scoped' })).asScoped();
      container
        .register('SingletonService', (c) => ({
          dep: c.resolve('ScopedDep'),
        }))
        .asSingleton();

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
      container.register('TransientDep', () => ({ value: 'transient' }));
      container
        .register('SingletonService', (c) => ({
          dep: c.resolve('TransientDep'),
        }))
        .asSingleton();

      expect(() => container.validateScopes()).not.toThrow();
    });

    it('should pass when singleton depends on another singleton', () => {
      container.register('SingletonDep', () => ({ value: 'singleton' })).asSingleton();
      container
        .register('SingletonService', (c) => ({
          dep: c.resolve('SingletonDep'),
        }))
        .asSingleton();

      expect(() => container.validateScopes()).not.toThrow();
    });

    it('should throw when called on child container', () => {
      const scope = container.createScope();

      expect(() => scope.validateScopes()).toThrow(/validateScopes\(\) must be called on the root container/);
    });
  });

  describe('clear', () => {
    it('should only clear scoped cache in child container', () => {
      container.register('ScopedService', () => ({ id: 1 })).asScoped();
      container.register('SingletonService', () => ({ id: 2 })).asSingleton();

      const scope = container.createScope();
      scope.resolve('ScopedService');
      scope.resolve('SingletonService');

      scope.clear();

      expect(container.has('ScopedService')).toBe(true);
      expect(container.has('SingletonService')).toBe(true);
    });

    it('should clear all bindings in root container', () => {
      container.register('ScopedService', () => ({ id: 1 })).asScoped();
      container.register('SingletonService', () => ({ id: 2 })).asSingleton();

      container.clear();

      expect(container.has('ScopedService')).toBe(false);
      expect(container.has('SingletonService')).toBe(false);
    });
  });

  describe('has and getBinding inheritance', () => {
    it('has should check parent bindings', () => {
      container.register('Logger', () => ({ log: (_msg: string) => {} }));

      const scope = container.createScope();

      expect(scope.has('Logger')).toBe(true);
      expect(scope.has('NonExistent')).toBe(false);
    });

    it('getBinding should return parent binding', () => {
      container.register('Logger', () => ({ log: (_msg: string) => {} })).asSingleton();

      const scope = container.createScope();
      const binding = scope.getBinding('Logger');

      expect(binding).toBeDefined();
      expect(binding?.scope).toBe(BindingScope.SINGLETON);
    });
  });

  describe('error messages with parent container', () => {
    it('should include available tokens from parent when token not found in child', () => {
      container.register('Logger', () => ({ log: (_msg: string) => {} }));

      const scope = container.createScope();

      try {
        scope.resolve('NonExistent');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const err = error as Error;
        expect(err.message).toContain('NonExistent');
        expect(err.message).toContain('Logger');
      }
    });
  });

  describe('stub proxy during scope validation', () => {
    it('should handle factory accessing stub properties', () => {
      container.register('ScopedDep', () => ({ value: 'scoped' })).asScoped();
      container
        .register('SingletonService', (c) => {
          const dep = c.resolve('ScopedDep') as { value: string; toString: () => string };
          const _ = dep.value;
          const _str = dep.toString();
          return { dep };
        })
        .asSingleton();

      expect(() => container.validateScopes()).toThrow(ScopeValidationError);
    });

    it('should handle factory accessing then property on stub', () => {
      container.register('ScopedDep', () => ({ value: 'scoped' })).asScoped();
      container
        .register('SingletonService', (c) => {
          const dep = c.resolve('ScopedDep') as { then: unknown };
          const _then = dep.then;
          return { dep };
        })
        .asSingleton();

      expect(() => container.validateScopes()).toThrow(ScopeValidationError);
    });
  });
});
