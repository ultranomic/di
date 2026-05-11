import { AsyncLocalStorage } from 'node:async_hooks';

type OrpcRequestStore = { context: unknown };

const REQUEST_STORAGE = new AsyncLocalStorage<OrpcRequestStore>();

export const OrpcRequestContext = {
  get<T = unknown>(): T | undefined {
    const store = REQUEST_STORAGE.getStore();
    return store?.context as T | undefined;
  },
  run<T>(context: unknown, fn: () => Promise<T>): Promise<T> {
    return REQUEST_STORAGE.run({ context }, fn);
  },
} as const;
