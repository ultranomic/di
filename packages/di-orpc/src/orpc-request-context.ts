import { AsyncLocalStorage } from "node:async_hooks";

type OrpcRequestStore = { context: unknown };

const storage = new AsyncLocalStorage<OrpcRequestStore>();

export const OrpcRequestContext = {
  get<T = unknown>(): T | undefined {
    const store = storage.getStore();
    return store?.context as T | undefined;
  },
  run<T>(context: unknown, fn: () => Promise<T>): Promise<T> {
    return storage.run({ context }, fn);
  },
} as const;
