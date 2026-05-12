import {
  type Container,
  type InjectableClass,
  type ModuleClass,
  Injectable,
  SCOPE,
} from '@ultranomic/di';
import { type Context, type MiddlewareHandler, Hono } from 'hono';
import type { Server as HttpServer } from 'node:http';
import type { Http2Server, Http2SecureServer } from 'node:http2';
import type { Server as HttpsServer } from 'node:https';
import { validator } from 'hono/validator';
import { errorHandler } from './error-handler.ts';
import {
  type ControllerClass,
  type HonoModuleClass,
  type HonoModuleOptions,
  type RequestContextClass,
  type RouteDefinition,
  type StandardSchema,
  VALIDATE_TARGETS,
} from './types.ts';

export const VALIDATION_ERROR_MESSAGE = 'Validation failed' as const;

type ValidateTarget = (typeof VALIDATE_TARGETS)[number];

const isControllerClass = (cls: InjectableClass): cls is ControllerClass =>
  '_path' in cls && typeof cls._path === 'string';

const isRouteDefinition = (value: unknown): value is RouteDefinition =>
  typeof value === 'object' && value !== null && '_isRoute' in value && value._isRoute === true;

const isHonoModuleClass = (moduleClass: ModuleClass): moduleClass is HonoModuleClass =>
  '_isHonoModule' in moduleClass && moduleClass._isHonoModule === true;

const isRequestContextClass = (cls: InjectableClass): cls is RequestContextClass =>
  '_isRequestContext' in cls && cls._isRequestContext === true;

const isNode = (): boolean =>
  typeof process !== 'undefined' && !process?.versions?.bun && !!process?.versions?.node;

const getRouteProperties = (instance: object): RouteDefinition[] => {
  const routes: RouteDefinition[] = [];
  for (const key of Object.keys(instance)) {
    const value = (instance as Record<string, unknown>)[key];
    if (isRouteDefinition(value)) {
      routes.push(value);
    }
  }
  return routes;
};

const createValidationMiddleware = (
  target: ValidateTarget,
  schema: StandardSchema,
): MiddlewareHandler => {
  return validator(target, async (value, c) => {
    const result = await schema['~standard'].validate(value);
    if (result.issues) {
      return c.json({ error: VALIDATION_ERROR_MESSAGE, issues: result.issues }, 400);
    }
    return result.value;
  });
};

type NodeServer = HttpServer | Http2Server | Http2SecureServer | HttpsServer;

const HonoServiceBase: InjectableClass<object, readonly [], typeof SCOPE.SINGLETON> = Injectable({
  scope: SCOPE.SINGLETON,
});

export class HonoService extends HonoServiceBase {
  public static readonly _isHonoService = true as const;
  #app = new Hono();
  #port: number | undefined;
  #host: string | undefined;
  #serverOptions: HonoModuleOptions['server'] | undefined;
  #server: NodeServer | undefined;

  public get hono(): Hono {
    return this.#app;
  }

  public get port(): number | undefined {
    return this.#port;
  }

  public get host(): string | undefined {
    return this.#host;
  }

  public onReady = (container: Container): void => {
    this.#registerRoutes(container);
  };

  public onStart = async (container: Container): Promise<void> => {
    await this.#startServer(container);
  };

  public beforeApplicationShutdown = async (container: Container): Promise<void> => {
    if (this.#server) {
      container.logger.info('Hono server shutting down');
    }
    const server = this.#server;
    if (!server) return;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    this.#server = undefined;
  };

  public onStop = (_: Container): void => {
    this.#server = undefined;
    this.#serverOptions = undefined;
    this.#port = undefined;
    this.#host = undefined;
    this.#app = new Hono();
  };

  async #startServer(container: Container): Promise<void> {
    if (!isNode() || this.#port === undefined) return;

    const { serve } = await import('@hono/node-server');
    const opts: Parameters<typeof serve>[0] = {
      fetch: this.#app.fetch,
      port: this.#port,
      hostname: this.#host,
    };
    if (this.#serverOptions?.createServer) {
      opts.createServer = this.#serverOptions.createServer as NonNullable<typeof opts.createServer>;
    }
    if (this.#serverOptions?.serverOptions) {
      opts.serverOptions = this.#serverOptions.serverOptions as NonNullable<
        typeof opts.serverOptions
      >;
    }
    this.#server = await new Promise<NodeServer>((resolve) => {
      const server = serve(opts, (info) => {
        this.#port = info.port;
        container.logger.info(`Hono server listening on ${info.address}:${info.port}`);
        resolve(server as NodeServer);
      });
    });
  }

  #registerRoutes(container: Container): void {
    const moduleClass = container.module;
    const logger = container.logger;

    const options = this.#readOptions(moduleClass, container);
    const app = new Hono();
    app.onError(errorHandler);
    if (options?.middlewares) {
      for (const mw of options.middlewares) {
        app.use(mw);
      }
    }

    this.#port = options?.port;
    this.#host = options?.host;
    this.#serverOptions = options?.server;

    const providers = container.sorted;

    const contextProviders = providers.filter(isRequestContextClass);

    for (const provider of providers) {
      if (!isControllerClass(provider)) continue;

      const instance = container.resolve(provider) as object;
      const routes = getRouteProperties(instance);
      if (routes.length === 0) continue;

      const controllerApp = new Hono();
      const prefix = provider._path;

      for (const route of routes) {
        const middlewares: MiddlewareHandler[] = [];

        if (route.validate) {
          for (const target of VALIDATE_TARGETS) {
            const schema = route.validate[target];
            if (schema) {
              middlewares.push(createValidationMiddleware(target, schema));
            }
          }
        }

        const wrappedHandler = (c: Context): Promise<Response> => {
          const withContexts = (fn: () => Promise<Response>): Promise<Response> =>
            contextProviders.reduceRight((next, ctxCls) => () => ctxCls.run(c, next), fn)();
          return withContexts(() => container.withRequestScope(() => route.handler(c)));
        };

        for (const mw of middlewares) {
          controllerApp.on(route.method, route.path, mw);
        }
        controllerApp.on(route.method, route.path, wrappedHandler);

        logger.info(`${provider.name} mapped {${prefix}${route.path}, ${route.method}} route`);
      }

      app.route(prefix, controllerApp);
    }

    this.#app = app;
  }

  #readOptions(moduleClass: ModuleClass, container: Container) {
    const honoModule = this.#findHonoModule(moduleClass);
    if (!honoModule) return undefined;
    const factory = honoModule._honoOptions;
    return factory(<T>(cls: InjectableClass<T>): T => container.resolve(cls));
  }

  #findHonoModule(moduleClass: ModuleClass): HonoModuleClass | undefined {
    if (isHonoModuleClass(moduleClass)) return moduleClass;
    for (const imp of moduleClass._imports) {
      const found = this.#findHonoModule(imp);
      if (found) return found;
    }
    return undefined;
  }
}
