import { assertType, describe, test } from "vite-plus/test";
import { Injectable, Module, SCOPE } from "@ultranomic/di";
import { os } from "@orpc/server";
import { z } from "zod";
import type { Procedure } from "@orpc/server";
import { OrpcModule } from "./orpc-module.ts";
import { OrpcRouter } from "./orpc-router.ts";
import type {
  OrpcRouterClass,
  OrpcModuleClass,
  OrpcModuleOptionsFactory,
  InferOrpcRouterTree,
} from "./types.ts";

class UserService extends Injectable() {}

class UserRouter extends OrpcRouter({
  path: "users",
  inject: [["userService", UserService]] as const,
}) {
  list = this.orpc
    .input(z.object({}))
    .output(z.array(z.string()))
    .handler(async () => []);
  getById = this.orpc
    .input(z.object({ id: z.string() }))
    .output(z.string())
    .handler(async () => "");
}

class AuthRouter extends OrpcRouter({ path: "auth" }) {
  login = this.orpc.output(z.boolean()).handler(async () => true);
}

class EmptyOrpcModule extends OrpcModule() {}

class BasicModule extends Module({
  imports: [OrpcModule()],
  providers: [UserRouter, AuthRouter],
}) {}

class SharedModule extends Module({
  providers: [UserService],
  exports: [UserService],
}) {}

class AppModule extends Module({
  imports: [OrpcModule(), SharedModule],
  providers: [UserRouter, AuthRouter],
}) {}

describe("OrpcModule types", () => {
  test("_isOrpcModule is literal true", () => {
    assertType<true>(EmptyOrpcModule._isOrpcModule);
    assertType<true>(OrpcModule()._isOrpcModule);
  });

  test("_orpcOptions is OrpcModuleOptionsFactory", () => {
    assertType<OrpcModuleOptionsFactory>(EmptyOrpcModule._orpcOptions);
    assertType<OrpcModuleOptionsFactory>(OrpcModule()._orpcOptions);
  });

  test("OrpcRouterClass narrows _orpcPath", () => {
    assertType<OrpcRouterClass<"users">>(UserRouter);
    assertType<OrpcRouterClass<"auth">>(AuthRouter);
  });

  test("OrpcModuleClass type guard", () => {
    assertType<OrpcModuleClass>(EmptyOrpcModule);
    assertType<OrpcModuleClass>(OrpcModule());
  });
});

describe("InferOrpcRouterTree", () => {
  test("empty module produces empty router tree", () => {
    type Tree = InferOrpcRouterTree<typeof EmptyOrpcModule>;
    assertType<{}>({} as Tree);
  });

  test("basic module produces typed router tree", () => {
    type Tree = InferOrpcRouterTree<typeof BasicModule>;
    type UsersRouter = Tree["users"];
    type AuthSection = Tree["auth"];

    assertType<Procedure<any, any, any, any, any, any>>({} as UsersRouter["list"]);
    assertType<Procedure<any, any, any, any, any, any>>({} as UsersRouter["getById"]);
    assertType<Procedure<any, any, any, any, any, any>>({} as AuthSection["login"]);
  });

  test("module with imports resolves imported providers", () => {
    type Tree = InferOrpcRouterTree<typeof AppModule>;
    type UsersRouter = Tree["users"];
    type AuthSection = Tree["auth"];

    assertType<Procedure<any, any, any, any, any, any>>({} as UsersRouter["list"]);
    assertType<Procedure<any, any, any, any, any, any>>({} as UsersRouter["getById"]);
    assertType<Procedure<any, any, any, any, any, any>>({} as AuthSection["login"]);
  });

  test("only Procedure properties are included, non-procedure properties excluded", () => {
    type Tree = InferOrpcRouterTree<typeof BasicModule>;
    type UsersRouter = Tree["users"];

    type Keys = keyof UsersRouter;
    type HasUserService = "userService" extends Keys ? true : false;
    assertType<false>({} as HasUserService);
  });
});
