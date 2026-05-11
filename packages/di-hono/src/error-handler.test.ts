import { describe, expect, it } from 'vite-plus/test';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { type DIErrorCode, DIError } from '@ultranomic/di';
import { errorHandler } from './error-handler.ts';

const createApp = () => {
  const app = new Hono();
  app.onError(errorHandler);
  return app;
};

// Must stay in sync with DIErrorCode in @ultranomic/di (libs/di/src/di-error.ts)
const ERROR_CODES: DIErrorCode[] = [
  'CIRCULAR_DEPENDENCY',
  'MISSING_PROVIDER',
  'DUPLICATE_PROVIDER',
  'EXPORT_NOT_IN_PROVIDERS',
  'SCOPE_VIOLATION',
  'NOT_IN_REQUEST_SCOPE',
  'CONTAINER_STOPPED',
  'CONTAINER_NOT_STARTED',
  'ALREADY_STARTED',
  'UNKNOWN_SCOPE',
  'DUPLICATE_INJECT_KEY',
];

describe('errorHandler', () => {
  describe('DIError', () => {
    it('returns 500 JSON with code and message for each DIErrorCode', async () => {
      for (const code of ERROR_CODES) {
        const app = createApp();
        app.get('/test', () => {
          throw new DIError(code, `${code} occurred`);
        });

        const res = await app.fetch(new Request('http://localhost/test'));
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body).toEqual({ error: { code, message: `${code} occurred` } });
      }
    });

    it('preserves original DIError message', async () => {
      const app = createApp();
      app.get('/test', () => {
        throw new DIError('MISSING_PROVIDER', 'Service "UserService" not found');
      });

      const res = await app.fetch(new Request('http://localhost/test'));
      const body = await res.json();
      expect(body).toEqual({
        error: { code: 'MISSING_PROVIDER', message: 'Service "UserService" not found' },
      });
    });

    it('returns Content-Type: application/json header for DIError', async () => {
      const app = createApp();
      app.get('/test', () => {
        throw new DIError('MISSING_PROVIDER', 'test');
      });

      const res = await app.fetch(new Request('http://localhost/test'));
      expect(res.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('HTTPException (Hono validation/HTTP errors)', () => {
    it('returns HTTPException response as-is', async () => {
      const app = createApp();
      const errorResponse = Response.json({ message: 'Bad Request' }, { status: 400 });
      app.get('/test', () => {
        throw new HTTPException(400, { res: errorResponse });
      });

      const res = await app.fetch(new Request('http://localhost/test'));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ message: 'Bad Request' });
    });

    it('returns default HTTPException response when no custom res', async () => {
      const app = createApp();
      app.get('/test', () => {
        throw new HTTPException(404, { message: 'Not Found' });
      });

      const res = await app.fetch(new Request('http://localhost/test'));
      expect(res.status).toBe(404);
    });

    it('returns 401 for HTTPException with Unauthorized status', async () => {
      const app = createApp();
      app.get('/test', () => {
        throw new HTTPException(401, { message: 'Unauthorized' });
      });

      const res = await app.fetch(new Request('http://localhost/test'));
      expect(res.status).toBe(401);
    });

    it('returns 500 for HTTPException with Internal Server Error status', async () => {
      const app = createApp();
      app.get('/test', () => {
        throw new HTTPException(500, { message: 'Internal Server Error' });
      });

      const res = await app.fetch(new Request('http://localhost/test'));
      expect(res.status).toBe(500);
    });

    it('returns default response for HTTPException with only status code', async () => {
      const app = createApp();
      app.get('/test', () => {
        throw new HTTPException(403);
      });

      const res = await app.fetch(new Request('http://localhost/test'));
      expect(res.status).toBe(403);
    });
  });

  describe('unknown errors', () => {
    it('re-throws plain Error', async () => {
      const app = createApp();
      app.get('/test', () => {
        throw new Error('boom');
      });

      try {
        await app.fetch(new Request('http://localhost/test'));
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toBe('boom');
      }
    });

    it('re-throws non-Error objects', async () => {
      const app = createApp();
      app.get('/test', () => {
        throw 'string error';
      });

      try {
        await app.fetch(new Request('http://localhost/test'));
        expect.unreachable();
      } catch (e) {
        expect(e).toBe('string error');
      }
    });
  });
});
