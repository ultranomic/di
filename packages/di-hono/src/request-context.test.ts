import type { Context } from 'hono';
import { describe, expect, it } from 'vite-plus/test';
import { RequestContext } from './request-context.ts';

const mockContext = { req: { header: () => 'test' } } as unknown as Context;

class TestContext extends RequestContext({
  create: (c) => ({ url: c.req.url, header: c.req.header('any') }),
}) {}

describe('RequestContext', () => {
  it('get() returns undefined outside run()', () => {
    const instance = new TestContext();
    expect(instance.get()).toBeUndefined();
  });

  it('get() returns context value inside run()', async () => {
    const instance = new TestContext();
    const result = await TestContext.run(mockContext, async () => {
      return instance.get();
    });
    expect(result).toEqual({ url: undefined, header: 'test' });
  });

  it('nested run() calls are isolated', async () => {
    const inner = { req: { header: () => 'inner', url: '/inner' } } as unknown as Context;
    const instance = new TestContext();
    const result = await TestContext.run(mockContext, async () => {
      expect(instance.get()).toEqual({ url: undefined, header: 'test' });
      const innerResult = await TestContext.run(inner, async () => {
        return instance.get();
      });
      expect(innerResult).toEqual({ url: '/inner', header: 'inner' });
      expect(instance.get()).toEqual({ url: undefined, header: 'test' });
      return innerResult;
    });
    expect(result).toEqual({ url: '/inner', header: 'inner' });
  });

  it('get() returns undefined after run() completes', async () => {
    const instance = new TestContext();
    await TestContext.run(mockContext, async () => {});
    expect(instance.get()).toBeUndefined();
  });

  it('context is cleaned up after run() callback throws', async () => {
    const instance = new TestContext();
    const error = new Error('test error');
    await expect(
      TestContext.run(mockContext, async () => {
        expect(instance.get()).toBeDefined();
        throw error;
      }),
    ).rejects.toThrow(error);
    expect(instance.get()).toBeUndefined();
  });

  it('concurrent run() calls — each sees its own context', async () => {
    const ctx1 = { req: { header: () => 'ctx1', url: '/ctx1' } } as unknown as Context;
    const ctx2 = { req: { header: () => 'ctx2', url: '/ctx2' } } as unknown as Context;

    const instance = new TestContext();
    const results = await Promise.all([
      TestContext.run(ctx1, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return instance.get();
      }),
      TestContext.run(ctx2, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return instance.get();
      }),
    ]);

    expect(results[0]).toEqual({ url: '/ctx1', header: 'ctx1' });
    expect(results[1]).toEqual({ url: '/ctx2', header: 'ctx2' });
  });

  it('multiple RequestContext subclasses are isolated', async () => {
    class AuthContext extends RequestContext({
      create: (c) => ({ user: c.req.header('Authorization') }),
    }) {}
    class TraceContext extends RequestContext({
      create: (c) => ({ traceId: c.req.header('x-trace-id') }),
    }) {}

    const authInstance = new AuthContext();
    const traceInstance = new TraceContext();

    const authCtx = {
      req: { header: (name: string) => (name === 'Authorization' ? 'Bearer token' : undefined) },
    } as unknown as Context;
    const traceCtx = {
      req: { header: (name: string) => (name === 'x-trace-id' ? 'trace-123' : undefined) },
    } as unknown as Context;

    await AuthContext.run(authCtx, async () => {
      await TraceContext.run(traceCtx, async () => {
        expect(authInstance.get()).toEqual({ user: 'Bearer token' });
        expect(traceInstance.get()).toEqual({ traceId: 'trace-123' });
      });
    });
  });

  it('has _isRequestContext static marker', () => {
    expect(TestContext._isRequestContext).toBe(true);
  });

  it('has _createContext static factory', () => {
    expect(typeof TestContext._createContext).toBe('function');
  });

  it('is Injectable — has _scope and _isInjectable', () => {
    expect(TestContext._isInjectable).toBe(true);
    expect(TestContext._scope).toBe('SINGLETON');
  });
});
