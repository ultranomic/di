// oxlint-disable max-classes-per-file, no-console
/**
 * validation.ts — Route validation with Zod schemas
 *
 * Demonstrates: json/query/param validation, valid & invalid requests
 * Zod v4 implements Standard Schema natively — pass schemas directly to validate.
 * Run: node libs/di-hono/examples/validation.ts
 */

import { Container, Injectable, Module, SCOPE } from '@ultranomic/di';
import { z } from 'zod';
import { Controller, HonoModule, HonoService } from '../src/index.ts';

// ---------------------------------------------------------------------------
// 1. Schemas
// ---------------------------------------------------------------------------
const CreateUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
});

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const IdParamSchema = z.object({
  id: z.string().uuid('Must be a valid UUID'),
});

// ---------------------------------------------------------------------------
// 2. Service
// ---------------------------------------------------------------------------
type User = { id: string; name: string; email: string };

class UserService extends Injectable({ scope: SCOPE.SINGLETON }) {
  #users = new Map<string, User>();

  public create(name: string, email: string): User {
    const id = crypto.randomUUID();
    const user: User = { id, name, email };
    this.#users.set(id, user);
    return user;
  }

  public getById(id: string): User | undefined {
    return this.#users.get(id);
  }
}

// ---------------------------------------------------------------------------
// 3. Controller with validation
// ---------------------------------------------------------------------------
class UserController extends Controller({
  path: '/users',
  inject: [['userService', UserService]],
}) {
  // POST /users — validated JSON body
  public create = this.route({
    method: 'POST',
    path: '/',
    validate: { json: CreateUserSchema },
    handler: (c) => {
      const body = c.req.valid('json');
      const user = this.inject.userService.create(body.name, body.email);
      return c.json({ user }, 201);
    },
  });

  // GET /users — validated query params
  public list = this.route({
    method: 'GET',
    path: '/',
    validate: { query: PaginationSchema },
    handler: (c) => {
      const query = c.req.valid('query');
      return c.json({ page: query.page, limit: query.limit });
    },
  });

  // GET /users/:id — validated path param
  public getById = this.route({
    method: 'GET',
    path: '/:id',
    validate: { param: IdParamSchema },
    handler: (c) => {
      const params = c.req.valid('param');
      const user = this.inject.userService.getById(params.id);
      if (!user) return c.json({ error: 'Not found' }, 404);
      return c.json({ user });
    },
  });
}

// ---------------------------------------------------------------------------
// 4. Module + run
// ---------------------------------------------------------------------------
class UserModule extends Module({
  providers: [UserService, UserController],
  exports: [UserController],
}) {}

class HttpModule extends HonoModule() {}

class AppModule extends Module({
  imports: [HttpModule, UserModule],
}) {}

const main = async (): Promise<void> => {
  const container = new Container(AppModule);
  await container.start();

  const app = container.resolve(HonoService).hono;

  // Valid POST
  console.log('--- Valid POST /users ---');
  const res1 = await app.fetch(
    new Request('http://localhost/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', email: 'alice@example.com' }),
    }),
  );
  console.log('Status:', res1.status, 'Body:', await res1.json());

  // Invalid POST (missing name)
  console.log('--- Invalid POST /users (missing name) ---');
  const res2 = await app.fetch(
    new Request('http://localhost/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-valid' }),
    }),
  );
  console.log('Status:', res2.status, 'Body:', await res2.json());

  // Valid GET with query
  console.log('--- Valid GET /users?page=2&limit=10 ---');
  const res3 = await app.fetch(new Request('http://localhost/users?page=2&limit=10'));
  console.log('Status:', res3.status, 'Body:', await res3.json());

  // Invalid GET with bad query
  console.log('--- Invalid GET /users?page=-1 ---');
  const res4 = await app.fetch(new Request('http://localhost/users?page=-1'));
  console.log('Status:', res4.status, 'Body:', await res4.json());

  // Invalid UUID param
  console.log('--- Invalid GET /users/not-a-uuid ---');
  const res5 = await app.fetch(new Request('http://localhost/users/not-a-uuid'));
  console.log('Status:', res5.status, 'Body:', await res5.json());

  await container.stop();
  console.log('[validation] Done.');
};

await main();
