import { assertType, describe, test } from "vite-plus/test";
import type { Context } from "hono";
import { RequestContext } from "./request-context.ts";

describe("RequestContext types", () => {
  test("get() returns Context | undefined", () => {
    const result = RequestContext.get();
    assertType<Context | undefined>(result);
  });

  test("run() returns Promise<T>", () => {
    const result = RequestContext.run({} as Context, async () => "test");
    assertType<Promise<string>>(result);
  });

  test("run() preserves return type", () => {
    const result = RequestContext.run({} as Context, async () => 42);
    assertType<Promise<number>>(result);
  });

  test("run() works with void return", () => {
    const result = RequestContext.run({} as Context, async () => {});
    assertType<Promise<void>>(result);
  });
});
