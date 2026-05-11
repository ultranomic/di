import { AsyncLocalStorage } from 'node:async_hooks';
import type { Context } from 'hono';

type RequestStore = { hono: Context };

const REQUEST_STORAGE = new AsyncLocalStorage<RequestStore>();

export const RequestContext = {
  get(): Context | undefined {
    const store = REQUEST_STORAGE.getStore();
    return store?.hono;
  },
  run<T>(c: Context, fn: () => Promise<T>): Promise<T> {
    return REQUEST_STORAGE.run({ hono: c }, fn);
  },
} as const;
