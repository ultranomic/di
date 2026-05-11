import { describe, expect, it, vi } from 'vite-plus/test';
import { mountOrpcOnHono } from './hono-adapter.ts';

function setup(options?: {
  sorted?: Function[];
  handlerResult?: {
    matched: boolean;
    response?: { status: number; headers: Headers; body: unknown };
  };
  prefix?: string;
}) {
  let capturedMiddleware:
    | ((c: unknown, next: () => Promise<unknown>) => Promise<unknown>)
    | undefined;

  const honoUse = vi.fn(
    (_path: string, mw: (c: unknown, next: () => Promise<unknown>) => Promise<unknown>) => {
      capturedMiddleware = mw;
    },
  );

  const honoService = { hono: { use: honoUse } };

  class MockHonoService {
    static _isHonoService = true as const;
  }

  const sorted = options?.sorted ?? [MockHonoService];

  const container = {
    sorted,
    resolve: vi.fn(() => honoService),
    withRequestScope: vi.fn((fn: () => Promise<unknown>) => fn()),
  };

  const handlerResult = options?.handlerResult ?? {
    matched: true as const,
    response: { status: 200, headers: new Headers(), body: null },
  };

  const handler = {
    handle: vi.fn((_lazyReq?: unknown, _opts?: unknown) => Promise.resolve(handlerResult)),
  };

  const prefix = options?.prefix ?? '/rpc';

  mountOrpcOnHono(container as any, handler as any, prefix);

  return {
    container,
    handler,
    honoUse,
    getMiddleware: () => capturedMiddleware!,
    MockHonoService,
    honoService,
  };
}

function createMockContext(options?: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
  arrayBuffer?: () => Promise<ArrayBuffer>;
  blob?: () => Promise<Blob>;
  formData?: () => Promise<FormData>;
}) {
  const headers = new Headers(options?.headers ?? {});
  const rawRequest = new Request(options?.url ?? 'http://localhost/rpc/test', {
    method: options?.method ?? 'POST',
    headers,
  });

  const newResponse = vi.fn((data: any, init: any) => new Response(data, init));

  return {
    req: {
      raw: rawRequest,
      json: options?.json ?? vi.fn(() => Promise.resolve({})),
      text: options?.text ?? vi.fn(() => Promise.resolve('')),
      arrayBuffer: options?.arrayBuffer ?? vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
      blob: options?.blob ?? vi.fn(() => Promise.resolve(new Blob())),
      formData: options?.formData ?? vi.fn(() => Promise.resolve(new FormData())),
    },
    res: new Response(),
    newResponse,
  };
}

