import { describe, expect, it } from 'vite-plus/test';
import { Container } from './container.ts';
import { DIError, DI_ERROR_CODE } from './di-error.ts';
import { Injectable } from './injectable.ts';
import { Module } from './module.ts';
import { SCOPE } from './scope.ts';
import './test-utils.ts';
import type { InjectableClass } from './types.ts';

// ---------------------------------------------------------------------------
// 1. Resolve singleton — same instance twice
// ---------------------------------------------------------------------------
describe('Container — singleton resolution', () => {
  it('returns same instance when resolving a singleton twice', async () => {
    class SingletonService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public readonly id = Math.random();
    }

    class AppModule extends Module({
      providers: [SingletonService],
    }) {}

    const container = new Container(AppModule);
    await container.start();
    const a = container.resolve(SingletonService);
    const b = container.resolve(SingletonService);

    expect(a).toBe(b);
    expect(a).toBeInstanceOf(SingletonService);
  });
});

// ---------------------------------------------------------------------------
// 2. Resolve transient — different instances
// ---------------------------------------------------------------------------
describe('Container — transient resolution', () => {
  it('returns different instance each time for transient', async () => {
    class TransientService extends Injectable({ scope: SCOPE.TRANSIENT }) {
      public readonly id = Math.random();
    }

    class AppModule extends Module({
      providers: [TransientService],
    }) {}

    const container = new Container(AppModule);
    await container.start();
    const a = container.resolve(TransientService);
    const b = container.resolve(TransientService);

    expect(a).not.toBe(b);
    expect(a).toBeInstanceOf(TransientService);
    expect(b).toBeInstanceOf(TransientService);
  });
});

// ---------------------------------------------------------------------------
// 3. Resolve with dependency chain
// ---------------------------------------------------------------------------
describe('Container — dependency chain', () => {
  it('resolves A → B → C dependency chain', async () => {
    class ServiceC extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class ServiceB extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceC', ServiceC]],
    }) {
      public get c() {
        return this.inject.serviceC;
      }
    }
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', ServiceB]],
    }) {
      public get b() {
        return this.inject.serviceB;
      }
    }

    class AppModule extends Module({
      providers: [ServiceA, ServiceB, ServiceC],
    }) {}

    const container = new Container(AppModule);
    await container.start();
    const a = container.resolve(ServiceA);

    expect(a).toBeInstanceOf(ServiceA);
    expect(a.inject.serviceB).toBeInstanceOf(ServiceB);
    expect(a.inject.serviceB.inject.serviceC).toBeInstanceOf(ServiceC);
    // Singleton: same instances
    expect(a.inject.serviceB).toBe(container.resolve(ServiceB));
    expect(a.inject.serviceB.inject.serviceC).toBe(container.resolve(ServiceC));
  });
});

// ---------------------------------------------------------------------------
// 4. Start calls onApplicationBootstrap in dep order
// ---------------------------------------------------------------------------
describe('Container — start lifecycle', () => {
  it('calls onApplicationBootstrap in dependency order (deps first)', async () => {
    const order: string[] = [];

    class ServiceB extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {
        order.push('B');
      }
    }
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', ServiceB]],
    }) {
      public onApplicationBootstrap() {
        order.push('A');
      }
    }

    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    expect(order).toEqual(['B', 'A']);
  });

  it('calls onApplicationBootstrap with the container instance', async () => {
    let receivedContainer: Container | undefined;

    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap(container: Container) {
        receivedContainer = container;
      }
    }

    class AppModule extends Module({
      providers: [MyService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    expect(receivedContainer).toBe(container);
  });

  it('calls onStop with the container instance', async () => {
    let receivedContainer: Container | undefined;

    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onStop(container: Container) {
        receivedContainer = container;
      }
    }

    class AppModule extends Module({
      providers: [MyService],
    }) {}

    const container = new Container(AppModule);
    await container.start();
    await container.stop();

    expect(receivedContainer).toBe(container);
  });

  it('handles async onApplicationBootstrap', async () => {
    const order: string[] = [];

    class ServiceB extends Injectable({ scope: SCOPE.SINGLETON }) {
      public async onApplicationBootstrap() {
        await Promise.resolve();
        order.push('B');
      }
    }
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', ServiceB]],
    }) {
      public async onApplicationBootstrap() {
        await Promise.resolve();
        order.push('A');
      }
    }

    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    expect(order).toEqual(['B', 'A']);
  });
});

// ---------------------------------------------------------------------------
// 5. Stop calls onStop in reverse dep order
// ---------------------------------------------------------------------------
describe('Container — stop lifecycle', () => {
  it('calls onStop in reverse dependency order', async () => {
    const order: string[] = [];

    class ServiceB extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onStop() {
        order.push('B');
      }
    }
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', ServiceB]],
    }) {
      public onStop() {
        order.push('A');
      }
    }

    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
    }) {}

    const container = new Container(AppModule);
    await container.start();
    await container.stop();

    expect(order).toEqual(['A', 'B']);
  });

  it('handles async onStop', async () => {
    const order: string[] = [];

    class ServiceB extends Injectable({ scope: SCOPE.SINGLETON }) {
      public async onStop() {
        await Promise.resolve();
        order.push('B');
      }
    }
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', ServiceB]],
    }) {
      public async onStop() {
        await Promise.resolve();
        order.push('A');
      }
    }

    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
    }) {}

    const container = new Container(AppModule);
    await container.start();
    await container.stop();

    expect(order).toEqual(['A', 'B']);
  });
});

// ---------------------------------------------------------------------------
// 6. onApplicationBootstrap failure: aborts and cleans up
// ---------------------------------------------------------------------------
describe('Container — onApplicationBootstrap failure', () => {
  it('aborts and calls onStop on already-started services', async () => {
    const stopped: string[] = [];

    class ServiceB extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {
        /* ok */
      }
      public onStop() {
        stopped.push('B');
      }
    }
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', ServiceB]],
    }) {
      public onApplicationBootstrap() {
        throw new Error('start failed');
      }
      public onStop() {
        stopped.push('A');
      }
    }

    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
    }) {}

    const container = new Container(AppModule);

    await expect(container.start()).rejects.toThrow('start failed');
    // B started first (dep order), then A failed → both A and B rolled back
    expect(stopped).toEqual(['A', 'B']);
  });

  it('rolls back already-started providers when a later provider constructor throws', async () => {
    const stopped: string[] = [];

    class ServiceA extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {
        /* ok */
      }
      public onStop() {
        stopped.push('A');
      }
    }
    class ServiceB extends Injectable({ scope: SCOPE.SINGLETON }) {
      public constructor() {
        super();
        throw new Error('constructor failed');
      }
    }

    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
    }) {}

    const container = new Container(AppModule);
    await expect(container.start()).rejects.toThrow('constructor failed');
    expect(stopped).toEqual(['A']);
  });

  it('CF4: rolls back already-started request providers when a later constructor throws', async () => {
    const stopped: string[] = [];

    class ReqA extends Injectable({ scope: SCOPE.REQUEST }) {
      public onApplicationBootstrap() {
        /* ok */
      }
      public onStop() {
        stopped.push('A');
      }
    }
    class ReqB extends Injectable({ scope: SCOPE.REQUEST }) {
      public constructor() {
        super();
        throw new Error('constructor failed');
      }
    }

    class AppModule extends Module({
      providers: [ReqA, ReqB] as const,
    }) {}

    const container = new Container(AppModule);
    await container.start();

    await expect(container.withRequestScope(() => {})).rejects.toThrow('constructor failed');
    expect(stopped).toEqual(['A']);

    await container.stop();
  });
});

// ---------------------------------------------------------------------------
// 7. onStop failure: continues, collects errors
// ---------------------------------------------------------------------------
describe('Container — onStop failure', () => {
  it('continues stopping and throws aggregate error', async () => {
    class ServiceB extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onStop() {
        throw new Error('stop B failed');
      }
    }
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', ServiceB]],
    }) {
      public onStop() {
        throw new Error('stop A failed');
      }
    }

    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    // Both A and B throw during stop; both should be attempted
    const err = await container.stop().catch((e: any) => e);
    expect(err).toBeInstanceOf(AggregateError);
    expect(err.message).toMatch(/^Stop failed:/);
    expect(err.errors).toHaveLength(2);
    expect(err.errors.map((e: Error) => e.message)).toEqual(['stop A failed', 'stop B failed']);
  });
});

// ---------------------------------------------------------------------------
// 8. Resolve with imported module exports
// ---------------------------------------------------------------------------
describe('Container — imported module exports', () => {
  it('resolves services from imported modules', async () => {
    class ConfigService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public readonly value = 'config';
    }
    class DbService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['configService', ConfigService]],
    }) {
      public get config() {
        return this.inject.configService;
      }
    }

    class CoreModule extends Module({
      providers: [ConfigService],
      exports: [ConfigService],
    }) {}

    class AppModule extends Module({
      providers: [DbService],
      imports: [CoreModule],
    }) {}

    const container = new Container(AppModule);
    await container.start();
    const db = container.resolve(DbService);

    expect(db).toBeInstanceOf(DbService);
    expect(db.inject.configService).toBeInstanceOf(ConfigService);
    expect(db.inject.configService.value).toBe('config');
  });
});

