import { describe, it, expect } from 'vite-plus/test';
import { OrpcRequestContext } from './orpc-request-context.js';

describe('OrpcRequestContext', () => {
  it('returns undefined outside run()', () => {
    expect(OrpcRequestContext.get()).toBeUndefined();
  });

  it('makes context available inside run()', async () => {
    const ctx = { userId: '123' };
    const result = await OrpcRequestContext.run(ctx, async () => {
      return OrpcRequestContext.get();
    });
    expect(result).toBe(ctx);
  });

  it('returns undefined after run() completes', async () => {
    await OrpcRequestContext.run({ test: true }, async () => {});
    expect(OrpcRequestContext.get()).toBeUndefined();
  });

  it('isolates nested run() calls', async () => {
    const outerCtx = { scope: 'outer' };
    const innerCtx = { scope: 'inner' };

    await OrpcRequestContext.run(outerCtx, async () => {
      expect(OrpcRequestContext.get()).toBe(outerCtx);

      await OrpcRequestContext.run(innerCtx, async () => {
        expect(OrpcRequestContext.get()).toBe(innerCtx);
      });

      expect(OrpcRequestContext.get()).toBe(outerCtx);
    });
  });

  it('cleans up context after callback throws', async () => {
    const ctx = { test: true };

    await expect(
      OrpcRequestContext.run(ctx, async () => {
        throw new Error('test error');
      }),
    ).rejects.toThrow('test error');

    expect(OrpcRequestContext.get()).toBeUndefined();
  });

  it('supports typed get()', async () => {
    type MyContext = { userId: string; role: string };
    const ctx: MyContext = { userId: '1', role: 'admin' };

    await OrpcRequestContext.run(ctx, async () => {
      const typed = OrpcRequestContext.get<MyContext>();
      expect(typed?.userId).toBe('1');
      expect(typed?.role).toBe('admin');
    });
  });

  it('isolates concurrent async contexts', async () => {
    const ctx1 = { id: 1 };
    const ctx2 = { id: 2 };

    const [result1, result2] = await Promise.all([
      OrpcRequestContext.run(ctx1, async () => {
        await new Promise((r) => setTimeout(r, 10));
        return OrpcRequestContext.get();
      }),
      OrpcRequestContext.run(ctx2, async () => {
        await new Promise((r) => setTimeout(r, 5));
        return OrpcRequestContext.get();
      }),
    ]);

    expect(result1).toBe(ctx1);
    expect(result2).toBe(ctx2);
  });
});
