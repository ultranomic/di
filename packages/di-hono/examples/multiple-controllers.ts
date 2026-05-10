// oxlint-disable max-classes-per-file, no-console
/**
 * multiple-controllers.ts — Multiple controllers registered via HonoModule
 *
 * Demonstrates: Two controllers at different paths, shared service, HonoModule wiring
 * Run: node libs/di-hono/examples/multiple-controllers.ts
 */

import { Container, Injectable, Module, SCOPE } from "@ultranomic/di";
import { Controller, HonoModule, HonoService } from "../src/index.ts";

// ---------------------------------------------------------------------------
// 1. Shared service
// ---------------------------------------------------------------------------
class AuthService extends Injectable({ scope: SCOPE.SINGLETON }) {
  #tokens = new Map<string, { userId: string; role: string }>();

  public constructor() {
    super();
    this.#tokens.set("tok-admin", { userId: "u1", role: "admin" });
    this.#tokens.set("tok-user", { userId: "u2", role: "user" });
  }

  public validate(token: string): { userId: string; role: string } | null {
    return this.#tokens.get(token) ?? null;
  }
}

// ---------------------------------------------------------------------------
// 2. UserController at /users
// ---------------------------------------------------------------------------
class UserController extends Controller({
  path: "/users",
  inject: [["auth", AuthService]],
}) {
  public profile = this.route({
    method: "GET",
    path: "/profile",
    handler: (c) => {
      const token = c.req.header("authorization")?.replace("Bearer ", "") ?? "";
      const user = this.inject.auth.validate(token);
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      return c.json({ userId: user.userId, role: user.role });
    },
  });
}

// ---------------------------------------------------------------------------
// 3. AuthController at /auth
// ---------------------------------------------------------------------------
class AuthController extends Controller({
  path: "/auth",
  inject: [["auth", AuthService]],
}) {
  public check = this.route({
    method: "GET",
    path: "/check",
    handler: (c) => {
      const token = c.req.query("token") ?? "";
      const result = this.inject.auth.validate(token);
      if (!result) return c.json({ valid: false }, 401);
      return c.json({ valid: true, ...result });
    },
  });
}

// ---------------------------------------------------------------------------
// 4. Module wiring both controllers
// ---------------------------------------------------------------------------
class AuthModule extends Module({
  providers: [AuthService, UserController, AuthController],
  exports: [UserController, AuthController],
}) {}

class HttpModule extends HonoModule() {}

class AppModule extends Module({
  imports: [HttpModule, AuthModule],
}) {}

const main = async (): Promise<void> => {
  const container = new Container(AppModule);
  await container.start();

  const app = container.resolve(HonoService).hono;

  // UserController: GET /users/profile with valid token
  console.log("--- GET /users/profile (valid token) ---");
  const res1 = await app.fetch(
    new Request("http://localhost/users/profile", {
      headers: { authorization: "Bearer tok-admin" },
    }),
  );
  console.log("Status:", res1.status, "Body:", await res1.json());

  // UserController: GET /users/profile with invalid token
  console.log("--- GET /users/profile (invalid token) ---");
  const res2 = await app.fetch(
    new Request("http://localhost/users/profile", {
      headers: { authorization: "Bearer bad-token" },
    }),
  );
  console.log("Status:", res2.status, "Body:", await res2.json());

  // AuthController: GET /auth/check
  console.log("--- GET /auth/check?token=tok-user ---");
  const res3 = await app.fetch(new Request("http://localhost/auth/check?token=tok-user"));
  console.log("Status:", res3.status, "Body:", await res3.json());

  await container.stop();
  console.log("[multiple-controllers] Done.");
};

await main();
