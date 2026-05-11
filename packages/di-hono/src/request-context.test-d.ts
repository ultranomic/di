import { assertType, describe, test } from 'vite-plus/test';
import type { Context } from 'hono';
import { RequestContext } from './request-context.ts';

class AppContext extends RequestContext({
  create: (c) => ({
    user: c.req.header('Authorization') ?? '',
    requestId: crypto.randomUUID(),
  }),
}) {}

describe('RequestContext types', () => {
  test('get() returns T | undefined', () => {
    const instance = new AppContext();
    const result = instance.get();
    assertType<{ user: string; requestId: string } | undefined>(result);
  });

  test('run() returns Promise<T>', () => {
    const result = AppContext.run({} as Context, async () => 'test');
    assertType<Promise<string>>(result);
  });

  test('run() preserves return type', () => {
    const result = AppContext.run({} as Context, async () => 42);
    assertType<Promise<number>>(result);
  });

  test('run() works with void return', () => {
    const result = AppContext.run({} as Context, async () => {});
    assertType<Promise<void>>(result);
  });

  test('static _isRequestContext is true', () => {
    assertType<true>(AppContext._isRequestContext);
  });

  test('static _createContext is (c: Context) => T', () => {
    assertType<(c: Context) => { user: string; requestId: string }>(AppContext._createContext);
  });
});
