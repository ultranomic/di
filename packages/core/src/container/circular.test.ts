import { beforeEach, describe, expect, it } from 'vitest';
import type { Token } from '../types/token.ts';
import { Container } from './container.ts';

describe('Circular Dependencies', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('basic circular dependency', () => {
    it('should resolve ServiceA -> ServiceB -> ServiceA without throwing', () => {
      class ServiceA {
        static readonly inject = ['ServiceB'] as const;
        constructor(private _serviceB: unknown) {}
        getValue() {
          return 'A';
        }
      }

      class ServiceB {
        static readonly inject = ['ServiceA'] as const;
        constructor(private _serviceA: unknown) {}
        getValue() {
          return 'B';
        }
      }

      container.register('ServiceA', (c) => new ServiceA(...c.buildDeps(ServiceA.inject)));
      container.register('ServiceB', (c) => new ServiceB(...c.buildDeps(ServiceB.inject)));

      expect(() => container.resolve('ServiceA')).not.toThrow();
    });

    it('should allow accessing circular dependency properties after resolution', () => {
      class ServiceA {
        static readonly inject = ['ServiceB'] as const;
        constructor(private serviceB: unknown) {}
        getValue() {
          return 'A';
        }
        getBValue() {
          return (this.serviceB as { getValue: () => string }).getValue();
        }
      }

      class ServiceB {
        static readonly inject = ['ServiceA'] as const;
        constructor(private _serviceA: unknown) {}
        getValue() {
          return 'B';
        }
      }

      container.register('ServiceA', (c) => new ServiceA(...c.buildDeps(ServiceA.inject)));
      container.register('ServiceB', (c) => new ServiceB(...c.buildDeps(ServiceB.inject)));

      const serviceA = container.resolve('ServiceA') as ServiceA;

      expect(serviceA.getBValue()).toBe('B');
    });

    it('should work with both directions of circular dependency', () => {
      class ServiceA {
        static readonly inject = ['ServiceB'] as const;
        constructor(private _serviceB: unknown) {}
        getValue() {
          return 'A';
        }
      }

      class ServiceB {
        static readonly inject = ['ServiceA'] as const;
        constructor(private _serviceA: unknown) {}
        getValue() {
          return 'B';
        }
      }

      container.register('ServiceA', (c) => new ServiceA(...c.buildDeps(ServiceA.inject)));
      container.register('ServiceB', (c) => new ServiceB(...c.buildDeps(ServiceB.inject)));

      const serviceA = container.resolve('ServiceA') as ServiceA;
      const serviceB = container.resolve('ServiceB') as ServiceB;

      expect(serviceA.getValue()).toBe('A');
      expect(serviceB.getValue()).toBe('B');
    });
  });

  describe('proxy edge cases', () => {
    it('should handle await on proxy without TypeError (then returns undefined)', async () => {
      class ServiceA {
        static readonly inject = ['ServiceB'] as const;
        constructor(private serviceB: unknown) {}
      }

      class ServiceB {
        static readonly inject = ['ServiceA'] as const;
        constructor(private _serviceA: unknown) {}
      }

      container.register('ServiceA', (c) => new ServiceA(...c.buildDeps(ServiceA.inject)));
      container.register('ServiceB', (c) => new ServiceB(...c.buildDeps(ServiceB.inject)));

      const serviceA = container.resolve('ServiceA') as ServiceA;

      const result = await (serviceA as unknown as { serviceB: unknown }).serviceB;
      expect(result).toBeDefined();
    });

    it('should handle toString on proxy for logging', () => {
      class ServiceA {
        static readonly inject = ['ServiceB'] as const;
        constructor(private serviceB: unknown) {}
      }

      class ServiceB {
        static readonly inject = ['ServiceA'] as const;
        constructor(private _serviceA: unknown) {}
      }

      container.register('ServiceA', (c) => new ServiceA(...c.buildDeps(ServiceA.inject)));
      container.register('ServiceB', (c) => new ServiceB(...c.buildDeps(ServiceB.inject)));

      const serviceA = container.resolve('ServiceA') as ServiceA;

      const str = String((serviceA as unknown as { serviceB: unknown }).serviceB);
      expect(typeof str).toBe('string');
    });

    it('should handle console.log style inspection', () => {
      class ServiceA {
        static readonly inject = ['ServiceB'] as const;
        constructor(private serviceB: unknown) {}
      }

      class ServiceB {
        static readonly inject = ['ServiceA'] as const;
        constructor(private _serviceA: unknown) {}
      }

      container.register('ServiceA', (c) => new ServiceA(...c.buildDeps(ServiceA.inject)));
      container.register('ServiceB', (c) => new ServiceB(...c.buildDeps(ServiceB.inject)));

      const serviceA = container.resolve('ServiceA') as ServiceA;

      const str = Object.prototype.toString.call((serviceA as unknown as { serviceB: unknown }).serviceB);
      expect(typeof str).toBe('string');
    });

    it('should return specific string from toString() on proxy during construction', () => {
      let capturedProxy: { toString: () => string } | null = null;

      class ServiceA {
        static readonly inject = ['ServiceB'] as const;
        constructor(private _serviceB: unknown) {}
      }

      class ServiceB {
        static readonly inject = ['ServiceA'] as const;
        constructor(serviceA: unknown) {
          capturedProxy = serviceA as { toString: () => string };
        }
      }

      container.register('ServiceA', (c) => new ServiceA(...c.buildDeps(ServiceA.inject)));
      container.register('ServiceB', (c) => new ServiceB(...c.buildDeps(ServiceB.inject)));

      container.resolve('ServiceA');

      expect(capturedProxy).not.toBeNull();
      const result = (capturedProxy as unknown as { toString: () => string }).toString();
      expect(result).toBe('[CircularProxy: ServiceA]');
    });

    it('should return CircularProxy as Symbol.toStringTag on proxy', () => {
      let capturedProxy: { [Symbol.toStringTag]?: string } | null = null;

      class ServiceA {
        static readonly inject = ['ServiceB'] as const;
        constructor(private _serviceB: unknown) {}
      }

      class ServiceB {
        static readonly inject = ['ServiceA'] as const;
        constructor(serviceA: unknown) {
          capturedProxy = serviceA as { [Symbol.toStringTag]?: string };
        }
      }

      container.register('ServiceA', (c) => new ServiceA(...c.buildDeps(ServiceA.inject)));
      container.register('ServiceB', (c) => new ServiceB(...c.buildDeps(ServiceB.inject)));

      container.resolve('ServiceA');

      expect(capturedProxy).not.toBeNull();
      expect(capturedProxy?.[Symbol.toStringTag]).toBe('CircularProxy');
    });

    it('should forward property access through proxy after instance is resolved', () => {
      let capturedProxy: { getValue: () => string } | null = null;
      class ServiceA {
        static readonly inject = ['ServiceB'] as const;
        constructor(private _serviceB: unknown) {}
        getValue() {
          return 'A';
        }
      }

      class ServiceB {
        static readonly inject = ['ServiceA'] as const;
        constructor(serviceA: unknown) {
          capturedProxy = serviceA as { getValue: () => string };
        }
      }

      container.register('ServiceA', (c) => new ServiceA(...c.buildDeps(ServiceA.inject))).asSingleton();
      container.register('ServiceB', (c) => new ServiceB(...c.buildDeps(ServiceB.inject))).asSingleton();

      container.resolve('ServiceA');

      expect(capturedProxy).not.toBeNull();
      expect((capturedProxy as unknown as { getValue: () => string }).getValue()).toBe('A');
    });

    it('should forward non-function property access through proxy after instance is resolved', () => {
      let capturedProxy: { value: string } | null = null;

      class ServiceA {
        static readonly inject = ['ServiceB'] as const;
        constructor(private _serviceB: unknown) {}
        readonly value = 'test-value';
      }

      class ServiceB {
        static readonly inject = ['ServiceA'] as const;
        constructor(serviceA: unknown) {
          capturedProxy = serviceA as { value: string };
        }
      }

      container.register('ServiceA', (c) => new ServiceA(...c.buildDeps(ServiceA.inject))).asSingleton();
      container.register('ServiceB', (c) => new ServiceB(...c.buildDeps(ServiceB.inject))).asSingleton();

      container.resolve('ServiceA');

      expect(capturedProxy).not.toBeNull();
      expect((capturedProxy as unknown as { value: string }).value).toBe('test-value');
    });

    it('should return undefined for then property on circular proxy', () => {
      let capturedThen: unknown = 'not-set';

      class ServiceA {
        static readonly inject = ['ServiceB'] as const;
        constructor(private _serviceB: unknown) {}
      }

      class ServiceB {
        static readonly inject = ['ServiceA'] as const;
        constructor(serviceA: unknown) {
          const proxy = serviceA as { then: unknown };
          capturedThen = proxy.then;
        }
      }

      container.register('ServiceA', (c) => new ServiceA(...c.buildDeps(ServiceA.inject)));
      container.register('ServiceB', (c) => new ServiceB(...c.buildDeps(ServiceB.inject)));

      container.resolve('ServiceA');

      expect(capturedThen).toBeUndefined();
    });

    it('should return undefined for non-existent property on proxy', () => {
      let accessedValue: unknown = 'not-set';
      class ServiceA {
        static readonly inject = ['ServiceB'] as const;
        constructor(private _serviceB: unknown) {}
      }
      class ServiceB {
        static readonly inject = ['ServiceA'] as const;
        constructor(serviceA: unknown) {
          const proxy = serviceA as { nonExistent: unknown };
          accessedValue = proxy.nonExistent;
        }
      }
      container.register('ServiceA', (c) => new ServiceA(...c.buildDeps(ServiceA.inject)));
      container.register('ServiceB', (c) => new ServiceB(...c.buildDeps(ServiceB.inject)));
      container.resolve('ServiceA');

      expect(accessedValue).toBeUndefined();
    });
  });

  describe('singleton circular dependencies', () => {
    it('should resolve singleton circular dependencies correctly', () => {
      class ServiceA {
        static readonly inject = ['ServiceB'] as const;
        constructor(private _serviceB: unknown) {}
        getValue() {
          return 'A';
        }
      }

      class ServiceB {
        static readonly inject = ['ServiceA'] as const;
        constructor(private _serviceA: unknown) {}
        getValue() {
          return 'B';
        }
      }

      container.register('ServiceA', (c) => new ServiceA(...c.buildDeps(ServiceA.inject))).asSingleton();
      container.register('ServiceB', (c) => new ServiceB(...c.buildDeps(ServiceB.inject))).asSingleton();

      const serviceA1 = container.resolve('ServiceA');
      const serviceA2 = container.resolve('ServiceA');

      expect(serviceA1).toBe(serviceA2);
    });

    it('should forward method calls through circular proxy', () => {
      class ServiceA {
        static readonly inject = ['ServiceB'] as const;
        constructor(private _serviceB: unknown) {}
        getValue() {
          return 'A';
        }
      }

      class ServiceB {
        static readonly inject = ['ServiceA'] as const;
        constructor(private serviceA: unknown) {}
        getValue() {
          return 'B';
        }
        getAValue() {
          return (this.serviceA as ServiceA).getValue();
        }
      }

      container.register('ServiceA', (c) => new ServiceA(...c.buildDeps(ServiceA.inject))).asSingleton();
      container.register('ServiceB', (c) => new ServiceB(...c.buildDeps(ServiceB.inject))).asSingleton();

      const serviceA = container.resolve('ServiceA') as ServiceA;
      const serviceB = container.resolve('ServiceB') as ServiceB;

      expect(serviceA.getValue()).toBe('A');
      expect(serviceB.getValue()).toBe('B');
      expect(serviceB.getAValue()).toBe('A');
    });
  });

  describe('complex circular dependencies', () => {
    it('should handle three-way circular dependency', () => {
      class ServiceA {
        static readonly inject = ['ServiceB'] as const;
        constructor(private _serviceB: unknown) {}
        getValue() {
          return 'A';
        }
      }

      class ServiceB {
        static readonly inject = ['ServiceC'] as const;
        constructor(private _serviceC: unknown) {}
        getValue() {
          return 'B';
        }
      }

      class ServiceC {
        static readonly inject = ['ServiceA'] as const;
        constructor(private _serviceA: unknown) {}
        getValue() {
          return 'C';
        }
      }

      container.register('ServiceA', (c) => new ServiceA(...c.buildDeps(ServiceA.inject)));
      container.register('ServiceB', (c) => new ServiceB(...c.buildDeps(ServiceB.inject)));
      container.register('ServiceC', (c) => new ServiceC(...c.buildDeps(ServiceC.inject)));

      expect(() => container.resolve('ServiceA')).not.toThrow();
    });

    it('should handle self-referencing dependency', () => {
      class Service {
        static readonly inject = ['Service'] as const;
        constructor(private _self: unknown) {}
        getValue() {
          return 'value';
        }
      }

      container.register('Service', (c) => new Service(...c.buildDeps(Service.inject)));

      const service = container.resolve('Service') as Service;
      expect(service.getValue()).toBe('value');
    });
  });
});
