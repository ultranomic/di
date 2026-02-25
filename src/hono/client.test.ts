import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { createClientFromApp, createRpcClient, hc } from './client.js';

describe('hono/client', () => {
  describe('createClientFromApp', () => {
    it('should create a typed client from a Hono app', () => {
      const app = new Hono();

      app.get('/users', (c) => c.json({ users: [] }));
      app.post('/users', (c) => c.json({ created: true }, 201));

      const client = createClientFromApp(app, 'http://localhost:3000');

      expect(client).toBeDefined();
      expect(client.users).toBeDefined();
      expect(client.users.$get).toBeDefined();
      expect(client.users.$post).toBeDefined();
    });

    it('should create client with correct type inference', () => {
      const app = new Hono();

      app.get('/api/hello', (c) => c.json({ message: 'Hello' }));

      const client = createClientFromApp(app, 'http://localhost:3000');

      // Type test - if this compiles, types are working correctly
      type ClientType = ReturnType<typeof createClientFromApp<typeof app>>;
      const _typeCheck: ClientType = client;
      expect(_typeCheck).toBeDefined();
    });

    it('should create client that matches hc type', () => {
      const app = new Hono();

      app.get('/test', (c) => c.json({ test: true }));

      const client1 = createClientFromApp(app, 'http://localhost:3000');
      const client2 = hc<typeof app>('http://localhost:3000');

      // Both should have similar structure
      expect(client1.test).toBeDefined();
      expect(client2.test).toBeDefined();
    });

    it('should work with complex route definitions', () => {
      const app = new Hono();

      app.get('/users/:id/posts/:postId', (c) => {
        return c.json({ userId: c.req.param('id'), postId: c.req.param('postId') });
      });

      const client = createClientFromApp(app, 'http://localhost:3000');

      expect(client).toBeDefined();
      // The client should have typed routes for dynamic paths
      expect(client.users).toBeDefined();
    });
  });

  describe('createRpcClient', () => {
    it('should create a typed client from an adapter with getApp method', () => {
      const app = new Hono();
      app.get('/users', (c) => c.json({ users: [] }));

      // Create a mock adapter
      const adapter = {
        getApp: () => app,
      };

      const client = createRpcClient(adapter, 'http://localhost:3000');

      expect(client).toBeDefined();
      expect(client.users).toBeDefined();
      expect(client.users.$get).toBeDefined();
    });

    it('should infer types from adapter getApp return type', () => {
      const app = new Hono();
      app.get('/api/status', (c) => c.json({ status: 'ok' }));

      const adapter = {
        getApp: () => app,
      };

      const client = createRpcClient(adapter, 'http://localhost:3000');

      expect(client.api).toBeDefined();
      expect(client.api.status).toBeDefined();
    });
  });

  describe('hc re-export', () => {
    it('should export hc function', () => {
      expect(hc).toBeDefined();
      expect(typeof hc).toBe('function');
    });
  });
});
