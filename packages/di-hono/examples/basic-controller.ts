// oxlint-disable max-classes-per-file, no-console
/**
 * basic-controller.ts — Controller with GET/POST routes, constructor DI
 *
 * Demonstrates: Injectable service, Controller, HonoModule, HonoService, app.fetch()
 * Run: node libs/di-hono/examples/basic-controller.ts
 */

import { Container, Injectable, Module, SCOPE } from '@ultranomic/di';
import { Controller, HonoModule, HonoService } from '../src/index.ts';

// ---------------------------------------------------------------------------
// 1. Define a service (Singleton, no deps)
// ---------------------------------------------------------------------------
type User = { id: number; name: string; email: string };

class UserService extends Injectable({ scope: SCOPE.SINGLETON }) {
  #users: User[] = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
  ];
  #nextId = 3;

  public list(): readonly User[] {
    return this.#users;
  }

  public create(name: string, email: string): User {
    const user: User = { id: this.#nextId++, name, email };
    this.#users.push(user);
    return user;
  }
}

// ---------------------------------------------------------------------------
// 2. Define a controller with constructor DI
// ---------------------------------------------------------------------------
class UserController extends Controller({
  path: '/users',
  inject: [['userService', UserService]],
}) {
  // GET /users — list all users
  public list = this.route({
    method: 'GET',
    path: '/',
    handler: (c) => {
      const users = this.inject.userService.list();
      return c.json({ users });
    },
  });

  // POST /users — create a user
  public create = this.route({
    method: 'POST',
    path: '/',
    handler: async (c) => {
      const body = await c.req.json<{ name: string; email: string }>();
      const user = this.inject.userService.create(body.name, body.email);
      return c.json({ user }, 201);
    },
  });
}

class UserModule extends Module({
  providers: [UserService, UserController],
  exports: [UserController],
}) {}

class HttpModule extends HonoModule({ options: () => ({ port: 0, host: '0.0.0.0' }) }) {}

// ---------------------------------------------------------------------------
// 3. Compose modules at the root
// ---------------------------------------------------------------------------
class AppModule extends Module({
  imports: [HttpModule, UserModule],
}) {}

// ---------------------------------------------------------------------------
// 4. Start container, test routes via app.fetch()
// ---------------------------------------------------------------------------
const main = async (): Promise<void> => {
  const container = new Container(AppModule);
  await container.start();

  const honoService = container.resolve(HonoService);
  const app = honoService.hono;

  // GET /users
  const listRes = await app.fetch(new Request('http://localhost/users'));
  const listBody = await listRes.json();
  console.log('GET /users →', listBody);

  // POST /users
  const createRes = await app.fetch(
    new Request('http://localhost/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Charlie', email: 'charlie@example.com' }),
    }),
  );
  const createBody = await createRes.json();
  console.log('POST /users →', createBody);

  // GET /users again (should include new user)
  const listRes2 = await app.fetch(new Request('http://localhost/users'));
  const listBody2 = await listRes2.json();
  console.log('GET /users (after create) →', listBody2);

  await container.stop();
  console.log('[basic-controller] Done.');
};

await main();