describe('mountOrpcOnHono', () => {
  describe('mounting behavior', () => {
    it('mounts middleware on Hono app when HonoServiceClass found', () => {
      const { honoUse } = setup();
      expect(honoUse).toHaveBeenCalledOnce();
      expect(honoUse).toHaveBeenCalledWith('/rpc/*', expect.any(Function));
    });

    it('uses provided prefix', () => {
      const { honoUse } = setup({ prefix: '/api/orpc' });
      expect(honoUse).toHaveBeenCalledWith('/api/orpc/*', expect.any(Function));
    });

    it('does NOT mount when no HonoServiceClass in container.sorted', () => {
      const { honoUse } = setup({ sorted: [] });
      expect(honoUse).not.toHaveBeenCalled();
    });

    it('does NOT mount when class has _isHonoService = false', () => {
      class FakeService {
        static _isHonoService = false as const;
      }
      const { honoUse } = setup({ sorted: [FakeService] });
      expect(honoUse).not.toHaveBeenCalled();
    });

    it('does NOT mount when class lacks _isHonoService property', () => {
      class PlainService {}
      const { honoUse } = setup({ sorted: [PlainService] });
      expect(honoUse).not.toHaveBeenCalled();
    });
  });

  describe('_isHonoService marker lookup', () => {
    it('finds class with _isHonoService = true', () => {
      const { container, honoUse } = setup();
      expect(container.resolve).toHaveBeenCalledOnce();
      expect(honoUse).toHaveBeenCalled();
    });

    it('skips class with _isHonoService = false', () => {
      class MarkedFalse {
        static _isHonoService = false as const;
      }
      const { honoUse } = setup({ sorted: [MarkedFalse] });
      expect(honoUse).not.toHaveBeenCalled();
    });

    it('skips class without _isHonoService property', () => {
      class NoMarker {}
      const { honoUse } = setup({ sorted: [NoMarker] });
      expect(honoUse).not.toHaveBeenCalled();
    });

    it('resolves the correct class among multiple candidates', () => {
      class ServiceA {
        static _isHonoService = false as const;
      }
      class ServiceB {
        static _isHonoService = true as const;
      }
      class ServiceC {}

      const { container } = setup({ sorted: [ServiceA, ServiceB, ServiceC] });
      expect(container.resolve).toHaveBeenCalledWith(ServiceB);
    });
  });

  describe('matched request — response with status and headers', () => {
    it('returns newResponse with correct status and headers', async () => {
      const responseHeaders = new Headers({ 'content-type': 'application/json' });
      const { getMiddleware } = setup({
        handlerResult: {
          matched: true,
          response: { status: 201, headers: responseHeaders, body: null },
        },
      });

      const ctx = createMockContext();
      await getMiddleware()(ctx, () => Promise.resolve('next'));

      expect(ctx.newResponse).toHaveBeenCalledWith(null, {
        status: 201,
        headers: responseHeaders,
      });
    });
  });

  describe('unmatched request — falls through', () => {
    it('calls next() when handler returns matched: false', async () => {
      const nextFn = vi.fn(() => Promise.resolve('fell-through'));
      const { getMiddleware } = setup({
        handlerResult: { matched: false },
      });

      const ctx = createMockContext();
      const result = await getMiddleware()(ctx, nextFn);

      expect(nextFn).toHaveBeenCalledOnce();
      expect(result).toBe('fell-through');
    });

    it('does NOT call newResponse when unmatched', async () => {
      const { getMiddleware } = setup({
        handlerResult: { matched: false },
      });

      const ctx = createMockContext();
      await getMiddleware()(ctx, () => Promise.resolve(null));

      expect(ctx.newResponse).not.toHaveBeenCalled();
    });
  });

  describe('standardBodyToBodyInit (via response body)', () => {
    it('null body → null responseBody', async () => {
      const { getMiddleware } = setup({
        handlerResult: {
          matched: true,
          response: { status: 200, headers: new Headers(), body: null },
        },
      });

      const ctx = createMockContext();
      await getMiddleware()(ctx, () => Promise.resolve(null));

      expect(ctx.newResponse).toHaveBeenCalledWith(null, expect.any(Object));
    });

    it('undefined body → null responseBody', async () => {
      const { getMiddleware } = setup({
        handlerResult: {
          matched: true,
          response: { status: 200, headers: new Headers(), body: undefined },
        },
      });

      const ctx = createMockContext();
      await getMiddleware()(ctx, () => Promise.resolve(null));

      expect(ctx.newResponse).toHaveBeenCalledWith(null, expect.any(Object));
    });

    it('string body → string responseBody', async () => {
      const { getMiddleware } = setup({
        handlerResult: {
          matched: true,
          response: { status: 200, headers: new Headers(), body: 'hello world' },
        },
      });

      const ctx = createMockContext();
      await getMiddleware()(ctx, () => Promise.resolve(null));

      expect(ctx.newResponse).toHaveBeenCalledWith('hello world', expect.any(Object));
    });

    it('ReadableStream body → same stream responseBody', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('stream data'));
          controller.close();
        },
      });

      const { getMiddleware } = setup({
        handlerResult: {
          matched: true,
          response: { status: 200, headers: new Headers(), body: stream },
        },
      });

      const ctx = createMockContext();
      await getMiddleware()(ctx, () => Promise.resolve(null));

      const [responseBody] = ctx.newResponse.mock.calls[0];
      expect(responseBody).toBe(stream);
    });

    it('Blob body → converted to ReadableStream via new Response(blob).body', async () => {
      const blob = new Blob(['blob content'], { type: 'text/plain' });

      const { getMiddleware } = setup({
        handlerResult: {
          matched: true,
          response: { status: 200, headers: new Headers(), body: blob },
        },
      });

      const ctx = createMockContext();
      await getMiddleware()(ctx, () => Promise.resolve(null));

      const [responseBody] = ctx.newResponse.mock.calls[0];
      expect(responseBody).toBeInstanceOf(ReadableStream);
    });

    it('FormData body → converted to ReadableStream via new Response(formData).body', async () => {
      const formData = new FormData();
      formData.append('key', 'value');

      const { getMiddleware } = setup({
        handlerResult: {
          matched: true,
          response: { status: 200, headers: new Headers(), body: formData },
        },
      });

      const ctx = createMockContext();
      await getMiddleware()(ctx, () => Promise.resolve(null));

      const [responseBody] = ctx.newResponse.mock.calls[0];
      expect(responseBody).toBeInstanceOf(ReadableStream);
    });

    it('URLSearchParams body → converted to ReadableStream via new Response(params).body', async () => {
      const params = new URLSearchParams({ foo: 'bar' });

      const { getMiddleware } = setup({
        handlerResult: {
          matched: true,
          response: { status: 200, headers: new Headers(), body: params },
        },
      });

      const ctx = createMockContext();
      await getMiddleware()(ctx, () => Promise.resolve(null));

      const [responseBody] = ctx.newResponse.mock.calls[0];
      expect(responseBody).toBeInstanceOf(ReadableStream);
    });

    it('arbitrary object → JSON.stringify', async () => {
      const obj = { a: 1, b: 'test' };

      const { getMiddleware } = setup({
        handlerResult: {
          matched: true,
          response: { status: 200, headers: new Headers(), body: obj },
        },
      });

      const ctx = createMockContext();
      await getMiddleware()(ctx, () => Promise.resolve(null));

      expect(ctx.newResponse).toHaveBeenCalledWith(JSON.stringify(obj), expect.any(Object));
    });
  });

  describe('proxy body delegation', () => {
    function captureProxiedReq() {
      let req: any;
      const result = setup();
      result.handler.handle.mockImplementation(async (_l: any, opts: any) => {
        req = opts.context.req;
        return { matched: true, response: { status: 200, headers: new Headers(), body: null } };
      });
      return { ...result, getReq: () => req };
    }

    it('delegates json() to honoContext.req.json()', async () => {
      const jsonFn = vi.fn(() => Promise.resolve({ data: 1 }));
      const { getMiddleware, getReq } = captureProxiedReq();

      const ctx = createMockContext({ json: jsonFn });
      await getMiddleware()(ctx, () => Promise.resolve(null));
      await getReq().json();
      expect(jsonFn).toHaveBeenCalledOnce();
    });

    it('delegates text() to honoContext.req.text()', async () => {
      const textFn = vi.fn(() => Promise.resolve('text body'));
      let req: any;
      const { getMiddleware, handler } = setup();
      handler.handle.mockImplementation(async (_l: any, opts: any) => {
        req = opts.context.req;
        return { matched: true, response: { status: 200, headers: new Headers(), body: null } };
      });

      const ctx = createMockContext({ text: textFn });
      await getMiddleware()(ctx, () => Promise.resolve(null));
      await req.text();
      expect(textFn).toHaveBeenCalledOnce();
    });

    it('delegates arrayBuffer() to honoContext.req.arrayBuffer()', async () => {
      const abFn = vi.fn(() => Promise.resolve(new ArrayBuffer(8)));
      let req: any;
      const { getMiddleware, handler } = setup();
      handler.handle.mockImplementation(async (_l: any, opts: any) => {
        req = opts.context.req;
        return { matched: true, response: { status: 200, headers: new Headers(), body: null } };
      });

      const ctx = createMockContext({ arrayBuffer: abFn });
      await getMiddleware()(ctx, () => Promise.resolve(null));
      await req.arrayBuffer();
      expect(abFn).toHaveBeenCalledOnce();
    });

    it('delegates blob() to honoContext.req.blob()', async () => {
      const blobFn = vi.fn(() => Promise.resolve(new Blob(['blob'])));
      let req: any;
      const { getMiddleware, handler } = setup();
      handler.handle.mockImplementation(async (_l: any, opts: any) => {
        req = opts.context.req;
        return { matched: true, response: { status: 200, headers: new Headers(), body: null } };
      });

      const ctx = createMockContext({ blob: blobFn });
      await getMiddleware()(ctx, () => Promise.resolve(null));
      await req.blob();
      expect(blobFn).toHaveBeenCalledOnce();
    });

    it('delegates formData() to honoContext.req.formData()', async () => {
      const fdFn = vi.fn(() => Promise.resolve(new FormData()));
      let req: any;
      const { getMiddleware, handler } = setup();
      handler.handle.mockImplementation(async (_l: any, opts: any) => {
        req = opts.context.req;
        return { matched: true, response: { status: 200, headers: new Headers(), body: null } };
      });

      const ctx = createMockContext({ formData: fdFn });
      await getMiddleware()(ctx, () => Promise.resolve(null));
      await req.formData();
      expect(fdFn).toHaveBeenCalledOnce();
    });

    it('non-body properties pass through to raw request', async () => {
      let req: any;
      const { getMiddleware, handler } = setup();
      handler.handle.mockImplementation(async (_l: any, opts: any) => {
        req = opts.context.req;
        return { matched: true, response: { status: 200, headers: new Headers(), body: null } };
      });

      const ctx = createMockContext({ method: 'POST', url: 'http://localhost/rpc/test' });
      await getMiddleware()(ctx, () => Promise.resolve(null));

      expect(req.method).toBe('POST');
      expect(req.url).toBe('http://localhost/rpc/test');
    });
  });

  describe('content-type body routing in lazyRequest.body()', () => {
    it('application/json → honoContext.req.json()', async () => {
      const jsonFn = vi.fn(() => Promise.resolve({ data: 1 }));
      let lazyReq: any;
      const { getMiddleware, handler } = setup();
      handler.handle.mockImplementation(async (lr: any) => {
        lazyReq = lr;
        return { matched: true, response: { status: 200, headers: new Headers(), body: null } };
      });

      const ctx = createMockContext({
        headers: { 'content-type': 'application/json' },
        json: jsonFn,
      });
      await getMiddleware()(ctx, () => Promise.resolve(null));

      await lazyReq.body();
      expect(jsonFn).toHaveBeenCalledOnce();
    });

    it('application/x-www-form-urlencoded → honoContext.req.formData()', async () => {
      const fdFn = vi.fn(() => Promise.resolve(new FormData()));
      let lazyReq: any;
      const { getMiddleware, handler } = setup();
      handler.handle.mockImplementation(async (lr: any) => {
        lazyReq = lr;
        return { matched: true, response: { status: 200, headers: new Headers(), body: null } };
      });

      const ctx = createMockContext({
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        formData: fdFn,
      });
      await getMiddleware()(ctx, () => Promise.resolve(null));

      await lazyReq.body();
      expect(fdFn).toHaveBeenCalledOnce();
    });

    it('multipart/form-data → honoContext.req.formData()', async () => {
      const fdFn = vi.fn(() => Promise.resolve(new FormData()));
      let lazyReq: any;
      const { getMiddleware, handler } = setup();
      handler.handle.mockImplementation(async (lr: any) => {
        lazyReq = lr;
        return { matched: true, response: { status: 200, headers: new Headers(), body: null } };
      });

      const ctx = createMockContext({
        headers: { 'content-type': 'multipart/form-data' },
        formData: fdFn,
      });
      await getMiddleware()(ctx, () => Promise.resolve(null));

      await lazyReq.body();
      expect(fdFn).toHaveBeenCalledOnce();
    });

    it('text/plain → honoContext.req.text()', async () => {
      const textFn = vi.fn(() => Promise.resolve('text body'));
      let lazyReq: any;
      const { getMiddleware, handler } = setup();
      handler.handle.mockImplementation(async (lr: any) => {
        lazyReq = lr;
        return { matched: true, response: { status: 200, headers: new Headers(), body: null } };
      });

      const ctx = createMockContext({
        headers: { 'content-type': 'text/plain' },
        text: textFn,
      });
      await getMiddleware()(ctx, () => Promise.resolve(null));

      await lazyReq.body();
      expect(textFn).toHaveBeenCalledOnce();
    });

    it('text/html → honoContext.req.text()', async () => {
      const textFn = vi.fn(() => Promise.resolve('<h1>hi</h1>'));
      let lazyReq: any;
      const { getMiddleware, handler } = setup();
      handler.handle.mockImplementation(async (lr: any) => {
        lazyReq = lr;
        return { matched: true, response: { status: 200, headers: new Headers(), body: null } };
      });

      const ctx = createMockContext({
        headers: { 'content-type': 'text/html' },
        text: textFn,
      });
      await getMiddleware()(ctx, () => Promise.resolve(null));

      await lazyReq.body();
      expect(textFn).toHaveBeenCalledOnce();
    });

    it('no content-type → honoContext.req.arrayBuffer()', async () => {
      const abFn = vi.fn(() => Promise.resolve(new ArrayBuffer(0)));
      let lazyReq: any;
      const { getMiddleware, handler } = setup();
      handler.handle.mockImplementation(async (lr: any) => {
        lazyReq = lr;
        return { matched: true, response: { status: 200, headers: new Headers(), body: null } };
      });

      const ctx = createMockContext({ headers: {}, arrayBuffer: abFn });
      await getMiddleware()(ctx, () => Promise.resolve(null));

      await lazyReq.body();
      expect(abFn).toHaveBeenCalledOnce();
    });

    it('application/octet-stream → honoContext.req.arrayBuffer()', async () => {
      const abFn = vi.fn(() => Promise.resolve(new ArrayBuffer(0)));
      let lazyReq: any;
      const { getMiddleware, handler } = setup();
      handler.handle.mockImplementation(async (lr: any) => {
        lazyReq = lr;
        return { matched: true, response: { status: 200, headers: new Headers(), body: null } };
      });

      const ctx = createMockContext({
        headers: { 'content-type': 'application/octet-stream' },
        arrayBuffer: abFn,
      });
      await getMiddleware()(ctx, () => Promise.resolve(null));

      await lazyReq.body();
      expect(abFn).toHaveBeenCalledOnce();
    });
  });

  describe('lazyRequest properties', () => {
    it('method matches request method', async () => {
      let lazyReq: any;
      const { getMiddleware, handler } = setup();
      handler.handle.mockImplementation(async (lr: any) => {
        lazyReq = lr;
        return { matched: true, response: { status: 200, headers: new Headers(), body: null } };
      });

      const ctx = createMockContext({ method: 'PUT' });
      await getMiddleware()(ctx, () => Promise.resolve(null));

      expect(lazyReq.method).toBe('PUT');
    });

    it('url returns URL object from request url', async () => {
      let lazyReq: any;
      const { getMiddleware, handler } = setup();
      handler.handle.mockImplementation(async (lr: any) => {
        lazyReq = lr;
        return { matched: true, response: { status: 200, headers: new Headers(), body: null } };
      });

      const ctx = createMockContext({ url: 'http://localhost/rpc/test/path' });
      await getMiddleware()(ctx, () => Promise.resolve(null));

      expect(lazyReq.url).toBeInstanceOf(URL);
      expect(lazyReq.url.pathname).toBe('/rpc/test/path');
    });

    it('headers contains request headers as Record<string, string>', async () => {
      let lazyReq: any;
      const { getMiddleware, handler } = setup();
      handler.handle.mockImplementation(async (lr: any) => {
        lazyReq = lr;
        return { matched: true, response: { status: 200, headers: new Headers(), body: null } };
      });

      const ctx = createMockContext({
        headers: { 'content-type': 'application/json', 'x-custom': 'value' },
      });
      await getMiddleware()(ctx, () => Promise.resolve(null));

      expect(lazyReq.headers['content-type']).toBe('application/json');
      expect(lazyReq.headers['x-custom']).toBe('value');
    });

    it('signal matches request signal', async () => {
      let lazyReq: any;
      const { getMiddleware, handler } = setup();
      handler.handle.mockImplementation(async (lr: any) => {
        lazyReq = lr;
        return { matched: true, response: { status: 200, headers: new Headers(), body: null } };
      });

      const ctx = createMockContext();
      await getMiddleware()(ctx, () => Promise.resolve(null));

      expect(lazyReq.signal).toBe(ctx.req.raw.signal);
    });
  });

  describe('container.withRequestScope and context', () => {
    it('calls container.withRequestScope', async () => {
      const { getMiddleware, container } = setup();

      const ctx = createMockContext();
      await getMiddleware()(ctx, () => Promise.resolve(null));

      expect(container.withRequestScope).toHaveBeenCalledOnce();
    });

    it('handler.handle receives prefix', async () => {
      const { getMiddleware, handler } = setup({ prefix: '/api/orpc' });

      const ctx = createMockContext();
      await getMiddleware()(ctx, () => Promise.resolve(null));

      expect(handler.handle).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ prefix: '/api/orpc' }),
      );
    });

    it('handler.handle receives context with req, res, honoContext', async () => {
      const { getMiddleware, handler } = setup();

      const ctx = createMockContext();
      await getMiddleware()(ctx, () => Promise.resolve(null));

      const context = (
        handler.handle.mock.calls[0] as [unknown, { context: Record<string, unknown> }]
      )[1].context;
      expect(context).toHaveProperty('req');
      expect(context).toHaveProperty('res');
      expect(context).toHaveProperty('honoContext');
      expect((context as Record<string, unknown>).honoContext).toBe(ctx);
    });
  });
});
