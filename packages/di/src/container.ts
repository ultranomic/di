import { AsyncLocalStorage } from "node:async_hooks";
import { DI_ERROR_CODE, DIError } from "./di-error.ts";
import { buildGraph } from "./graph.ts";
import { SCOPE } from "./scope.ts";
import type { InjectableClass, ModuleClass } from "./types.ts";

type RequestStore = Map<InjectableClass | typeof IN_REQUEST_START, unknown>;

const PENDING: unique symbol = Symbol("pending");
const IN_REQUEST_START: unique symbol = Symbol("inRequestStart");

const createLazyProxy = <T>(
  cls: InjectableClass<T>,
  map: Map<InjectableClass | typeof IN_REQUEST_START, unknown>,
): T => {
  const lazyTarget = (): T => {
    const cached = map.get(cls);
    if (cached !== undefined && cached !== PENDING) {
      return cached as T;
    }
    if (cached === undefined) {
      throw new DIError(
        DI_ERROR_CODE.CIRCULAR_DEPENDENCY,
        `${cls.name} is no longer available. This can happen if the container was stopped or if the instance failed to construct.`,
      );
    }
    throw new DIError(
      DI_ERROR_CODE.CIRCULAR_DEPENDENCY,
      `Circular dependency: ${cls.name} is being accessed during its own construction. Defer the access to a method call instead of the constructor.`,
    );
  };

  return new Proxy({} as object, {
    get(_target, prop, _receiver) {
      if (prop === "then") return undefined;
      const target = lazyTarget() as object;
      const value = Reflect.get(target, prop, target);
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    },
    set(_target, prop, value) {
      const target = lazyTarget() as object;
      return Reflect.set(target, prop, value);
    },
    has(_target, prop) {
      return prop in (lazyTarget() as object);
    },
    getPrototypeOf(_target) {
      return Object.getPrototypeOf(lazyTarget() as object);
    },
    ownKeys() {
      return Reflect.ownKeys(lazyTarget() as object);
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Object.getOwnPropertyDescriptor(lazyTarget() as object, prop);
    },
    defineProperty(_target, prop, descriptor) {
      Object.defineProperty(lazyTarget() as object, prop, descriptor);
      return true;
    },
  }) as T;
};

const hasLifecycleHook = <THook extends string>(
  obj: unknown,
  hook: THook,
): obj is Record<THook, (...args: unknown[]) => unknown> =>
  typeof obj === "object" &&
  obj !== null &&
  hook in obj &&
  typeof (obj as Record<string, unknown>)[hook] === "function";

const toError = (err: unknown): Error => (err instanceof Error ? err : new Error(String(err)));

const throwAggregate = (errors: Error[], prefix: string): void => {
  const message = errors.map((e) => e.message).join("; ");
  throw new AggregateError(errors, `${prefix}: ${message}`);
};

const MSG_NOT_STARTED = "Container has not been started. Call start() first.";
const MSG_NOT_IN_STARTED_STATE = "Container is not in a started state.";

/** Dependency injection container that resolves providers, manages lifecycles, and handles scoping. */
export class Container {
  readonly #module: ModuleClass;
  readonly #sorted: readonly InjectableClass[];
  readonly #singletonProviders: readonly InjectableClass[];
  readonly #reversedSingletonProviders: readonly InjectableClass[];
  readonly #requestProviders: readonly InjectableClass[];
  readonly #providerSet: ReadonlySet<InjectableClass>;
  readonly #singletons = new Map<InjectableClass, unknown>();
  readonly #als = new AsyncLocalStorage<RequestStore>();
  readonly #resolutionStack = new Set<InjectableClass>();
  #state: "idle" | "starting" | "started" | "stopping" | "stopped" = "idle";

  /**
   * Create a new container for the given root module.
   * Builds and validates the dependency graph immediately.
   * @param {ModuleClass} module - The root module class to build the dependency graph from.
   * @throws {DIError} When the dependency graph contains a cycle, duplicate providers, scope violations, or invalid exports.
   */
  public constructor(module: ModuleClass) {
    this.#module = module;
    const result = buildGraph(module);
    this.#sorted = result.sorted;
    const singletons: InjectableClass[] = [];
    const requests: InjectableClass[] = [];
    for (const p of result.sorted) {
      if (p._scope === SCOPE.SINGLETON) {
        singletons.push(p);
      } else if (p._scope === SCOPE.REQUEST) {
        requests.push(p);
      }
    }
    this.#singletonProviders = Object.freeze(singletons);
    this.#reversedSingletonProviders = Object.freeze(singletons.toReversed());
    this.#requestProviders = Object.freeze(requests);
    this.#providerSet = new Set(result.sorted);
  }

  /** The root module class passed to the constructor. */
  public get module(): ModuleClass {
    return this.#module;
  }

  /** Topologically sorted list of all providers in the dependency graph. */
  public get sorted(): readonly InjectableClass[] {
    return this.#sorted;
  }

