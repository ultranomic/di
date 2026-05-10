import { assertType, describe, test } from "vite-plus/test";
import { buildGraph } from "./graph.ts";
import { Injectable } from "./injectable.ts";
import { Module } from "./module.ts";
import { SCOPE } from "./scope.ts";
import type { GraphResult, InjectableClass } from "./types.ts";

class ServiceA extends Injectable({ scope: SCOPE.SINGLETON }) {}
class ServiceB extends Injectable({
  scope: SCOPE.SINGLETON,
  inject: [["serviceA", ServiceA]],
}) {}

class AppModule extends Module({
  providers: [ServiceA, ServiceB],
  exports: [ServiceB],
}) {}

describe("buildGraph types", () => {
  test("buildGraph returns GraphResult", () => {
    const result = buildGraph(AppModule);
    assertType<GraphResult>(result);
  });

  test("GraphResult.sorted is readonly InjectableClass array", () => {
    const result = buildGraph(AppModule);
    assertType<readonly InjectableClass[]>(result.sorted);
  });

  test("sorted array elements are InjectableClass", () => {
    const result = buildGraph(AppModule);
    const first = result.sorted[0];
    if (first) {
      assertType<InjectableClass>(first);
    }
  });
});
