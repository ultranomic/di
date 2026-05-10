import { AsyncLocalStorage } from "node:async_hooks";
import type { Context } from "hono";

type RequestStore = { hono: Context };

const storage = new AsyncLocalStorage<RequestStore>();

export const RequestContext = {
  get(): Context | undefined {
    const store = storage.getStore();
    return store?.hono;
  },
  run<T>(c: Context, fn: () => Promise<T>): Promise<T> {
    return storage.run({ hono: c }, fn);
  },
} as const;
