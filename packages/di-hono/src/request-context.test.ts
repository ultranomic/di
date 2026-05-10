import type { Context } from "hono";
import { describe, expect, it } from "vite-plus/test";
import { RequestContext } from "./request-context.ts";

const mockContext = { req: { header: () => "test" } } as unknown as Context;

describe("RequestContext", () => {
  it("get() returns undefined outside run()", () => {
    expect(RequestContext.get()).toBeUndefined();
  });

  it("get() returns Context inside run()", async () => {
    const result = await RequestContext.run(mockContext, async () => {
      return RequestContext.get();
    });
    expect(result).toBe(mockContext);
  });

  it("nested run() calls are isolated", async () => {
    const inner = { req: { header: () => "inner" } } as unknown as Context;
    const result = await RequestContext.run(mockContext, async () => {
      expect(RequestContext.get()).toBe(mockContext);
      const innerResult = await RequestContext.run(inner, async () => {
        return RequestContext.get();
      });
      expect(innerResult).toBe(inner);
      expect(RequestContext.get()).toBe(mockContext);
      return innerResult;
    });
    expect(result).toBe(inner);
  });

  it("get() returns undefined after run() completes", async () => {
    await RequestContext.run(mockContext, async () => {});
    expect(RequestContext.get()).toBeUndefined();
  });

  it("can access mock context properties from inside run()", async () => {
    await RequestContext.run(mockContext, async () => {
      const c = RequestContext.get()!;
      expect(c.req.header("any")).toBe("test");
    });
  });

  it("context is cleaned up after run() callback throws", async () => {
    const error = new Error("test error");
    await expect(
      RequestContext.run(mockContext, async () => {
        expect(RequestContext.get()).toBe(mockContext);
        throw error;
      }),
    ).rejects.toThrow(error);
    expect(RequestContext.get()).toBeUndefined();
  });

  it("concurrent run() calls — each sees its own context", async () => {
    const ctx1 = { req: { header: () => "ctx1" } } as unknown as Context;
    const ctx2 = { req: { header: () => "ctx2" } } as unknown as Context;

    const results = await Promise.all([
      RequestContext.run(ctx1, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return RequestContext.get();
      }),
      RequestContext.run(ctx2, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return RequestContext.get();
      }),
    ]);

    expect(results[0]).toBe(ctx1);
    expect(results[1]).toBe(ctx2);
  });
});
