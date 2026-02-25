import { beforeEach, describe, expect, it } from 'vitest';
import { Container } from './container.ts';
import type { DepsTokens } from '../types/deps.ts';

describe('Circular Dependencies', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('dependency chains', () => {
    it('should resolve chain A -> B -> C correctly', () => {
      class ServiceC {
        static readonly inject = [] as const satisfies DepsTokens<ServiceC>;
        getValue() {
          return 'C';
        }
      }

      class ServiceB {
        static readonly inject = [ServiceC] as const satisfies DepsTokens<ServiceB>;
        constructor(private serviceC: ServiceC) {}
        getValue() {
          return 'B';
        }
        getCValue() {
          return this.serviceC.getValue();
        }
      }

      class ServiceA {
        static readonly inject = [ServiceB] as const satisfies DepsTokens<ServiceA>;
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
        static readonly inject = [] as const satisfies DepsTokens<Config>;
        port = 3000;
      }

      class Logger {
        static readonly inject = [] as const satisfies DepsTokens<Logger>;
        log(_msg: string) {}
      }

      class Server {
        static readonly inject = [Config, Logger] as const satisfies DepsTokens<Server>;
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
        static readonly inject = [] as const satisfies DepsTokens<Config>;
        id = Math.random();
      }

      class Service {
        static readonly inject = [Config] as const satisfies DepsTokens<Service>;
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
        static readonly inject = [] as const satisfies DepsTokens<A>;
        value = 'A';
      }

      class B {
        static readonly inject = [A] as const satisfies DepsTokens<B>;
        constructor(private a: A) {}
        getValue() {
          return `B(${this.a.value})`;
        }
      }

      class C {
        static readonly inject = [B] as const satisfies DepsTokens<C>;
        constructor(private b: B) {}
        getValue() {
          return `C(${this.b.getValue()})`;
        }
      }

      class D {
        static readonly inject = [C] as const satisfies DepsTokens<D>;
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
        static readonly inject = [] as const satisfies DepsTokens<Shared>;
        value = 'shared';
      }

      class Left {
        static readonly inject = [Shared] as const satisfies DepsTokens<Left>;
        constructor(private shared: Shared) {}
        getValue() {
          return `Left(${this.shared.value})`;
        }
      }

      class Right {
        static readonly inject = [Shared] as const satisfies DepsTokens<Right>;
        constructor(private shared: Shared) {}
        getValue() {
          return `Right(${this.shared.value})`;
        }
      }

      class Top {
        static readonly inject = [Left, Right] as const satisfies DepsTokens<Top>;
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
        static readonly inject = [] as const satisfies DepsTokens<Shared>;
        id = Math.random();
      }

      class Left {
        static readonly inject = [Shared] as const satisfies DepsTokens<Left>;
        constructor(private shared: Shared) {}
        getSharedId() {
          return this.shared.id;
        }
      }

      class Right {
        static readonly inject = [Shared] as const satisfies DepsTokens<Right>;
        constructor(private shared: Shared) {}
        getSharedId() {
          return this.shared.id;
        }
      }

      class Top {
        static readonly inject = [Left, Right] as const satisfies DepsTokens<Top>;
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
        static readonly inject = [] as const satisfies DepsTokens<Simple>;
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
        static readonly inject = [] as const satisfies DepsTokens<A>;
        value = 'A';
      }

      class B {
        static readonly inject = [] as const satisfies DepsTokens<B>;
        value = 'B';
      }

      class C {
        static readonly inject = [] as const satisfies DepsTokens<C>;
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