  /**
   * Resolve a provider instance by its class.
   * @param {InjectableClass<T>} cls - The injectable class to resolve.
   * @returns {T} An instance of the requested provider.
   * @throws {DIError} When the container has not been started (code `CONTAINER_NOT_STARTED`).
   * @throws {DIError} When the container has been stopped or is stopping (code `CONTAINER_STOPPED`).
   * @throws {DIError} When no provider is registered for the given class (code `MISSING_PROVIDER`).
   * @throws {DIError} When a circular dependency is detected (code `CIRCULAR_DEPENDENCY`).
   * @throws {DIError} When a request-scoped provider is resolved outside a request scope (code `NOT_IN_REQUEST_SCOPE`).
   * @throws {DIError} When the provider has an unrecognized scope value (code `UNKNOWN_SCOPE`).
   */
  public resolve<T>(cls: InjectableClass<T>): T {
    this.#throwIfStopped();
    if (this.#state === "idle") {
      throw new DIError(DI_ERROR_CODE.CONTAINER_NOT_STARTED, MSG_NOT_STARTED);
    }
    if (this.#state === "starting") {
      throw new DIError(
        DI_ERROR_CODE.CONTAINER_NOT_STARTED,
        "Container is still starting. resolve() is not available during startup.",
      );
    }

    return this.#resolveInternal(cls);
  }

  #resolveInternal<T>(cls: InjectableClass<T>): T {
    if (!this.#providerSet.has(cls)) {
      throw new DIError(DI_ERROR_CODE.MISSING_PROVIDER, `No provider registered for ${cls.name}`);
    }

