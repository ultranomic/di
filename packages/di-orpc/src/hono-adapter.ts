import type { Container } from '@ultranomic/di';
import type { Context } from '@orpc/server';
import type { StandardRPCHandler } from '@orpc/server/standard';
import { OrpcRequestContext } from './orpc-request-context.ts';

const BODY_PARSER_METHODS = ['arrayBuffer', 'blob', 'formData', 'json', 'text'] as const;
type BodyParserMethod = (typeof BODY_PARSER_METHODS)[number];

type HonoServiceShape = {
  hono: {
    use: (
      path: string,
      middleware: (c: unknown, next: () => Promise<unknown>) => Promise<unknown>,
    ) => void;
  };
};

type HonoContextShape = {
  req: {
    raw: Request;
    json: () => Promise<unknown>;
    arrayBuffer: () => Promise<ArrayBuffer>;
    blob: () => Promise<Blob>;
    formData: () => Promise<FormData>;
    text: () => Promise<string>;
  };
  res: Response;
  newResponse: (
    data: string | ArrayBuffer | ReadableStream | Uint8Array | null,
    init: Response | ResponseInit,
  ) => Response;
};

export function mountOrpcOnHono(
  container: Container,
  handler: StandardRPCHandler<Context>,
  prefix: string,
): void {
  const HonoServiceClass = container.sorted.find(
    (cls) => '_isHonoService' in cls && cls._isHonoService === true,
  );

  if (!HonoServiceClass) return;

  const honoService = container.resolve(HonoServiceClass) as HonoServiceShape;
  const app = honoService.hono;

  app.use(prefix + '/*', async (c: unknown, next: () => Promise<unknown>) => {
    const honoContext = c as HonoContextShape;

    const request = new Proxy(honoContext.req.raw, {
      get(target, prop) {
        if (typeof prop !== 'string') return Reflect.get(target, prop, target);
        if (BODY_PARSER_METHODS.includes(prop as BodyParserMethod)) {
          return () => honoContext.req[prop as BodyParserMethod]();
        }
        return Reflect.get(target, prop, target);
      },
    }) as Request;

    const lazyRequest = {
      method: request.method,
      get url() {
        return new URL(request.url);
      },
      headers: Object.fromEntries(request.headers.entries()) as Record<string, string>,
      body: async () => {
        const contentType = request.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return honoContext.req.json();
        }
        if (contentType?.includes('application/x-www-form-urlencoded')) {
          return honoContext.req.formData();
        }
        if (contentType?.includes('multipart/form-data')) {
          return honoContext.req.formData();
        }
        if (contentType?.includes('text/')) {
          return honoContext.req.text();
        }
        return honoContext.req.arrayBuffer();
      },
      signal: request.signal,
    };

    const result = await container.withRequestScope(async () =>
      OrpcRequestContext.run({ req: request, res: honoContext.res, honoContext: c }, () =>
        handler.handle(lazyRequest, {
          prefix: prefix as `/${string}`,
          context: { req: request, res: honoContext.res, honoContext: c },
        }),
      ),
    );

    if (result.matched) {
      const { status, headers, body } = result.response;
      const responseBody = standardBodyToBodyInit(body);
      return honoContext.newResponse(responseBody, {
        status,
        headers: headers as Record<string, string>,
      });
    }

    return next();
  });
}

function standardBodyToBodyInit(body: unknown): ReadableStream | string | null {
  if (body === undefined || body === null) {
    return null;
  }
  if (typeof body === 'string') {
    return body;
  }
  if (body instanceof ReadableStream) {
    return body;
  }
  if (body instanceof Blob || body instanceof FormData || body instanceof URLSearchParams) {
    return new Response(body).body;
  }
  return JSON.stringify(body);
}
