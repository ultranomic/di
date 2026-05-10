// oxlint-disable max-classes-per-file, no-console
/**
 * basic-usage.ts — Minimal ORPC router with DI
 *
 * Demonstrates: OrpcRouter, OrpcModule, OrpcService, Container
 * Run: node libs/di-orpc/examples/basic-usage.ts
 */

import { Container, Injectable, Module, SCOPE } from "@ultranomic/di";
import { Controller, HonoModule } from "@ultranomic/di-hono";
import { z } from "zod";
import { OrpcModule, OrpcRouter, OrpcService } from "../src/index.ts";

// ---------------------------------------------------------------------------
// 1. Define a service
// ---------------------------------------------------------------------------
class UserService extends Injectable({ scope: SCOPE.SINGLETON }) {
  public list() {
    return [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ];
  }

  public getById(id: string) {
    return { id, name: "Alice" };
  }
}

class UserController extends Controller({
  path: "/users",
}) {
  public profile = this.route({
    method: "GET",
    path: "/profile",
    handler: (c) => {
      return c.json({ userId: 1 });
    },
  });
}

// ---------------------------------------------------------------------------
// 2. Define an ORPC router with procedures
// ---------------------------------------------------------------------------
class UserRouter extends OrpcRouter({
  path: "user",
  inject: [["user", UserService]],
}) {
  readonly #userService: UserService;

  public constructor(userService: UserService) {
    super();
    this.#userService = userService;
  }

  public list = this.orpc.input(z.object({})).handler(() => {
    return this.#userService.list();
  });

  public getById = this.orpc.input(z.object({ id: z.string() })).handler(({ input }) => {
    return this.#userService.getById(input.id);
  });
}

class UserModule extends Module({
  providers: [UserService, UserRouter, UserController],
  exports: [UserService],
}) {}

class AppModule extends Module({
  imports: [
    HonoModule({
      options: () => ({
        port: 3000,
      }),
    }),
    OrpcModule(),
    UserModule,
  ],
}) {}

// ---------------------------------------------------------------------------
// 4. Start and use
// ---------------------------------------------------------------------------
const main = async (): Promise<void> => {
  const container = new Container(AppModule);
  await container.start();

  const orpcService = container.resolve(OrpcService);
  // orpcService.handler is the StandardRPCHandler
  // Use it to handle ORPC requests
  console.log("ORPC handler ready");

  await container.stop();
};

await main().catch(console.error);