    switch (cls._scope) {
      case SCOPE.SINGLETON: {
        return this.#getOrCreate(this.#singletons, cls);
      }
      case SCOPE.TRANSIENT: {
        if (this.#resolutionStack.has(cls)) {
          throw new DIError(
            DI_ERROR_CODE.CIRCULAR_DEPENDENCY,
            `Circular dependency involving transient ${cls.name} cannot be resolved. Use Singleton or Request scope for at least one participant in the cycle.`,
          );
        }
        this.#resolutionStack.add(cls);
        try {
          return this.#createInstance(cls);
        } finally {
          this.#resolutionStack.delete(cls);
        }
      }
      case SCOPE.REQUEST: {
        const store = this.#als.getStore();
        if (store === undefined) {
          throw new DIError(
            DI_ERROR_CODE.NOT_IN_REQUEST_SCOPE,
            `Cannot resolve ${cls.name} outside of a request scope. Use container.withRequestScope().`,
          );
        }
        return this.#getOrCreate(store, cls);
      }
      /* v8 ignore start -- unreachable: buildGraph validates all scopes at construction */
      default: {
        throw new DIError(
          DI_ERROR_CODE.UNKNOWN_SCOPE,
          `Unknown scope "${String(cls._scope)}" for ${cls.name}`,
        );
      }
      /* v8 ignore stop */
    }
  }

  /**
   * Instantiate all singleton providers and call their `onStart` hooks in dependency order.
   * @throws {DIError} When the container has already been started or is starting (code `ALREADY_STARTED`).
   * @throws {DIError} When the container has been stopped or is stopping (code `CONTAINER_STOPPED`).
   * @throws {Error} When an `onStart` hook throws; already-started providers are rolled back.
   * @example
   * ```ts
   * const container = new Container(AppModule);
   * await container.start();
   * ```
   */
  public async start(): Promise<void> {
    if (this.#state === "started" || this.#state === "starting") {
      throw new DIError(
        DI_ERROR_CODE.ALREADY_STARTED,
        "Container has already been started or is starting",
      );
    }
    this.#throwIfStopped();
    this.#state = "starting";

    const providers = this.#singletonProviders;
    try {
      await this.#startProviders(providers);
    } catch (err) {
      this.#singletons.clear();
      this.#resolutionStack.clear();
      this.#state = "idle";
      throw err;
    }

    this.#state = "started";
  }

  /**
   * Call `onStop` hooks on all singleton providers in reverse dependency order, then mark the container as stopped.
   * @throws {DIError} When the container has not been started or is still starting (code `CONTAINER_NOT_STARTED`).
   * @throws {DIError} When the container has been stopped or is stopping (code `CONTAINER_STOPPED`).
   * @throws {AggregateError} When one or more `onStop` hooks fail.
   */
  public async stop(): Promise<void> {
    if (this.#state === "idle" || this.#state === "starting") {
      throw new DIError(DI_ERROR_CODE.CONTAINER_NOT_STARTED, MSG_NOT_IN_STARTED_STATE);
    }
    if (this.#state !== "started") return;
    this.#state = "stopping";

    try {
      const singletonProviders = this.#reversedSingletonProviders;
      const errors = await this.#stopInstances(
        singletonProviders
          .map((p) => this.#singletons.get(p))
          .filter((inst): inst is object => inst !== undefined),
      );

      if (errors.length > 0) {
        throwAggregate(errors, "Stop failed");
      }
    } finally {
      this.#singletons.clear();
      this.#state = "stopped";
    }
  }

  /**
   * Run a callback with a fresh request-scoped instance store.
   * @param {() => Promise<T> | T} fn - Callback to execute within the request scope.
   * @returns {Promise<T>} The return value of the callback.
   * @throws {DIError} When the container has not been started (code `CONTAINER_NOT_STARTED`).
   * @throws {DIError} When the container has been stopped or is stopping (code `CONTAINER_STOPPED`).
   * @throws {AggregateError} When request-scoped `onStop` hooks fail during cleanup.
   * @throws {Error} When an `onStart` hook or the callback throws.
   */
  public async withRequestScope<T>(fn: () => Promise<T> | T): Promise<T> {
    this.#throwIfStopped();
    if (this.#state !== "started") {
      throw new DIError(DI_ERROR_CODE.CONTAINER_NOT_STARTED, MSG_NOT_STARTED);
    }
    const currentStore = this.#als.getStore();
    if (currentStore?.has(IN_REQUEST_START)) {
      throw new DIError(
        DI_ERROR_CODE.CIRCULAR_DEPENDENCY,
        "Cannot call withRequestScope() from within a request-scoped onStart hook — this would cause infinite recursion.",
      );
    }

    const store: RequestStore = new Map();
    return await this.#als.run(store, async () => {
      const requestProviders = this.#requestProviders;
      store.set(IN_REQUEST_START, true);
      try {
        await this.#startProviders(requestProviders, { rollback: false });
      } catch (startErr) {
        store.delete(IN_REQUEST_START);
        const cleanupErrors = await this.#stopInstances([...store.values()].toReversed());
        if (cleanupErrors.length > 0) {
          throwAggregate([toError(startErr), ...cleanupErrors], "Request scope startup failed");
        } else {
          throw toError(startErr);
        }
      }
      store.delete(IN_REQUEST_START);

      let result: T | undefined = undefined;
      let callbackError: unknown = undefined;
      let hasError = false;

      try {
        result = await Promise.try(fn);
      } catch (err) {
        callbackError = err;
        hasError = true;
      }

      const cleanupErrors = await this.#stopInstances([...store.values()].toReversed());

      if (cleanupErrors.length > 0) {
        const all = hasError ? [toError(callbackError), ...cleanupErrors] : cleanupErrors;
        throwAggregate(all, hasError ? "Request scope failed" : "Request scope cleanup failed");
      }

      if (hasError) {
        throw toError(callbackError);
      }

      return result as T;
    });
  }

  async #startProviders(
    providers: readonly InjectableClass[],
    { rollback = true }: { rollback?: boolean } = {},
  ): Promise<void> {
    const startedInstances: unknown[] = [];

    for (const provider of providers) {
      try {
        const instance = this.#resolveInternal(provider);
        if (rollback) {
          startedInstances.push(instance);
        }
        if (hasLifecycleHook(instance, "onStart")) {
          await Promise.try(() => instance.onStart(this));
        }
      } catch (err) {
        if (rollback) {
          await this.#rollbackStarted(startedInstances);
        }
        throw err;
      }
    }
  }

  async #rollbackStarted(instances: unknown[]): Promise<void> {
    for (let i = instances.length - 1; i >= 0; i--) {
      const instance = instances[i];
      if (!hasLifecycleHook(instance, "onStop")) continue;
      try {
        await Promise.try(() => instance.onStop(this));
      } catch {
        // intentional: rollback errors must not mask the original failure
      }
    }
  }

  async #stopInstances(instances: readonly unknown[]): Promise<Error[]> {
    const errors: Error[] = [];

    for (const instance of instances) {
      if (!hasLifecycleHook(instance, "onStop")) continue;
      try {
        await Promise.try(() => instance.onStop(this));
      } catch (err) {
        errors.push(toError(err));
      }
    }

    return errors;
  }

  #getOrCreate<T>(
    map: Map<InjectableClass | typeof IN_REQUEST_START, unknown>,
    cls: InjectableClass<T>,
  ): T {
    const cached = map.get(cls);
    if (cached !== undefined) {
      if (cached === PENDING) {
        return createLazyProxy(cls, map);
      }
      return cached as T;
    }

    map.set(cls, PENDING);
    try {
      const instance = this.#createInstance(cls);
      map.set(cls, instance);
      return instance;
    } catch (err) {
      map.delete(cls);
      throw err;
    }
  }

  #createInstance<T>(provider: InjectableClass<T>): T {
    const deps = provider._inject.map((dep) => this.#resolveInternal(dep));
    return new provider(...deps);
  }

  #throwIfStopped(): void {
    if (this.#state === "stopped" || this.#state === "stopping") {
      const message =
        this.#state === "stopping" ? "Container is shutting down" : "Container has been stopped";
      throw new DIError(DI_ERROR_CODE.CONTAINER_STOPPED, message);
    }
  }
}
