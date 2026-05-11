import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, SCOPE } from '@ultranomic/di';
import type { Context } from 'hono';

/**
 * Mixin factory that creates a request-scoped context provider.
 * Each subclass has its own `AsyncLocalStorage` instance and a `create` factory
 * that builds the context value from Hono's `Context`.
 *
 * @example
 * ```ts
 * class AppContext extends RequestContext({
 *   create: (c) => ({
 *     user: extractUser(c.req.header('Authorization')),
 *     requestId: crypto.randomUUID(),
 *   }),
 * }) {}
 * ```
 */
export const RequestContext = <T>(config: { create: (c: Context) => T }) => {
  const storage = new AsyncLocalStorage<T>();

  return class extends Injectable({ scope: SCOPE.SINGLETON }) {
    public static readonly _isRequestContext = true as const;
    public static readonly _createContext = config.create;
    public static readonly _storage = storage;

    public get(): T | undefined {
      return storage.getStore();
    }

    public static run<R>(c: Context, fn: () => Promise<R>): Promise<R> {
      return storage.run(config.create(c), fn);
    }
  };
};
