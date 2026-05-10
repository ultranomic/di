import { assertType, describe, test } from "vite-plus/test";
import { SCOPE, type Scope } from "./scope.ts";

describe("SCOPE types", () => {
  test("SCOPE.SINGLETON is literal string", () => {
    assertType<"SINGLETON">(SCOPE.SINGLETON);
  });

  test("SCOPE.TRANSIENT is literal string", () => {
    assertType<"TRANSIENT">(SCOPE.TRANSIENT);
  });

  test("SCOPE.REQUEST is literal string", () => {
    assertType<"REQUEST">(SCOPE.REQUEST);
  });

  test("Scope is union of all scope literals", () => {
    assertType<Scope>(SCOPE.SINGLETON);
    assertType<Scope>(SCOPE.TRANSIENT);
    assertType<Scope>(SCOPE.REQUEST);
  });

  test("SCOPE values are assignable to Scope", () => {
    const single: Scope = SCOPE.SINGLETON;
    const trans: Scope = SCOPE.TRANSIENT;
    const req: Scope = SCOPE.REQUEST;
    assertType<Scope>(single);
    assertType<Scope>(trans);
    assertType<Scope>(req);
  });
});
