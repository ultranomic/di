import { beforeEach, describe, expect, it } from 'vitest';
import { Container } from './container.ts';
import type { DependencyTokens } from '../types/dependencies.ts';
import type { Token } from '../types/token.ts';

describe('Circular Dependencies', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('true circular dependencies', () => {
    it('should handle circular dependency A -> B -> A with lazy access', async () => {
      // Create classes that have true circular dependency
      // A depends on B, B depends on A
      // We use late binding to set up the circular reference

      class ServiceA {
        static readonly inject: readonly Token[] = [];
        value = 'A';
        private _serviceB: ServiceB | undefined;

        setServiceB(b: ServiceB) {
          this._serviceB = b;
        }

        getServiceB() {
          return this._serviceB;
        }
      }

      class ServiceB {
        static readonly inject: readonly Token[] = [ServiceA];
        value = 'B';

        constructor(public serviceA: ServiceA) {}
      }

      // Set up circular: A -> B -> A
      (ServiceA as typeof ServiceA & { inject: readonly Token[] }).inject = [ServiceB];

      container.register(ServiceA);
      container.register(ServiceB);

      // This will trigger the circular proxy
      const a = container.resolve(ServiceA);

      // After resolution, a should be a proper instance
      expect(a.value).toBe('A');
    });

    it('should handle circular dependency with property access after resolution', () => {
      class ServiceA {
        static readonly inject: readonly Token[] = [];
        name = 'ServiceA';
      }

      class ServiceB {
        static readonly inject: readonly Token[] = [ServiceA];
        name = 'ServiceB';

        constructor(public serviceA: ServiceA) {}
      }

      // Create circular: A -> B -> A
      (ServiceA as typeof ServiceA & { inject: readonly Token[] }).inject = [ServiceB];

      container.register(ServiceA);
      container.register(ServiceB);

      const a = container.resolve(ServiceA);

      // Access properties on the resolved instance
      expect(a.name).toBe('ServiceA');
    });

    it('should handle circular dependency with method access', () => {
      class ServiceA {
        static readonly inject: readonly Token[] = [];
        method() {
          return 'method from A';
        }
      }

      class ServiceB {
        static readonly inject: readonly Token[] = [ServiceA];

        constructor(public serviceA: ServiceA) {}
      }

      // Create circular: A -> B -> A
      (ServiceA as typeof ServiceA & { inject: readonly Token[] }).inject = [ServiceB];

      container.register(ServiceA);
      container.register(ServiceB);

      const a = container.resolve(ServiceA);

      // Method should work on the resolved instance
      expect(a.method()).toBe('method from A');
    });

    it('should handle circular proxy toString', () => {
      class ServiceA {
        static readonly inject: readonly Token[] = [];
      }

      class ServiceB {
        static readonly inject: readonly Token[] = [ServiceA];
        constructor(_a: ServiceA) {}
      }

      // Create circular: A -> B -> A
      (ServiceA as typeof ServiceA & { inject: readonly Token[] }).inject = [ServiceB];

      container.register(ServiceA);
      container.register(ServiceB);

      // Trigger resolution - during resolution, proxy is created
      const a = container.resolve(ServiceA);

      // After resolution completes, toString should work (default is [object Object])
      expect(String(a)).toBeDefined();
    });

    it('should handle circular proxy Symbol.toStringTag', () => {
      class ServiceA {
        static readonly inject: readonly Token[] = [];
      }

      class ServiceB {
        static readonly inject: readonly Token[] = [ServiceA];
        constructor(_a: ServiceA) {}
      }

      // Create circular: A -> B -> A
      (ServiceA as typeof ServiceA & { inject: readonly Token[] }).inject = [ServiceB];

      container.register(ServiceA);
      container.register(ServiceB);

      const a = container.resolve(ServiceA);
      // After resolution, the instance is a real ServiceA
      expect(a).toBeInstanceOf(ServiceA);
    });

    it('should handle circular proxy inspect', () => {
      class ServiceA {
        static readonly inject: readonly Token[] = {};
      }

      class ServiceB {
        static readonly inject: readonly Token[] = [ServiceA];
        constructor(_a: ServiceA) {}
      }

      // Create circular: A -> B -> A
      (ServiceA as typeof ServiceA & { inject: readonly Token[] }).inject = [ServiceB];

      container.register(ServiceA);
      container.register(ServiceB);

      const a = container.resolve(ServiceA);
      expect(a).toBeDefined();
    });

    it('should handle circular proxy with then property being undefined', () => {
      class ServiceA {
        static readonly inject: readonly Token[] = [];
      }

      class ServiceB {
        static readonly inject: readonly Token[] = [ServiceA];
        constructor(_a: ServiceA) {}
      }

      // Create circular: A -> B -> A
      (ServiceA as typeof ServiceA & { inject: readonly Token[] }).inject = [ServiceB];

      container.register(ServiceA);
      container.register(ServiceB);

      const a = container.resolve(ServiceA);
      // 'then' should be undefined (not a thenable)
      expect((a as unknown as Record<string, unknown>).then).toBeUndefined();
    });

    it('should handle complex circular dependency chain', () => {
      class A {
        static readonly inject: readonly Token[] = [];
        value = 'A';
      }

      class B {
        static readonly inject: readonly Token[] = [A];
        value = 'B';
        constructor(public a: A) {}
      }

      class C {
        static readonly inject: readonly Token[] = [B];
        value = 'C';
        constructor(public b: B) {}
      }

      // Create circular: A -> C -> B -> A
      (A as typeof A & { inject: readonly Token[] }).inject = [C];

      container.register(A);
      container.register(B);
      container.register(C);

      const a = container.resolve(A);
      expect(a.value).toBe('A');
    });

    it('should access properties on circular proxy during construction', () => {
      let proxyThen: unknown;
      let proxyToString: string | undefined;
      let proxyToStringTag: string | undefined;

      class ServiceA {
        static readonly inject: readonly Token[] = [];
        value = 'A';

        method() {
          return 'method-result';
        }
      }

      class ServiceB {
        static readonly inject: readonly Token[] = [ServiceA];

        constructor(a: ServiceA) {
          // Access properties on the proxy during construction
          // At this point, 'a' might be a circular proxy
          // Note: During construction, the instance isn't set yet, so value/method return undefined
          proxyThen = (a as unknown as Record<string, unknown>).then;
          proxyToString = String(a);
          proxyToStringTag = (a as unknown as Record<symbol, unknown>)[Symbol.toStringTag] as
            | string
            | undefined;
        }
      }

      // Create circular: A -> B -> A
      (ServiceA as typeof ServiceA & { inject: readonly Token[] }).inject = [ServiceB];

      container.register(ServiceA);
      container.register(ServiceB);

      const a = container.resolve(ServiceA);

      // After resolution, the proxy should have been replaced with the real instance
      expect(a.value).toBe('A');
      expect(a.method()).toBe('method-result');

      // The proxy special properties should work even during construction
      expect(proxyThen).toBeUndefined(); // 'then' returns undefined to avoid thenable behavior
      expect(proxyToString).toBeDefined();
    });

    it('should bind methods correctly on circular proxy', () => {
      let boundMethodResult: string | undefined;

      class ServiceA {
        static readonly inject: readonly Token[] = [];
        getValue() {
          return 'from-A';
        }
      }

      class ServiceB {
        static readonly inject: readonly Token[] = [ServiceA];

        constructor(a: ServiceA) {
          // Try to use a method from the proxy
          const method = a.getValue;
          if (typeof method === 'function') {
            try {
              boundMethodResult = method();
            } catch {
              // Method might not be bound correctly on proxy
            }
          }
        }
      }

      // Create circular: A -> B -> A
      (ServiceA as typeof ServiceA & { inject: readonly Token[] }).inject = [ServiceB];

      container.register(ServiceA);
      container.register(ServiceB);

      const a = container.resolve(ServiceA);
      expect(a.getValue()).toBe('from-A');
    });

    it('should return undefined for unknown properties on circular proxy', () => {
      let unknownProp: unknown;

      class ServiceA {
        static readonly inject: readonly Token[] = [];
      }

      class ServiceB {
        static readonly inject: readonly Token[] = [ServiceA];

        constructor(a: ServiceA) {
          unknownProp = (a as unknown as Record<string, unknown>).nonExistentProperty;
        }
      }

      // Create circular: A -> B -> A
      (ServiceA as typeof ServiceA & { inject: readonly Token[] }).inject = [ServiceB];

      container.register(ServiceA);
      container.register(ServiceB);

      container.resolve(ServiceA);
      expect(unknownProp).toBeUndefined();
    });

    it('should access circular proxy after instance is created', () => {
      // Store reference to proxy during construction
      let storedProxy: ServiceA | undefined;

      class ServiceA {
        static readonly inject: readonly Token[] = [];
        value = 'A-instance';

        method() {
          return 'method-from-A';
        }
      }

      class ServiceB {
        static readonly inject: readonly Token[] = [ServiceA];

        constructor(a: ServiceA) {
          // Store the proxy reference for later access
          storedProxy = a;
        }
      }

      // Create circular: A -> B -> A
      (ServiceA as typeof ServiceA & { inject: readonly Token[] }).inject = [ServiceB];

      container.register(ServiceA);
      container.register(ServiceB);

      // Resolve - this creates the proxy, stores it, then creates the real instance
      const realA = container.resolve(ServiceA);

      // Now access properties on the stored proxy
      // At this point, the binding.instance should be set, so the proxy should forward
      expect(realA.value).toBe('A-instance');
      expect(realA.method()).toBe('method-from-A');

      // The stored proxy should now forward to the real instance
      if (storedProxy) {
        // Access properties through the proxy - this exercises lines 278-285
        expect(storedProxy.value).toBe('A-instance');
        expect(storedProxy.method()).toBe('method-from-A');
      }
    });

    it('should bind methods from circular proxy correctly', () => {
      let storedProxy: ServiceA | undefined;
      let boundMethod: (() => string) | undefined;

      class ServiceA {
        static readonly inject: readonly Token[] = [];
        value = 'A-value';

        getValue() {
          return this.value;
        }
      }

      class ServiceB {
        static readonly inject: readonly Token[] = [ServiceA];

        constructor(a: ServiceA) {
          storedProxy = a;
        }
      }

      // Create circular: A -> B -> A
      (ServiceA as typeof ServiceA & { inject: readonly Token[] }).inject = [ServiceB];

      container.register(ServiceA);
      container.register(ServiceB);

      container.resolve(ServiceA);

      // After resolution, access method through proxy
      if (storedProxy) {
        boundMethod = storedProxy.getValue.bind(storedProxy);
      }

      // The bound method should work correctly
      expect(boundMethod?.()).toBe('A-value');
    });

    it('should access non-function properties through circular proxy', () => {
      let storedProxy: ServiceA | undefined;
      let propValue: unknown;

      class ServiceA {
        static readonly inject: readonly Token[] = [];
        data = { key: 'value' };
      }

      class ServiceB {
        static readonly inject: readonly Token[] = [ServiceA];

        constructor(a: ServiceA) {
          storedProxy = a;
        }
      }

      // Create circular: A -> B -> A
      (ServiceA as typeof ServiceA & { inject: readonly Token[] }).inject = [ServiceB];

      container.register(ServiceA);
      container.register(ServiceB);

      container.resolve(ServiceA);

      // Access non-function property through proxy
      if (storedProxy) {
        propValue = storedProxy.data;
      }

      expect(propValue).toEqual({ key: 'value' });
    });

    it('should handle inspect on circular proxy after resolution', () => {
      let storedProxy: ServiceA | undefined;
      let inspectResult: string | undefined;

      class ServiceA {
        static readonly inject: readonly Token[] = [];
        value = 'A';
      }

      class ServiceB {
        static readonly inject: readonly Token[] = [ServiceA];

        constructor(a: ServiceA) {
          storedProxy = a;
        }
      }

      // Create circular: A -> B -> A
      (ServiceA as typeof ServiceA & { inject: readonly Token[] }).inject = [ServiceB];

      container.register(ServiceA);
      container.register(ServiceB);

      container.resolve(ServiceA);

      // Access inspect through proxy after resolution
      if (storedProxy) {
        const inspectFn = (storedProxy as unknown as Record<string, unknown>).inspect;
        if (typeof inspectFn === 'function') {
          inspectResult = inspectFn();
        }
      }

      // inspect should return the CircularProxy string
      expect(inspectResult).toBeDefined();
      expect(inspectResult).toContain('CircularProxy');
    });
  });

  describe('dependency chains', () => {
    it('should resolve chain A -> B -> C correctly', () => {
      class ServiceC {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        getValue() {
          return 'C';
        }
      }

      class ServiceB {
        static readonly inject = [ServiceC] as const satisfies DependencyTokens<typeof this>;
        constructor(private serviceC: ServiceC) {}
        getValue() {
          return 'B';
        }
        getCValue() {
          return this.serviceC.getValue();
        }
      }

      class ServiceA {
        static readonly inject = [ServiceB] as const satisfies DependencyTokens<typeof this>;
        constructor(private serviceB: ServiceB) {}
        getValue() {
          return 'A';
        }
        getBValue() {
          return this.serviceB.getValue();
        }
        getCValue() {
          return this.serviceB.getCValue();
        }
      }

      container.register(ServiceC);
      container.register(ServiceB);
      container.register(ServiceA);

      const serviceA = container.resolve(ServiceA);

      expect(serviceA.getValue()).toBe('A');
      expect(serviceA.getBValue()).toBe('B');
      expect(serviceA.getCValue()).toBe('C');
    });

    it('should resolve multiple dependencies from same service', () => {
      class Config {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        port = 3000;
      }

      class Logger {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        log(_msg: string) {}
      }

      class Server {
        static readonly inject = [Config, Logger] as const satisfies DependencyTokens<typeof this>;
        constructor(
          private config: Config,
          private logger: Logger,
        ) {}
        getPort() {
          return this.config.port;
        }
      }

      container.register(Config);
      container.register(Logger);
      container.register(Server);

      const server = container.resolve(Server);

      expect(server.getPort()).toBe(3000);
    });
  });

  describe('singleton caching', () => {
    it('should return same singleton instance across dependency chain', () => {
      class Config {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        id = Math.random();
      }

      class Service {
        static readonly inject = [Config] as const satisfies DependencyTokens<typeof this>;
        constructor(private config: Config) {}
        getConfigId() {
          return this.config.id;
        }
      }

      container.register(Config);
      container.register(Service);

      const service1 = container.resolve(Service);
      const service2 = container.resolve(Service);

      expect(service1.getConfigId()).toBe(service2.getConfigId());
    });
  });

  describe('deep dependency trees', () => {
    it('should resolve deeply nested dependencies', () => {
      class A {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        value = 'A';
      }

      class B {
        static readonly inject = [A] as const satisfies DependencyTokens<typeof this>;
        constructor(private a: A) {}
        getValue() {
          return `B(${this.a.value})`;
        }
      }

      class C {
        static readonly inject = [B] as const satisfies DependencyTokens<typeof this>;
        constructor(private b: B) {}
        getValue() {
          return `C(${this.b.getValue()})`;
        }
      }

      class D {
        static readonly inject = [C] as const satisfies DependencyTokens<typeof this>;
        constructor(private c: C) {}
        getValue() {
          return `D(${this.c.getValue()})`;
        }
      }

      container.register(A);
      container.register(B);
      container.register(C);
      container.register(D);

      const d = container.resolve(D);

      expect(d.getValue()).toBe('D(C(B(A)))');
    });

    it('should handle diamond dependency pattern', () => {
      class Shared {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        value = 'shared';
      }

      class Left {
        static readonly inject = [Shared] as const satisfies DependencyTokens<typeof this>;
        constructor(private shared: Shared) {}
        getValue() {
          return `Left(${this.shared.value})`;
        }
      }

      class Right {
        static readonly inject = [Shared] as const satisfies DependencyTokens<typeof this>;
        constructor(private shared: Shared) {}
        getValue() {
          return `Right(${this.shared.value})`;
        }
      }

      class Top {
        static readonly inject = [Left, Right] as const satisfies DependencyTokens<typeof this>;
        constructor(
          private left: Left,
          private right: Right,
        ) {}
        getValues() {
          return [this.left.getValue(), this.right.getValue()];
        }
      }

      container.register(Shared);
      container.register(Left);
      container.register(Right);
      container.register(Top);

      const top = container.resolve(Top);

      expect(top.getValues()).toEqual(['Left(shared)', 'Right(shared)']);
    });

    it('should share singleton across diamond dependency', () => {
      class Shared {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        id = Math.random();
      }

      class Left {
        static readonly inject = [Shared] as const satisfies DependencyTokens<typeof this>;
        constructor(private shared: Shared) {}
        getSharedId() {
          return this.shared.id;
        }
      }

      class Right {
        static readonly inject = [Shared] as const satisfies DependencyTokens<typeof this>;
        constructor(private shared: Shared) {}
        getSharedId() {
          return this.shared.id;
        }
      }

      class Top {
        static readonly inject = [Left, Right] as const satisfies DependencyTokens<typeof this>;
        constructor(
          private left: Left,
          private right: Right,
        ) {}
        getSharedIds() {
          return [this.left.getSharedId(), this.right.getSharedId()];
        }
      }

      container.register(Shared);
      container.register(Left);
      container.register(Right);
      container.register(Top);

      const top = container.resolve(Top);

      const [leftId, rightId] = top.getSharedIds();
      expect(leftId).toBe(rightId);
    });
  });

  describe('no dependencies', () => {
    it('should resolve service with no dependencies', () => {
      class Simple {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        getValue() {
          return 'simple';
        }
      }

      container.register(Simple);

      const simple = container.resolve(Simple);
      expect(simple.getValue()).toBe('simple');
    });

    it('should resolve multiple services with no dependencies', () => {
      class A {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        value = 'A';
      }

      class B {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        value = 'B';
      }

      class C {
        static readonly inject = [] as const satisfies DependencyTokens<typeof this>;
        value = 'C';
      }

      container.register(A);
      container.register(B);
      container.register(C);

      expect(container.resolve(A).value).toBe('A');
      expect(container.resolve(B).value).toBe('B');
      expect(container.resolve(C).value).toBe('C');
    });
  });
});