// ---------------------------------------------------------------------------
// 9. Private (non-exported) provider not accessible from parent
// ---------------------------------------------------------------------------
describe('Container — private providers', () => {
  it('private provider from imported module is not resolvable', async () => {
    class PublicService extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class PrivateService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class SharedModule extends Module({
      providers: [PublicService, PrivateService],
      exports: [PublicService],
    }) {}

    class AppModule extends Module({
      providers: [],
      imports: [SharedModule],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const pub = container.resolve(PublicService);
    expect(pub).toBeInstanceOf(PublicService);

    expect(() => container.resolve(PrivateService)).toThrowDIError(
      DI_ERROR_CODE.MISSING_PROVIDER,
      /No provider registered/,
    );
  });
});

// ---------------------------------------------------------------------------
// 10. Multiple containers from same module are isolated
// ---------------------------------------------------------------------------
describe('Container — isolation', () => {
  it('two containers from same module have separate singleton instances', async () => {
    class SingletonService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public readonly id = Math.random();
    }

    class AppModule extends Module({
      providers: [SingletonService],
    }) {}

    const container1 = new Container(AppModule);
    const container2 = new Container(AppModule);

    await container1.start();
    await container2.start();

    const instance1 = container1.resolve(SingletonService);
    const instance2 = container2.resolve(SingletonService);

    expect(instance1).not.toBe(instance2);
  });
});

// ---------------------------------------------------------------------------
// 11. Request scope: same instance within one withRequestScope call
// ---------------------------------------------------------------------------
describe('Container — request scope (same request)', () => {
  it('returns same instance within one withRequestScope call', async () => {
    class RequestService extends Injectable({ scope: SCOPE.REQUEST }) {
      public readonly id = Math.random();
    }

    class AppModule extends Module({
      providers: [RequestService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    await container.withRequestScope(() => {
      const a = container.resolve(RequestService);
      const b = container.resolve(RequestService);
      expect(a).toBe(b);
    });
  });
});

// ---------------------------------------------------------------------------
// 12. Request scope: different instances across separate withRequestScope calls
// ---------------------------------------------------------------------------
describe('Container — request scope (different requests)', () => {
  it('returns different instances across separate withRequestScope calls', async () => {
    class RequestService extends Injectable({ scope: SCOPE.REQUEST }) {
      public readonly id = Math.random();
    }

    class AppModule extends Module({
      providers: [RequestService],
    }) {}

    const container = new Container(AppModule);
    await container.start();
    let firstInstance: RequestService | undefined;
    let secondInstance: RequestService | undefined;

    await container.withRequestScope(() => {
      firstInstance = container.resolve(RequestService);
    });

    await container.withRequestScope(() => {
      secondInstance = container.resolve(RequestService);
    });

    expect(firstInstance).not.toBe(secondInstance);
  });
});

// ---------------------------------------------------------------------------
// 12b. Request scope: concurrent withRequestScope calls have isolated stores
// ---------------------------------------------------------------------------
describe('Container — request scope (concurrent)', () => {
  it('concurrent withRequestScope calls have isolated request instances', async () => {
    class RequestService extends Injectable({ scope: SCOPE.REQUEST }) {
      public readonly id = Math.random();
    }

    class AppModule extends Module({
      providers: [RequestService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const ids = await Promise.all([
      container.withRequestScope(() => container.resolve(RequestService).id),
      container.withRequestScope(() => container.resolve(RequestService).id),
      container.withRequestScope(() => container.resolve(RequestService).id),
    ]);

    // All three should have distinct IDs (isolated stores)
    expect(new Set(ids).size).toBe(3);

    await container.stop();
  });
});

// ---------------------------------------------------------------------------
// 13. Request scope outside context: throws NOT_IN_REQUEST_SCOPE
// ---------------------------------------------------------------------------
describe('Container — request scope outside context', () => {
  it('throws NOT_IN_REQUEST_SCOPE when resolving request-scoped outside withRequestScope', async () => {
    class RequestService extends Injectable({ scope: SCOPE.REQUEST }) {}

    class AppModule extends Module({
      providers: [RequestService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    expect(() => container.resolve(RequestService)).toThrowDIError(
      DI_ERROR_CODE.NOT_IN_REQUEST_SCOPE,
      /outside of a request scope/,
    );
  });
});

// ---------------------------------------------------------------------------
// 14. Scope violation: Singleton dep on Request — validated at graph build
// ---------------------------------------------------------------------------
describe('Container — scope violation at construction', () => {
  it('throws SCOPE_VIOLATION when Singleton depends on Request (at construction)', () => {
    class RequestService extends Injectable({ scope: SCOPE.REQUEST }) {}
    class SingletonService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['requestService', RequestService]],
    }) {}

    class AppModule extends Module({
      providers: [SingletonService, RequestService],
    }) {}

    expect(() => new Container(AppModule)).toThrowDIError(
      DI_ERROR_CODE.SCOPE_VIOLATION,
      /Scope violation/,
    );
  });
});

// ---------------------------------------------------------------------------
// 15. Mixed: Singleton resolves normally, Request resolves from ALS
// ---------------------------------------------------------------------------
describe('Container — mixed scopes', () => {
  it('singleton and request-scoped coexist in same container', async () => {
    class SingletonService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public readonly id = Math.random();
    }
    class RequestService extends Injectable({ scope: SCOPE.REQUEST }) {
      public readonly id = Math.random();
    }

    class AppModule extends Module({
      providers: [SingletonService, RequestService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    // Singleton works after start()
    const singleton = container.resolve(SingletonService);
    expect(singleton).toBeInstanceOf(SingletonService);

    // Same singleton always
    expect(container.resolve(SingletonService)).toBe(singleton);

    // Request-scoped works inside withRequestScope
    await container.withRequestScope(() => {
      const req = container.resolve(RequestService);
      expect(req).toBeInstanceOf(RequestService);
      // Same request instance within same scope
      expect(container.resolve(RequestService)).toBe(req);
      // Singleton still same
      expect(container.resolve(SingletonService)).toBe(singleton);
    });
  });

  it('start() skips request-scoped providers without error', async () => {
    let started = false;
    class SingletonService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {
        started = true;
      }
    }
    class RequestService extends Injectable({ scope: SCOPE.REQUEST }) {}

    class AppModule extends Module({
      providers: [SingletonService, RequestService],
    }) {}

    const container = new Container(AppModule);
    await expect(container.start()).resolves.toBeUndefined();

    expect(started).toBe(true);

    await container.stop();
  });
});

// ---------------------------------------------------------------------------
// 16. Nested withRequestScope: inner scope isolated from outer
// ---------------------------------------------------------------------------
describe('Container — nested request scopes', () => {
  it('inner withRequestScope has isolated request instances', async () => {
    class RequestService extends Injectable({ scope: SCOPE.REQUEST }) {
      public readonly id = Math.random();
    }

    class AppModule extends Module({
      providers: [RequestService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    await container.withRequestScope(async () => {
      const outer = container.resolve(RequestService);

      await container.withRequestScope(() => {
        const inner = container.resolve(RequestService);
        expect(inner).not.toBe(outer);
        // Same within inner scope
        expect(container.resolve(RequestService)).toBe(inner);
      });

      // Outer still same after returning from inner
      expect(container.resolve(RequestService)).toBe(outer);
    });
  });
});

// ---------------------------------------------------------------------------
// 17. Resolve after stop: throws CONTAINER_STOPPED
// ---------------------------------------------------------------------------
describe('Container — resolve after stop', () => {
  it('throws CONTAINER_STOPPED when resolving after stop', async () => {
    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class AppModule extends Module({
      providers: [MyService],
    }) {}

    const container = new Container(AppModule);
    await container.start();
    await container.stop();

    expect(() => container.resolve(MyService)).toThrowDIError(
      DI_ERROR_CODE.CONTAINER_STOPPED,
      /stopped/,
    );
  });
});

// ---------------------------------------------------------------------------
// 18. Singleton depending on Transient: allowed (pinned instance)
// ---------------------------------------------------------------------------
describe('Container — singleton depending on transient', () => {
  it('singleton gets one pinned transient instance', async () => {
    class TransientService extends Injectable({ scope: SCOPE.TRANSIENT }) {
      public readonly id = Math.random();
    }
    class SingletonService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['transientService', TransientService]],
    }) {
      public get transient() {
        return this.inject.transientService;
      }
    }

    class AppModule extends Module({
      providers: [SingletonService, TransientService],
    }) {}

    const container = new Container(AppModule);
    await container.start();
    const singleton = container.resolve(SingletonService);

    // Singleton always same instance
    expect(container.resolve(SingletonService)).toBe(singleton);
    // The transient dependency is pinned — always the same
    expect(singleton.transient).toBe(singleton.transient);
    // But resolving TransientService directly gives a NEW instance
    const directTransient = container.resolve(TransientService);
    expect(directTransient).not.toBe(singleton.transient);
  });
});

// ---------------------------------------------------------------------------
// 19. Start without lifecycle hooks: no error
// ---------------------------------------------------------------------------
describe('Container — no lifecycle hooks', () => {
  it('start/stop succeeds when services have no hooks', async () => {
    class ServiceA extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class AppModule extends Module({
      providers: [ServiceA],
    }) {}

    const container = new Container(AppModule);
    await container.start();
    const instance = container.resolve(ServiceA);
    expect(instance).toBeInstanceOf(ServiceA);
    await container.stop();
  });
});

// ---------------------------------------------------------------------------
// 20. Transient with dependencies gets fresh deps
// ---------------------------------------------------------------------------
describe('Container — transient with deps', () => {
  it('each transient resolution gets its own singleton dep reference', async () => {
    class SingletonDep extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class TransientService extends Injectable({
      scope: SCOPE.TRANSIENT,
      inject: [['singletonDep', SingletonDep]],
    }) {
      public get dep() {
        return this.inject.singletonDep;
      }
    }

    class AppModule extends Module({
      providers: [SingletonDep, TransientService],
    }) {}

    const container = new Container(AppModule);
    await container.start();
    const a = container.resolve(TransientService);
    const b = container.resolve(TransientService);

    // Different transient instances
    expect(a).not.toBe(b);
    // But same singleton dep
    expect(a.dep).toBe(b.dep);
  });
});

// ---------------------------------------------------------------------------
// 21. Unknown scope: hits default branch
// ---------------------------------------------------------------------------
describe('Container — unknown scope', () => {
  it('throws DIError for unknown scope value', () => {
    class BadScopeService extends Injectable({ scope: SCOPE.SINGLETON }) {}
    // Override scope to invalid value after class creation
    (BadScopeService as any)._scope = 'invalid';

    class AppModule extends Module({
      providers: [BadScopeService],
    }) {}

    expect(() => new Container(AppModule)).toThrowDIError(DI_ERROR_CODE.UNKNOWN_SCOPE);
  });
});

// ---------------------------------------------------------------------------
// 22. onApplicationBootstrap failure with no-stop service: cleanup skips non-hook services
// ---------------------------------------------------------------------------
describe('Container — onApplicationBootstrap failure with no onStop hook', () => {
  it('skips cleanup for services without onStop during failed start', async () => {
    const stopped: string[] = [];

    class ServiceC extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {
        /* ok */
      }
    }
    class ServiceB extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {
        /* ok */
      }
      public onStop() {
        stopped.push('B');
      }
    }
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [
        ['serviceB', ServiceB],
        ['serviceC', ServiceC],
      ],
    }) {
      public onApplicationBootstrap() {
        throw new Error('start failed');
      }
      public onStop() {
        stopped.push('A');
      }
    }

    class AppModule extends Module({
      providers: [ServiceA, ServiceB, ServiceC],
    }) {}

    const container = new Container(AppModule);
    await expect(container.start()).rejects.toThrow('start failed');
    // A has onApplicationBootstrap that threw, A also has onStop → cleaned up. B has onStop → cleaned up. C has no onStop → skipped.
    expect(stopped).toEqual(['A', 'B']);
  });
});

// ---------------------------------------------------------------------------
// 23. Stop with transient provider: skips unresolved singletons
// ---------------------------------------------------------------------------
describe('Container — stop with transient providers', () => {
  it('transient providers are not stopped (not in singletons map)', async () => {
    class SingletonService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onStop() {}
    }
    class TransientService extends Injectable({ scope: SCOPE.TRANSIENT }) {}

    class AppModule extends Module({
      providers: [SingletonService, TransientService],
    }) {}

    const container = new Container(AppModule);
    await container.start();
    // stop iterates sorted, but transient is not in singletons → skipped
    await container.stop();
  });
});

// ---------------------------------------------------------------------------
// 24. onStop throws non-Error: wrapped in Error
// ---------------------------------------------------------------------------
describe('Container — onStop throws Error', () => {
  it('wraps Error thrown from onStop', async () => {
    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onStop() {
        throw new Error('string error');
      }
    }

    class AppModule extends Module({
      providers: [MyService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const err = await container.stop().catch((e: any) => e);
    expect(err).toBeInstanceOf(AggregateError);
    expect(err.errors[0]).toBeInstanceOf(Error);
    expect(err.errors[0].message).toBe('string error');
  });
});

// ---------------------------------------------------------------------------
// 25. State machine guards
// ---------------------------------------------------------------------------
describe('Container — state machine guards', () => {
  it('throws when start() called twice', async () => {
    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class AppModule extends Module({
      providers: [MyService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const err = await container.start().catch((e: any) => e);
    expect(err).toBeInstanceOf(DIError);
    expect(err.code).toBe(DI_ERROR_CODE.ALREADY_STARTED);

    await container.stop();
  });

  it('stop() is a no-op when called twice', async () => {
    let stopCount = 0;
    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onStop() {
        stopCount++;
      }
    }

    class AppModule extends Module({
      providers: [MyService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    await container.stop();
    await container.stop();

    expect(stopCount).toBe(1);
  });

  it('throws when start() called after stop()', async () => {
    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class AppModule extends Module({
      providers: [MyService],
    }) {}

    const container = new Container(AppModule);
    await container.start();
    await container.stop();

    const err = await container.start().catch((e: any) => e);
    expect(err).toBeInstanceOf(DIError);
    expect(err.code).toBe(DI_ERROR_CODE.CONTAINER_STOPPED);
  });

  it('D2: stop() without start() throws CONTAINER_NOT_STARTED', async () => {
    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class AppModule extends Module({
      providers: [MyService],
    }) {}

    const container = new Container(AppModule);
    const err = await container.stop().catch((e: any) => e);
    expect(err).toBeInstanceOf(DIError);
    expect(err.code).toBe(DI_ERROR_CODE.CONTAINER_NOT_STARTED);
  });
});

// ---------------------------------------------------------------------------
// 26. Bug fix regression tests
// ---------------------------------------------------------------------------
describe('Container — bug fix regressions', () => {
  it('start() failure clears singletons and allows retry', async () => {
    let startCount = 0;

    class ServiceB extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {
        /* ok */
      }
    }
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', ServiceB]],
    }) {
      public onApplicationBootstrap() {
        startCount++;
        if (startCount === 1) throw new Error('first start failed');
      }
    }

    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
    }) {}

    const container = new Container(AppModule);

    // First start fails
    await expect(container.start()).rejects.toThrow('first start failed');

    // Retry succeeds — singletons were cleared, fresh instances created
    await container.start();
    expect(startCount).toBe(2);

    const a = container.resolve(ServiceA);
    expect(a).toBeInstanceOf(ServiceA);
  });

  it('stop() clears singletons even when onStop throws', async () => {
    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onStop() {
        throw new Error('stop failed');
      }
    }

    class AppModule extends Module({
      providers: [MyService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    // resolve works before stop
    expect(container.resolve(MyService)).toBeInstanceOf(MyService);

    // stop fails but singletons should still be cleared
    await expect(container.stop()).rejects.toThrow();

    // resolve should throw CONTAINER_STOPPED (singletons cleared, state stopped)
    expect(() => container.resolve(MyService)).toThrowDIError(DI_ERROR_CODE.CONTAINER_STOPPED);
  });

  it('concurrent start() calls are prevented', async () => {
    let resolveStart: () => void = () => {};
    class SlowService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public async onApplicationBootstrap() {
        await new Promise<void>((resolve) => {
          resolveStart = resolve;
        });
      }
    }

    class AppModule extends Module({
      providers: [SlowService],
    }) {}

    const container = new Container(AppModule);

    // First start begins (will hang until resolveStart is called)
    const firstStart = container.start();

    // Second start should fail immediately — state is 'bootstrapping'
    const err = await container.start().catch((e: any) => e);
    expect(err).toBeInstanceOf(DIError);
    expect(err.code).toBe(DI_ERROR_CODE.ALREADY_STARTED);

    // Let the first start complete
    resolveStart();
    await firstStart;
  });

  it('resolve() is blocked during stop()', async () => {
    let resolveCode: string | null = null;

    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onStop() {
        try {
          (globalThis as any).__test_container.resolve(MyService);
          resolveCode = 'resolved';
        } catch (e: any) {
          resolveCode = e.code;
        }
      }
    }

    class AppModule extends Module({
      providers: [MyService],
    }) {}

    const container = new Container(AppModule);
    (globalThis as any).__test_container = container;
    try {
      await container.start();

      await container.stop();
      expect(resolveCode).toBe(DI_ERROR_CODE.CONTAINER_STOPPED);
    } finally {
      delete (globalThis as any).__test_container;
    }
  });
});

// ---------------------------------------------------------------------------
// 27. Design issue regressions
// ---------------------------------------------------------------------------
describe('Container — design issue regressions', () => {
  it('D1: resolve() throws CONTAINER_NOT_STARTED before start()', () => {
    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class AppModule extends Module({
      providers: [MyService],
    }) {}

    const container = new Container(AppModule);
    expect(() => container.resolve(MyService)).toThrowDIError(
      DI_ERROR_CODE.CONTAINER_NOT_STARTED,
      /not been started/,
    );
  });

  it('D1: resolve() works after start()', async () => {
    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class AppModule extends Module({
      providers: [MyService],
    }) {}

    const container = new Container(AppModule);
    await container.start();
    const instance = container.resolve(MyService);
    expect(instance).toBeInstanceOf(MyService);
    await container.stop();
  });

  it('D2: withRequestScope calls onStop on request-scoped instances', async () => {
    let stopCalled = false;

    class ReqService extends Injectable({ scope: SCOPE.REQUEST }) {
      public onStop() {
        stopCalled = true;
      }
    }

    class AppModule extends Module({
      providers: [ReqService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    await container.withRequestScope(() => {
      container.resolve(ReqService);
    });

    expect(stopCalled).toBe(true);
    await container.stop();
  });

  it('D2: withRequestScope calls onStop in reverse order', async () => {
    const order: string[] = [];

    class ReqA extends Injectable({ scope: SCOPE.REQUEST }) {
      public onStop() {
        order.push('A');
      }
    }

    class ReqB extends Injectable({ scope: SCOPE.REQUEST, inject: [['reqA', ReqA]] }) {
      public onStop() {
        order.push('B');
      }
    }

    class AppModule extends Module({
      providers: [ReqA, ReqB],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    await container.withRequestScope(async () => {
      container.resolve(ReqB);
    });

    expect(order).toEqual(['B', 'A']);
    await container.stop();
  });

  it('D2: withRequestScope propagates callback return value even with cleanup', async () => {
    class ReqService extends Injectable({ scope: SCOPE.REQUEST }) {}

    class AppModule extends Module({
      providers: [ReqService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const result = await container.withRequestScope(async () => {
      container.resolve(ReqService);
      return 42;
    });

    expect(result).toBe(42);
    await container.stop();
  });

  it('D2: withRequestScope collects onStop errors into AggregateError', async () => {
    class ReqService extends Injectable({ scope: SCOPE.REQUEST }) {
      public onStop() {
        throw new Error('cleanup failed');
      }
    }

    class AppModule extends Module({
      providers: [ReqService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const err = await container
      .withRequestScope(async () => {
        container.resolve(ReqService);
      })
      .catch((e: any) => e);

    expect(err).toBeInstanceOf(AggregateError);
    expect(err.errors[0].message).toBe('cleanup failed');
    expect(err.message).toMatch(/^Request scope cleanup failed:/);
    await container.stop();
  });

  it('CF3: callback error propagates when cleanup succeeds', async () => {
    class ReqService extends Injectable({ scope: SCOPE.REQUEST }) {
      public onStop() {
        /* succeeds */
      }
    }

    class AppModule extends Module({
      providers: [ReqService] as const,
    }) {}

    const container = new Container(AppModule);
    await container.start();

    await expect(
      container.withRequestScope(() => {
        throw new Error('callback failed');
      }),
    ).rejects.toThrow('callback failed');

    await container.stop();
  });

  it('D3: start() called twice throws ALREADY_STARTED', async () => {
    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class AppModule extends Module({
      providers: [MyService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const err = await container.start().catch((e: any) => e);
    expect(err).toBeInstanceOf(DIError);
    expect(err.code).toBe(DI_ERROR_CODE.ALREADY_STARTED);
    expect(err.message).toMatch(/already been started/);

    await container.stop();
  });

  it('D3: start() after stop() throws CONTAINER_STOPPED', async () => {
    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class AppModule extends Module({
      providers: [MyService],
    }) {}

    const container = new Container(AppModule);
    await container.start();
    await container.stop();

    const err = await container.start().catch((e: any) => e);
    expect(err).toBeInstanceOf(DIError);
    expect(err.code).toBe(DI_ERROR_CODE.CONTAINER_STOPPED);
  });

  it('D1: resolve() is blocked during bootstrapping state', async () => {
    let resolveStart: () => void = () => {};

    class SlowService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public async onApplicationBootstrap() {
        await new Promise<void>((resolve) => {
          resolveStart = resolve;
        });
      }
    }

    class AppModule extends Module({
      providers: [SlowService],
    }) {}

    const container = new Container(AppModule);

    const startPromise = container.start();

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(() => container.resolve(SlowService)).toThrowDIError(
      DI_ERROR_CODE.CONTAINER_NOT_STARTED,
      /still bootstrapping/,
    );

    resolveStart();
    await startPromise;

    await container.stop();
  });

  it('resolve() called from onApplicationBootstrap during bootstrapping state throws CONTAINER_NOT_STARTED', async () => {
    let resolveError: DIError | undefined;

    class ServiceA extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap(container: Container) {
        try {
          container.resolve(ServiceA);
        } catch (e) {
          resolveError = e as DIError;
        }
      }
    }

    class AppModule extends Module({ providers: [ServiceA] }) {}
    const container = new Container(AppModule);
    await container.start();

    expect(resolveError).toBeInstanceOf(DIError);
    expect(resolveError!.code).toBe(DI_ERROR_CODE.CONTAINER_NOT_STARTED);

    await container.stop();
  });

  it('CF7: withRequestScope from onApplicationBootstrap during bootstrapping state throws CONTAINER_NOT_STARTED', async () => {
    let requestScopeError: DIError | undefined;

    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap(container: Container) {
        container
          .withRequestScope(() => {})
          .catch((e) => {
            requestScopeError = e as DIError;
          });
      }
    }

    class AppModule extends Module({ providers: [MyService] as const }) {}
    const container = new Container(AppModule);
    await container.start();

    expect(requestScopeError).toBeInstanceOf(DIError);
    expect(requestScopeError!.code).toBe(DI_ERROR_CODE.CONTAINER_NOT_STARTED);

    await container.stop();
  });

  it('D1: withRequestScope before start() — resolve inside throws CONTAINER_NOT_STARTED', async () => {
    class ReqService extends Injectable({ scope: SCOPE.REQUEST }) {}

    class AppModule extends Module({
      providers: [ReqService],
    }) {}

    const container = new Container(AppModule);

    const err = await container
      .withRequestScope(() => {
        container.resolve(ReqService);
      })
      .catch((e: any) => e);

    expect(err).toBeInstanceOf(DIError);
    expect(err.code).toBe(DI_ERROR_CODE.CONTAINER_NOT_STARTED);
  });

  it('B1: withRequestScope preserves callback error alongside cleanup error', async () => {
    class ReqService extends Injectable({ scope: SCOPE.REQUEST }) {
      public onStop() {
        throw new Error('cleanup error');
      }
    }

    class AppModule extends Module({
      providers: [ReqService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const err = await container
      .withRequestScope(() => {
        container.resolve(ReqService);
        throw new Error('callback error');
      })
      .catch((e: any) => e);

    expect(err).toBeInstanceOf(AggregateError);
    expect(err.errors).toHaveLength(2);
    expect(err.errors[0].message).toBe('callback error');
    expect(err.errors[1].message).toBe('cleanup error');
    expect(err.message).toMatch(/^Request scope failed:/);

    await container.stop();
  });

  it('D2: stop() during bootstrapping throws CONTAINER_NOT_STARTED', async () => {
    let resolveStart: () => void = () => {};

    class SlowService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public async onApplicationBootstrap() {
        await new Promise<void>((resolve) => {
          resolveStart = resolve;
        });
      }
    }

    class AppModule extends Module({
      providers: [SlowService],
    }) {}

    const container = new Container(AppModule);
    const startPromise = container.start();

    await new Promise((resolve) => setTimeout(resolve, 10));

    const err = await container.stop().catch((e: any) => e);
    expect(err).toBeInstanceOf(DIError);
    expect(err.code).toBe(DI_ERROR_CODE.CONTAINER_NOT_STARTED);

    resolveStart();
    await startPromise;
    await container.stop();
  });

  it('D3: withRequestScope calls onApplicationBootstrap on request-scoped providers', async () => {
    let startCalled = false;

    class ReqService extends Injectable({ scope: SCOPE.REQUEST }) {
      public onApplicationBootstrap() {
        startCalled = true;
      }
    }

    class AppModule extends Module({
      providers: [ReqService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    await container.withRequestScope(() => {
      expect(startCalled).toBe(true);
    });

    await container.stop();
  });

  it('D3: withRequestScope calls onApplicationBootstrap in dependency order', async () => {
    const order: string[] = [];

    class ReqA extends Injectable({ scope: SCOPE.REQUEST }) {
      public onApplicationBootstrap() {
        order.push('A');
      }
    }

    class ReqB extends Injectable({ scope: SCOPE.REQUEST, inject: [['reqA', ReqA]] }) {
      public onApplicationBootstrap() {
        order.push('B');
      }
    }

    class AppModule extends Module({
      providers: [ReqA, ReqB],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    await container.withRequestScope(() => {
      expect(order).toEqual(['A', 'B']);
    });

    await container.stop();
  });

  it('CF5: resolve() from request-scoped onApplicationBootstrap during withRequestScope works', async () => {
    class ReqB extends Injectable({ scope: SCOPE.REQUEST }) {}
    let resolvedFromHook: unknown;

    class ReqA extends Injectable({ scope: SCOPE.REQUEST }) {
      public onApplicationBootstrap(container: Container) {
        resolvedFromHook = container.resolve(ReqB);
      }
    }

    class AppModule extends Module({
      providers: [ReqA, ReqB] as const,
    }) {}

    const container = new Container(AppModule);
    await container.start();

    await container.withRequestScope(async () => {
      const _a = container.resolve(ReqA);
      const b = container.resolve(ReqB);
      expect(resolvedFromHook).toBe(b);
    });

    await container.stop();
  });

  it('D3: withRequestScope rolls back onApplicationBootstrap on failure', async () => {
    const stopped: string[] = [];

    class ReqA extends Injectable({ scope: SCOPE.REQUEST }) {
      public onApplicationBootstrap() {
        /* ok */
      }
      public onStop() {
        stopped.push('A');
      }
    }

    class ReqB extends Injectable({ scope: SCOPE.REQUEST, inject: [['reqA', ReqA]] }) {
      public onApplicationBootstrap() {
        throw new Error('onApplicationBootstrap failed');
      }
    }

    class AppModule extends Module({
      providers: [ReqA, ReqB],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    await expect(container.withRequestScope(() => {})).rejects.toThrow(
      'onApplicationBootstrap failed',
    );

    expect(stopped).toEqual(['A']);

    await container.stop();
  });

  it('D8: withRequestScope after stop() throws CONTAINER_STOPPED', async () => {
    class ReqService extends Injectable({ scope: SCOPE.REQUEST }) {}

    class AppModule extends Module({
      providers: [ReqService],
    }) {}

    const container = new Container(AppModule);
    await container.start();
    await container.stop();

    const err = await container.withRequestScope(() => {}).catch((e: any) => e);
    expect(err).toBeInstanceOf(DIError);
    expect(err.code).toBe(DI_ERROR_CODE.CONTAINER_STOPPED);
  });

  it('CF6: withRequestScope after failed start() throws CONTAINER_NOT_STARTED', async () => {
    class BadService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {
        throw new Error('fail');
      }
    }
    class ReqService extends Injectable({ scope: SCOPE.REQUEST }) {}

    class AppModule extends Module({ providers: [BadService, ReqService] as const }) {}
    const container = new Container(AppModule);

    await expect(container.start()).rejects.toThrow('fail');
    const err = await container.withRequestScope(() => {}).catch((e: any) => e);
    expect(err).toBeInstanceOf(DIError);
    expect(err.code).toBe(DI_ERROR_CODE.CONTAINER_NOT_STARTED);
  });

  it('D1: withRequestScope rollback skips services without onStop', async () => {
    const stopped: string[] = [];

    class ReqNoStop extends Injectable({ scope: SCOPE.REQUEST }) {
      public onApplicationBootstrap() {
        /* ok */
      }
    }

    class ReqWithStop extends Injectable({
      scope: SCOPE.REQUEST,
      inject: [['reqNoStop', ReqNoStop]],
    }) {
      public onApplicationBootstrap() {
        /* ok */
      }
      public onStop() {
        stopped.push('WithStop');
      }
    }

    class ReqFails extends Injectable({
      scope: SCOPE.REQUEST,
      inject: [['reqWithStop', ReqWithStop]],
    }) {
      public onApplicationBootstrap() {
        throw new Error('start failed');
      }
    }

    class AppModule extends Module({ providers: [ReqNoStop, ReqWithStop, ReqFails] }) {}
    const container = new Container(AppModule);
    await container.start();

    await expect(container.withRequestScope(() => {})).rejects.toThrow('start failed');
    // ReqNoStop has no onStop → skipped during rollback
    // ReqWithStop has onStop → called during rollback
    expect(stopped).toEqual(['WithStop']);

    await container.stop();
  });

  it('CF9: calls onStop on all request instances when onApplicationBootstrap fails', async () => {
    const stopped: string[] = [];

    class ReqA extends Injectable({ scope: SCOPE.REQUEST }) {
      public onStop() {
        stopped.push('A');
      }
    }

    class ReqB extends Injectable({ scope: SCOPE.REQUEST }) {
      public onApplicationBootstrap() {
        throw new Error('onApplicationBootstrap failed');
      }
    }

    class AppModule extends Module({
      providers: [ReqA, ReqB] as const,
    }) {}

    const container = new Container(AppModule);
    await container.start();

    await expect(container.withRequestScope(() => {})).rejects.toThrow(
      'onApplicationBootstrap failed',
    );
    // ReqA has only onStop (no onApplicationBootstrap) — must still be cleaned up
    expect(stopped).toEqual(['A']);

    await container.stop();
  });

  it('D4: withRequestScope onApplicationBootstrap failure collects onStop errors into AggregateError', async () => {
    class ReqA extends Injectable({ scope: SCOPE.REQUEST }) {
      public onApplicationBootstrap() {
        /* ok */
      }
      public onStop() {
        throw new Error('onStop A failed');
      }
    }

    class ReqB extends Injectable({ scope: SCOPE.REQUEST }) {
      public onApplicationBootstrap() {
        throw new Error('onApplicationBootstrap B failed');
      }
    }

    class AppModule extends Module({
      providers: [ReqA, ReqB],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const err = await container.withRequestScope(() => {}).catch((e: any) => e);
    expect(err).toBeInstanceOf(AggregateError);
    expect(err.errors).toHaveLength(2);
    expect(err.errors[0].message).toBe('onApplicationBootstrap B failed');
    expect(err.errors[1].message).toBe('onStop A failed');

    await container.stop();
  });

  it('D5: withRequestScope callback throwing undefined propagates error', async () => {
    class ReqService extends Injectable({ scope: SCOPE.REQUEST }) {}

    class AppModule extends Module({
      providers: [ReqService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    // eslint-disable-next-line no-throw-literal
    await expect(
      container.withRequestScope(() => {
        throw undefined as unknown as Error;
      }),
    ).rejects.toThrow('undefined');

    await container.stop();
  });

  it('D1: withRequestScope rolls back 3+ providers in reverse order', async () => {
    const stopped: string[] = [];

    class ReqA extends Injectable({ scope: SCOPE.REQUEST }) {
      public onApplicationBootstrap() {
        /* ok */
      }
      public onStop() {
        stopped.push('A');
      }
    }

    class ReqB extends Injectable({ scope: SCOPE.REQUEST, inject: [['reqA', ReqA]] }) {
      public onApplicationBootstrap() {
        /* ok */
      }
      public onStop() {
        stopped.push('B');
      }
    }

    class ReqC extends Injectable({ scope: SCOPE.REQUEST, inject: [['reqB', ReqB]] }) {
      public onApplicationBootstrap() {
        throw new Error('C failed');
      }
      public onStop() {
        stopped.push('C');
      }
    }

    class AppModule extends Module({ providers: [ReqA, ReqB, ReqC] }) {}
    const container = new Container(AppModule);
    await container.start();

    await expect(container.withRequestScope(() => {})).rejects.toThrow('C failed');
    // A, B, C all created (in store). A and B started, C's onApplicationBootstrap threw.
    // Cleanup: C, B, A (reverse store order — all instances with onStop).
    expect(stopped).toEqual(['C', 'B', 'A']);

    await container.stop();
  });
});

// ---------------------------------------------------------------------------
// T1: non-Error thrown from onStop in stop()
// ---------------------------------------------------------------------------
describe('Container — T1: stop() wraps non-Error onStop throw', () => {
  it('wraps string throw in Error', async () => {
    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onStop() {
        throw 'non-error string';
      }
    }

    class AppModule extends Module({
      providers: [MyService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const err = await container.stop().catch((e: any) => e);
    expect(err).toBeInstanceOf(AggregateError);
    expect(err.errors[0]).toBeInstanceOf(Error);
    expect(err.errors[0].message).toBe('non-error string');
  });

  it('CF8: onApplicationBootstrap throwing non-Error propagates the raw value', async () => {
    class BadService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {
        throw 'start-failed-string';
      }
    }

    class AppModule extends Module({
      providers: [BadService] as const,
    }) {}

    const container = new Container(AppModule);
    const err = await container.start().catch((e) => e);
    expect(err).toBe('start-failed-string');
  });
});

// ---------------------------------------------------------------------------
// T2: non-Error thrown from onStop in withRequestScope
// ---------------------------------------------------------------------------
describe('Container — T2: withRequestScope wraps non-Error onStop throw', () => {
  it('wraps string throw in Error', async () => {
    class ReqService extends Injectable({ scope: SCOPE.REQUEST }) {
      public onStop() {
        throw 'non-error cleanup';
      }
    }

    class AppModule extends Module({
      providers: [ReqService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const err = await container
      .withRequestScope(async () => {
        container.resolve(ReqService);
      })
      .catch((e: any) => e);

    expect(err).toBeInstanceOf(AggregateError);
    expect(err.errors[0]).toBeInstanceOf(Error);
    expect(err.errors[0].message).toBe('non-error cleanup');
    await container.stop();
  });
});

// ---------------------------------------------------------------------------
// T3: empty module start/stop
// ---------------------------------------------------------------------------
describe('Container — T3: empty module', () => {
  it('starts and stops without error', async () => {
    class EmptyModule extends Module({
      providers: [],
    }) {}

    const container = new Container(EmptyModule);
    await container.start();
    await container.stop();
  });
});

// ---------------------------------------------------------------------------
// T4: request-scoped depending on singleton
// ---------------------------------------------------------------------------
describe('Container — T4: request-scoped depending on singleton', () => {
  it('resolves request-scoped with singleton dependency', async () => {
    class SingletonService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public readonly value = 'singleton-value';
    }

    class ReqService extends Injectable({
      scope: SCOPE.REQUEST,
      inject: [['singletonService', SingletonService]],
    }) {
      public getValue() {
        return this.inject.singletonService.value;
      }
    }

    class AppModule extends Module({
      providers: [SingletonService, ReqService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const result = await container.withRequestScope(async () => {
      const req = container.resolve(ReqService);
      return req.getValue();
    });

    expect(result).toBe('singleton-value');
    await container.stop();
  });
});

// ---------------------------------------------------------------------------
// T6: onApplicationBootstrap failure swallows onStop errors
// ---------------------------------------------------------------------------
describe('Container — T6: onApplicationBootstrap failure swallows onStop cleanup errors', () => {
  it('onStop error during start failure is swallowed, onApplicationBootstrap error propagates', async () => {
    const onStopCalls: string[] = [];

    class GoodService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public async onApplicationBootstrap() {}
      public async onStop() {
        onStopCalls.push('GoodService');
        throw new Error('onStop failed');
      }
    }

    class BadService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['goodService', GoodService]],
    }) {
      public async onApplicationBootstrap() {
        throw new Error('onApplicationBootstrap failed');
      }
    }

    class AppModule extends Module({
      providers: [GoodService, BadService],
    }) {}

    const container = new Container(AppModule);
    const err = await container.start().catch((e: any) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('onApplicationBootstrap failed');
    expect(onStopCalls).toEqual(['GoodService']);
  });
});

// ---------------------------------------------------------------------------
// D1: Transient providers skip lifecycle hooks
// ---------------------------------------------------------------------------
describe('Container — D1: transient providers skip lifecycle hooks', () => {
  it('transient onApplicationBootstrap is NOT called during start()', async () => {
    let startCalled = false;
    class TransService extends Injectable({ scope: SCOPE.TRANSIENT }) {
      public onApplicationBootstrap() {
        startCalled = true;
      }
    }
    class AppModule extends Module({ providers: [TransService] }) {}
    const container = new Container(AppModule);
    await container.start();
    expect(startCalled).toBe(false);
    await container.stop();
  });

  it('transient onStop is NOT called during stop()', async () => {
    let stopCalled = false;
    class TransService extends Injectable({ scope: SCOPE.TRANSIENT }) {
      public onStop() {
        stopCalled = true;
      }
    }
    class AppModule extends Module({ providers: [TransService] }) {}
    const container = new Container(AppModule);
    await container.start();
    await container.stop();
    expect(stopCalled).toBe(false);
  });
});

describe('Container — module getter', () => {
  it('returns the module class passed to constructor', async () => {
    class AppModule extends Module({ providers: [] }) {}
    const container = new Container(AppModule);
    expect(container.module).toBe(AppModule);
  });
});

// ---------------------------------------------------------------------------
// F1: sorted getter
// ---------------------------------------------------------------------------
describe('Container — sorted getter', () => {
  it('returns frozen providers in dependency order', async () => {
    class ServiceA extends Injectable() {}
    class ServiceB extends Injectable({
      inject: [['a', ServiceA]],
    }) {}

    class AppModule extends Module({
      providers: [ServiceB, ServiceA],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    // Dependency order: A before B
    const sorted = container.sorted;
    expect(sorted).toHaveLength(2);
    expect(sorted[0]).toBe(ServiceA);
    expect(sorted[1]).toBe(ServiceB);

    // Immutable — mutations are blocked
    expect(() => (sorted as InjectableClass[]).push(ServiceA)).toThrow(TypeError);

    await container.stop();
  });
});

// ---------------------------------------------------------------------------
// F3: transient→request inside withRequestScope
// ---------------------------------------------------------------------------
describe('Container — transient depending on request-scoped (inside withRequestScope)', () => {
  it('resolves transient with request-scoped dependency inside withRequestScope', async () => {
    class RequestService extends Injectable({ scope: SCOPE.REQUEST }) {
      public readonly id = Math.random();
    }
    class TransientService extends Injectable({
      scope: SCOPE.TRANSIENT,
      inject: [['req', RequestService]],
    }) {}

    class AppModule extends Module({
      providers: [TransientService, RequestService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const result = await container.withRequestScope(async () => {
      const t1 = container.resolve(TransientService);
      const t2 = container.resolve(TransientService);
      // Transient: different instances
      expect(t1).not.toBe(t2);
      // But both share the same request-scoped dep
      expect(t1.inject.req).toBe(t2.inject.req);
      return t1.inject.req.id;
    });

    expect(typeof result).toBe('number');
    await container.stop();
  });
});

// ---------------------------------------------------------------------------
// F4: transient→request outside withRequestScope
// ---------------------------------------------------------------------------
describe('Container — transient depending on request-scoped (outside withRequestScope)', () => {
  it('throws NOT_IN_REQUEST_SCOPE when resolving transient with request-scoped dep outside withRequestScope', async () => {
    class RequestService extends Injectable({ scope: SCOPE.REQUEST }) {}
    class TransientService extends Injectable({
      scope: SCOPE.TRANSIENT,
      inject: [['req', RequestService]],
    }) {}

    class AppModule extends Module({
      providers: [TransientService, RequestService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    expect(() => {
      container.resolve(TransientService);
    }).toThrowDIError(DI_ERROR_CODE.NOT_IN_REQUEST_SCOPE);

    await container.stop();
  });
});

// ---------------------------------------------------------------------------
// 28. Circular dependency resolution via Proxy
// ---------------------------------------------------------------------------

// Forward-reference placeholder for circular dep tests (never resolved)
class _Fwd extends Injectable({ scope: SCOPE.SINGLETON }) {}

describe('Container — circular dependency resolution', () => {
  it('resolves Singleton↔Singleton circular dependency via proxy', async () => {
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', _Fwd]],
    }) {
      public getBValue() {
        return (this.inject.serviceB as ServiceB).getValue();
      }
      public getValue() {
        return 'A';
      }
    }
    class ServiceB extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceA', ServiceA]],
    }) {
      public getAValue() {
        return this.inject.serviceA.getValue();
      }
      public getValue() {
        return 'B';
      }
    }
    (ServiceA as any)._injectClasses = [ServiceB];

    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
    }) {}

    const container = new Container(AppModule);
    await container.start();
    const a = container.resolve(ServiceA);
    const b = container.resolve(ServiceB);

    expect(a).toBeInstanceOf(ServiceA);
    expect(b).toBeInstanceOf(ServiceB);
    expect(a.getBValue()).toBe('B');
    expect(b.getAValue()).toBe('A');
    // Proxy delegates to real instance — behavioral check, not reference equality
    expect(a.inject.serviceB instanceof ServiceB).toBe(true);
    // Non-proxy side is the real instance
    expect(b.inject.serviceA).toBe(a);

    await container.stop();
  });

  it('resolves Request↔Request circular dependency via proxy', async () => {
    class ReqA extends Injectable({
      scope: SCOPE.REQUEST,
      inject: [['reqB', _Fwd]],
    }) {
      public getBValue() {
        return (this.inject.reqB as ReqB).getValue();
      }
      public getValue() {
        return 'A';
      }
    }
    class ReqB extends Injectable({
      scope: SCOPE.REQUEST,
      inject: [['reqA', ReqA]],
    }) {
      public getAValue() {
        return this.inject.reqA.getValue();
      }
      public getValue() {
        return 'B';
      }
    }
    (ReqA as any)._injectClasses = [ReqB];

    class AppModule extends Module({
      providers: [ReqA, ReqB],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    await container.withRequestScope(() => {
      const a = container.resolve(ReqA);
      const b = container.resolve(ReqB);
      expect(a.getBValue()).toBe('B');
      expect(b.getAValue()).toBe('A');
      // Proxy delegates to real instance — behavioral check, not reference equality
      expect(a.inject.reqB instanceof ReqB).toBe(true);
      // Non-proxy side is the real instance
      expect(b.inject.reqA).toBe(a);
    });

    await container.stop();
  });

  it('throws CIRCULAR_DEPENDENCY for Transient↔Transient cycle', async () => {
    class TransA extends Injectable({
      scope: SCOPE.TRANSIENT,
      inject: [['transB', _Fwd]],
    }) {}
    class TransB extends Injectable({
      scope: SCOPE.TRANSIENT,
      inject: [['transA', TransA]],
    }) {}
    (TransA as any)._injectClasses = [TransB];

    class AppModule extends Module({
      providers: [TransA, TransB],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    expect(() => container.resolve(TransA)).toThrowDIError(
      DI_ERROR_CODE.CIRCULAR_DEPENDENCY,
      /transient/,
    );

    await container.stop();
  });

  it('resolves Singleton→Transient→Singleton circular dependency', async () => {
    class SingletonService extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['transientService', _Fwd]],
    }) {
      public getTransientValue() {
        return (this.inject.transientService as TransientService).getValue();
      }
    }
    class TransientService extends Injectable({
      scope: SCOPE.TRANSIENT,
      inject: [['singletonService', SingletonService]],
    }) {
      public getValue() {
        return 'transient';
      }
    }
    (SingletonService as any)._injectClasses = [TransientService];

    class AppModule extends Module({
      providers: [SingletonService, TransientService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const singleton = container.resolve(SingletonService);
    expect(singleton).toBeInstanceOf(SingletonService);
    expect(singleton.getTransientValue()).toBe('transient');

    await container.stop();
  });

  it('throws when accessing circular dep proxy during construction', async () => {
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', _Fwd]],
    }) {
      public readonly bValue: string;
      constructor(b: ServiceB) {
        super(b);
        this.bValue = b.getValue();
      }
      public getValue() {
        return 'A';
      }
    }
    class ServiceB extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceA', ServiceA]],
    }) {
      public getValue() {
        return 'B';
      }
    }
    (ServiceA as any)._injectClasses = [ServiceB];

    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
    }) {}

    const container = new Container(AppModule);
    let error: unknown;
    try {
      await container.start();
    } catch (e) {
      error = e;
    }
    expect(() => {
      throw error;
    }).toThrowDIError(DI_ERROR_CODE.CIRCULAR_DEPENDENCY, /accessed during.*construction/);
  });

  it('resolves longer cycle A→B→C→A via proxy', async () => {
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceC', _Fwd]],
    }) {
      public getCValue() {
        return (this.inject.serviceC as ServiceC).getValue();
      }
      public getValue() {
        return 'A';
      }
    }
    class ServiceB extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceA', ServiceA]],
    }) {
      public getAValue() {
        return this.inject.serviceA.getValue();
      }
      public getValue() {
        return 'B';
      }
    }
    class ServiceC extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', ServiceB]],
    }) {
      public getBValue() {
        return this.inject.serviceB.getValue();
      }
      public getValue() {
        return 'C';
      }
    }
    (ServiceA as any)._injectClasses = [ServiceC];

    class AppModule extends Module({
      providers: [ServiceA, ServiceB, ServiceC],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const a = container.resolve(ServiceA);
    const b = container.resolve(ServiceB);
    const c = container.resolve(ServiceC);

    expect(a.getCValue()).toBe('C');
    expect(b.getAValue()).toBe('A');
    expect(c.getBValue()).toBe('B');

    await container.stop();
  });

  it('proxy is not a thenable (await-safe)', async () => {
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', _Fwd]],
    }) {
      public getValue() {
        return 'A';
      }
    }
    class ServiceB extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceA', ServiceA]],
    }) {
      public getAValue() {
        return this.inject.serviceA.getValue();
      }
    }
    (ServiceA as any)._injectClasses = [ServiceB];

    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const a = container.resolve(ServiceA);
    const proxyB = a.inject.serviceB;
    const result = await Promise.resolve(proxyB);
    expect((result as ServiceB).getAValue()).toBe('A');

    await container.stop();
  });

  it('proxy supports property assignment', async () => {
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', _Fwd]],
    }) {
      public setBValue(val: string) {
        (this.inject.serviceB as any).dynamicProp = val;
      }
      public getBValue() {
        return (this.inject.serviceB as any).dynamicProp;
      }
    }
    class ServiceB extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceA', ServiceA]],
    }) {}
    (ServiceA as any)._injectClasses = [ServiceB];

    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const a = container.resolve(ServiceA);
    a.setBValue('hello');
    expect(a.getBValue()).toBe('hello');

    await container.stop();
  });

  it('proxy supports "in" operator', async () => {
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', _Fwd]],
    }) {
      public hasBProp() {
        return 'existingProp' in (this.inject.serviceB as object);
      }
    }
    class ServiceB extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceA', ServiceA]],
    }) {
      public existingProp = 'yes';
    }
    (ServiceA as any)._injectClasses = [ServiceB];

    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const a = container.resolve(ServiceA);
    expect(a.hasBProp()).toBe(true);

    await container.stop();
  });

  it('proxy supports Object.keys()', async () => {
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', _Fwd]],
    }) {
      public getBKeys() {
        return Object.keys(this.inject.serviceB as object);
      }
    }
    class ServiceB extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceA', ServiceA]],
    }) {
      public alpha = 1;
      public beta = 2;
    }
    (ServiceA as any)._injectClasses = [ServiceB];

    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const a = container.resolve(ServiceA);
    const keys = a.getBKeys();
    expect(keys).toContain('alpha');
    expect(keys).toContain('beta');

    await container.stop();
  });

  it('proxy supports instanceof check', async () => {
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', _Fwd]],
    }) {
      public isBInstance() {
        return this.inject.serviceB instanceof ServiceB;
      }
    }
    class ServiceB extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceA', ServiceA]],
    }) {}
    (ServiceA as any)._injectClasses = [ServiceB];

    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const a = container.resolve(ServiceA);
    expect(a.isBInstance()).toBe(true);

    await container.stop();
  });
});

// ---------------------------------------------------------------------------
// withRequestScope with no request-scoped providers
// ---------------------------------------------------------------------------
describe('Container — withRequestScope with no request providers', () => {
  it('returns callback result when module has only singleton providers', async () => {
    class SingletonA extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class SingletonB extends Injectable({ scope: SCOPE.SINGLETON }) {}

    class AppModule extends Module({
      providers: [SingletonA, SingletonB],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const result = await container.withRequestScope(async () => {
      return 42;
    });

    expect(result).toBe(42);
    await container.stop();
  });
});

// ---------------------------------------------------------------------------
// Re-entrant withRequestScope from request-scoped onApplicationBootstrap
// ---------------------------------------------------------------------------
describe('Container — re-entrant withRequestScope from onApplicationBootstrap', () => {
  it('throws CIRCULAR_DEPENDENCY when withRequestScope is called from request-scoped onApplicationBootstrap', async () => {
    let caughtError: DIError | undefined;

    class ReqService extends Injectable({ scope: SCOPE.REQUEST }) {
      public onApplicationBootstrap(container: Container) {
        container
          .withRequestScope(() => {})
          .catch((e: unknown) => {
            caughtError = e as DIError;
          });
      }
    }

    class AppModule extends Module({
      providers: [ReqService],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    await container.withRequestScope(() => {
      container.resolve(ReqService);
    });

    expect(caughtError).toBeInstanceOf(DIError);
    expect(caughtError!.code).toBe(DI_ERROR_CODE.CIRCULAR_DEPENDENCY);
    expect(caughtError!.message).toMatch(/withRequestScope.*onApplicationBootstrap/);

    await container.stop();
  });
});

// ---------------------------------------------------------------------------
// withRequestScope onApplicationBootstrap non-Error throw with cleanup errors
// ---------------------------------------------------------------------------
describe('Container — withRequestScope onApplicationBootstrap non-Error with cleanup failure', () => {
  it('wraps non-Error onApplicationBootstrap throw into Error when cleanup also fails', async () => {
    class ReqA extends Injectable({ scope: SCOPE.REQUEST }) {
      public onApplicationBootstrap() {
        /* ok */
      }
      public onStop() {
        throw new Error('cleanup-failed');
      }
    }
    class ReqB extends Injectable({
      scope: SCOPE.REQUEST,
      inject: [['reqA', ReqA]],
    }) {
      public onApplicationBootstrap() {
        throw 'string-from-onApplicationBootstrap';
      }
    }

    class AppModule extends Module({
      providers: [ReqA, ReqB] as const,
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const err = await container.withRequestScope(() => {}).catch((e: any) => e);

    expect(err).toBeInstanceOf(AggregateError);
    expect(err.errors[0]).toBeInstanceOf(Error);
    expect(err.errors[0].message).toBe('string-from-onApplicationBootstrap');
    expect(err.errors[1].message).toBe('cleanup-failed');

    await container.stop();
  });
});

// ---------------------------------------------------------------------------
// Proxy: Object.seal, Object.freeze, Object.defineProperty
// ---------------------------------------------------------------------------
describe('Container — proxy Object.defineProperty', () => {
  it('supports Object.defineProperty on circular dep proxy', async () => {
    class _Fwd extends Injectable({ scope: SCOPE.SINGLETON }) {}
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', _Fwd]],
    }) {
      public getValue() {
        return 'A';
      }
    }
    class ServiceB extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceA', ServiceA]],
    }) {
      public existingProp = 'yes';
    }
    (ServiceA as any)._injectClasses = [ServiceB];

    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
    }) {}

    const container = new Container(AppModule);
    await container.start();

    const a = container.resolve(ServiceA);
    const proxyB = a.inject.serviceB;

    Object.defineProperty(proxyB, 'definedProp', {
      value: 42,
      configurable: true,
      writable: true,
    });
    expect((proxyB as any).definedProp).toBe(42);

    await container.stop();
  });
});

// ---------------------------------------------------------------------------
// onStart hook (post-bootstrap phase)
// ---------------------------------------------------------------------------
describe('Container — onStart hook', () => {
  it('calls onStart after onApplicationBootstrap, resolve() is available', async () => {
    let bootstrapCalled = false;
    let resolveInOnStart: unknown;

    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {
        bootstrapCalled = true;
      }
      public onStart(container: Container) {
        resolveInOnStart = container.resolve(MyService);
      }
    }

    class AppModule extends Module({ providers: [MyService] }) {}
    const container = new Container(AppModule);
    await container.start();

    expect(bootstrapCalled).toBe(true);
    expect(resolveInOnStart).toBeInstanceOf(MyService);

    await container.stop();
  });

  it('calls onStart in dependency order', async () => {
    const order: string[] = [];

    class ServiceB extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {}
      public onStart() {
        order.push('B');
      }
    }
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', ServiceB]],
    }) {
      public onApplicationBootstrap() {}
      public onStart() {
        order.push('A');
      }
    }

    class AppModule extends Module({ providers: [ServiceA, ServiceB] }) {}
    const container = new Container(AppModule);
    await container.start();

    expect(order).toEqual(['B', 'A']);

    await container.stop();
  });

  it('onStart failure rolls back all providers', async () => {
    const stopped: string[] = [];

    class ServiceB extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {}
      public onStop() {
        stopped.push('B');
      }
    }
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', ServiceB]],
    }) {
      public onApplicationBootstrap() {}
      public onStart() {
        throw new Error('onStart failed');
      }
      public onStop() {
        stopped.push('A');
      }
    }

    class AppModule extends Module({ providers: [ServiceA, ServiceB] }) {}
    const container = new Container(AppModule);
    await expect(container.start()).rejects.toThrow('onStart failed');

    expect(stopped).toEqual(['A', 'B']);
  });

  it('onStart receives the container instance', async () => {
    let receivedContainer: Container | undefined;

    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {}
      public onStart(container: Container) {
        receivedContainer = container;
      }
    }

    class AppModule extends Module({ providers: [MyService] }) {}
    const container = new Container(AppModule);
    await container.start();

    expect(receivedContainer).toBe(container);

    await container.stop();
  });

  it('handles async onStart', async () => {
    let resolved = false;

    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {}
      public async onStart() {
        await new Promise((resolve) => setTimeout(resolve, 10));
        resolved = true;
      }
    }

    class AppModule extends Module({ providers: [MyService] }) {}
    const container = new Container(AppModule);
    await container.start();

    expect(resolved).toBe(true);

    await container.stop();
  });

  it('onStart is called for request-scoped providers inside withRequestScope', async () => {
    let startCalled = false;

    class ReqService extends Injectable({ scope: SCOPE.REQUEST }) {
      public onApplicationBootstrap() {}
      public onStart() {
        startCalled = true;
      }
    }

    class AppModule extends Module({ providers: [ReqService] }) {}
    const container = new Container(AppModule);
    await container.start();

    await container.withRequestScope(() => {
      expect(startCalled).toBe(true);
    });

    await container.stop();
  });

  it('onStart runs after onApplicationBootstrap for same provider', async () => {
    const order: string[] = [];

    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {
        order.push('bootstrap');
      }
      public onStart() {
        order.push('start');
      }
    }

    class AppModule extends Module({ providers: [MyService] }) {}
    const container = new Container(AppModule);
    await container.start();

    expect(order).toEqual(['bootstrap', 'start']);

    await container.stop();
  });
});

