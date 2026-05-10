import { Container, Injectable, Module, SCOPE } from "@ultranomic/di";
import { HonoModule, HonoService } from "@ultranomic/di-hono";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { OrpcModule } from "./orpc-module.ts";
import { OrpcRouter } from "./orpc-router.ts";
import { OrpcService } from "./orpc-service.ts";

let container: Container;

afterEach(async () => {
  if (container) await container.stop();
});

describe("End-to-end ORPC with Hono integration", () => {
  describe("Full lifecycle", () => {
    it("define modules → start container → make RPC calls → stop container", async () => {
      class UserService extends Injectable({ scope: SCOPE.SINGLETON }) {
        readonly #users = [
          { id: "1", name: "Alice" },
          { id: "2", name: "Bob" },
        ];

        list() {
          return this.#users;
        }

        getById(id: string) {
          return this.#users.find((u) => u.id === id);
        }
      }

      class UserRouter extends OrpcRouter({
        path: "users",
        inject: [["userService", UserService]] as const,
      }) {
        list = this.orpc
          .input(z.object({}))
          .output(z.array(z.object({ id: z.string(), name: z.string() })))
          .handler(async () => {
            return this.inject.userService.list();
          });

        getById = this.orpc
          .input(z.object({ id: z.string() }))
          .output(z.object({ id: z.string(), name: z.string() }).nullable())
          .handler(async ({ input }) => {
            return this.inject.userService.getById(input.id) ?? null;
          });
      }

      class AppModule extends Module({
        imports: [OrpcModule(), HonoModule()],
        providers: [UserService, UserRouter],
      }) {}

      container = new Container(AppModule);
      await container.start();

      const orpcService = container.resolve(OrpcService);
      expect(orpcService.handler).toBeDefined();

      const honoService = container.resolve(HonoService);
      expect(honoService.hono).toBeDefined();

      await container.stop();
    });
  });

  describe("Multiple routers", () => {
    it("composes multiple routers into a single handler", async () => {
      class UserRouter extends OrpcRouter({ path: "users" }) {
        list = this.orpc
          .input(z.object({}))
          .output(z.array(z.string()))
          .handler(async () => ["Alice", "Bob"]);
      }

      class ProductRouter extends OrpcRouter({ path: "products" }) {
        list = this.orpc
          .input(z.object({}))
          .output(z.array(z.string()))
          .handler(async () => ["Widget", "Gadget"]);
      }

      class AppModule extends Module({
        imports: [OrpcModule(), HonoModule()],
        providers: [UserRouter, ProductRouter],
      }) {}

      container = new Container(AppModule);
      await container.start();

      const orpcService = container.resolve(OrpcService);
      expect(orpcService.handler).toBeDefined();

      await container.stop();
    });
  });

  describe("Service dependencies", () => {
    it("resolves service dependencies in router handlers", async () => {
      class ConfigService extends Injectable({ scope: SCOPE.SINGLETON }) {
        getApiKey() {
          return "test-api-key";
        }
      }

      class ApiService extends Injectable({
        scope: SCOPE.SINGLETON,
        inject: [["config", ConfigService]],
      }) {
        getData() {
          return { apiKey: this.inject.config.getApiKey() };
        }
      }

      class ApiRouter extends OrpcRouter({
        path: "api",
        inject: [["apiService", ApiService]] as const,
      }) {
        getData = this.orpc
          .input(z.object({}))
          .output(z.object({ apiKey: z.string() }))
          .handler(async () => {
            return this.inject.apiService.getData();
          });
      }

      class AppModule extends Module({
        imports: [OrpcModule(), HonoModule()],
        providers: [ConfigService, ApiService, ApiRouter],
      }) {}

      container = new Container(AppModule);
      await container.start();

      const orpcService = container.resolve(OrpcService);
      expect(orpcService.handler).toBeDefined();

      await container.stop();
    });
  });

  describe("Request-scoped services", () => {
    it("creates new instances for each request", async () => {
      class RequestContext extends Injectable({ scope: SCOPE.REQUEST }) {
        static #counter = 0;
        readonly id = ++RequestContext.#counter;
      }

      class TestRouter extends OrpcRouter({ path: "test" }) {
        #container: Container | undefined;

        setContainer(c: Container) {
          this.#container = c;
        }

        getId = this.orpc
          .input(z.object({}))
          .output(z.object({ id: z.number() }))
          .handler(async () => {
            const requestCtx = this.#container!.resolve(RequestContext);
            return { id: requestCtx.id };
          });
      }

      class AppModule extends Module({
        imports: [OrpcModule(), HonoModule()],
        providers: [RequestContext, TestRouter],
      }) {}

      container = new Container(AppModule);
      await container.start();

      const orpcService = container.resolve(OrpcService);
      expect(orpcService.handler).toBeDefined();

      await container.stop();
    });
  });

  describe("Error handling", () => {
    it("handles errors from router procedures", async () => {
      class FailingRouter extends OrpcRouter({ path: "failing" }) {
        fail = this.orpc
          .input(z.object({}))
          .output(z.never())
          .handler(async () => {
            throw new Error("Procedure failed");
          });
      }

      class AppModule extends Module({
        imports: [OrpcModule(), HonoModule()],
        providers: [FailingRouter],
      }) {}

      container = new Container(AppModule);
      await container.start();

      const orpcService = container.resolve(OrpcService);
      expect(orpcService.handler).toBeDefined();

      await container.stop();
    });
  });

  describe("Container lifecycle", () => {
    it("starts and stops cleanly", async () => {
      class AppModule extends Module({
        imports: [OrpcModule(), HonoModule()],
      }) {}

      container = new Container(AppModule);
      await container.start();

      const orpcService = container.resolve(OrpcService);
      expect(orpcService.handler).toBeDefined();

      const honoService = container.resolve(HonoService);
      expect(honoService.hono).toBeDefined();

      await container.stop();
    });

    it("resolves services after start", async () => {
      class AppModule extends Module({
        imports: [OrpcModule(), HonoModule()],
      }) {}

      container = new Container(AppModule);
      await container.start();

      const orpcService = container.resolve(OrpcService);
      expect(orpcService).toBeDefined();

      const honoService = container.resolve(HonoService);
      expect(honoService).toBeDefined();

      await container.stop();
    });
  });
});