// ---------------------------------------------------------------------------
// beforeApplicationShutdown hook
// ---------------------------------------------------------------------------
describe('Container — beforeApplicationShutdown hook', () => {
  it('is called before onStop, resolve() is available', async () => {
    let resolveInBeforeShutdown: unknown;

    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {}
      public beforeApplicationShutdown(container: Container) {
        resolveInBeforeShutdown = container.resolve(MyService);
      }
    }

    class AppModule extends Module({ providers: [MyService] }) {}
    const container = new Container(AppModule);
    await container.start();

    await container.stop();

    expect(resolveInBeforeShutdown).toBeInstanceOf(MyService);
  });

  it('is called in dependency order', async () => {
    const order: string[] = [];

    class ServiceB extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {}
      public beforeApplicationShutdown() {
        order.push('B');
      }
    }
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', ServiceB]],
    }) {
      public onApplicationBootstrap() {}
      public beforeApplicationShutdown() {
        order.push('A');
      }
    }

    class AppModule extends Module({ providers: [ServiceA, ServiceB] }) {}
    const container = new Container(AppModule);
    await container.start();
    await container.stop();

    expect(order).toEqual(['B', 'A']);
  });

  it('runs before onStop, which runs in reverse order', async () => {
    const order: string[] = [];

    class ServiceB extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {}
      public beforeApplicationShutdown() {
        order.push('before:B');
      }
      public onStop() {
        order.push('stop:B');
      }
    }
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', ServiceB]],
    }) {
      public onApplicationBootstrap() {}
      public beforeApplicationShutdown() {
        order.push('before:A');
      }
      public onStop() {
        order.push('stop:A');
      }
    }

    class AppModule extends Module({ providers: [ServiceA, ServiceB] }) {}
    const container = new Container(AppModule);
    await container.start();
    await container.stop();

    expect(order).toEqual(['before:B', 'before:A', 'stop:A', 'stop:B']);
  });

  it('receives the container instance', async () => {
    let receivedContainer: Container | undefined;

    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {}
      public beforeApplicationShutdown(container: Container) {
        receivedContainer = container;
      }
    }

    class AppModule extends Module({ providers: [MyService] }) {}
    const container = new Container(AppModule);
    await container.start();
    await container.stop();

    expect(receivedContainer).toBe(container);
  });

  it('handles async beforeApplicationShutdown', async () => {
    let resolved = false;

    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {}
      public async beforeApplicationShutdown() {
        await new Promise((resolve) => setTimeout(resolve, 10));
        resolved = true;
      }
    }

    class AppModule extends Module({ providers: [MyService] }) {}
    const container = new Container(AppModule);
    await container.start();
    await container.stop();

    expect(resolved).toBe(true);
  });

  it('errors are collected and aggregated with onStop errors', async () => {
    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {}
      public beforeApplicationShutdown() {
        throw new Error('beforeShutdown failed');
      }
      public onStop() {
        throw new Error('onStop failed');
      }
    }

    class AppModule extends Module({ providers: [MyService] }) {}
    const container = new Container(AppModule);
    await container.start();

    const err = await container.stop().catch((e: any) => e);
    expect(err).toBeInstanceOf(AggregateError);
    expect(err.errors).toHaveLength(2);
    expect(err.errors[0].message).toBe('beforeShutdown failed');
    expect(err.errors[1].message).toBe('onStop failed');

    expect(() => container.resolve(MyService)).toThrowDIError(DI_ERROR_CODE.CONTAINER_STOPPED);
  });

  it('error in beforeApplicationShutdown does not prevent onStop from running', async () => {
    const stopped: string[] = [];

    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {}
      public beforeApplicationShutdown() {
        throw new Error('beforeShutdown failed');
      }
      public onStop() {
        stopped.push('A');
      }
    }

    class AppModule extends Module({ providers: [MyService] }) {}
    const container = new Container(AppModule);
    await container.start();

    await expect(container.stop()).rejects.toThrow();
    expect(stopped).toEqual(['A']);
  });

  it('stop() is a no-op when called twice (idempotent after full stop)', async () => {
    let stopCount = 0;
    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {}
      public beforeApplicationShutdown() {}
      public onStop() {
        stopCount++;
      }
    }

    class AppModule extends Module({ providers: [MyService] }) {}
    const container = new Container(AppModule);
    await container.start();

    await container.stop();
    await container.stop();

    expect(stopCount).toBe(1);
  });

  it('non-Error throws are wrapped', async () => {
    class MyService extends Injectable({ scope: SCOPE.SINGLETON }) {
      public onApplicationBootstrap() {}
      public beforeApplicationShutdown() {
        throw 'string-error';
      }
    }

    class AppModule extends Module({ providers: [MyService] }) {}
    const container = new Container(AppModule);
    await container.start();

    const err = await container.stop().catch((e: any) => e);
    expect(err).toBeInstanceOf(AggregateError);
    expect(err.errors[0]).toBeInstanceOf(Error);
    expect(err.errors[0].message).toBe('string-error');
  });
});

// ---------------------------------------------------------------------------
// Stale proxy access after container stop
// ---------------------------------------------------------------------------
describe('Container — stale proxy after stop', () => {
  it('throws when accessing circular dep proxy after container.stop()', async () => {
    class ServiceA extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceB', _Fwd]],
    }) {
      public getValue() {
        return 'A';
      }
    }
    class ServiceB extends Injectable({
      scope: SCOPE.SINGLETON,
      inject: [['serviceA', ServiceA]],
    }) {
      public getValue() {
        return 'B';
      }
    }
    (ServiceA as any)._injectClasses = [ServiceB];

    class AppModule extends Module({
      providers: [ServiceA, ServiceB],
    }) {}

    const container = new Container(AppModule);
    await container.start();
    const a = container.resolve(ServiceA);
    const proxyB = a.inject.serviceB;
    await container.stop();

    expect(() => {
      (proxyB as ServiceB).getValue();
    }).toThrowDIError(DI_ERROR_CODE.CIRCULAR_DEPENDENCY, /no longer available/);
  });
});
