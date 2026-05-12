import type { Container, InjectableClass, ModuleClass } from '@ultranomic/di';
import { DIError, Injectable, SCOPE } from '@ultranomic/di';
import type { AnyRouter, Context } from '@orpc/server';
import { isProcedure, ORPCError } from '@orpc/server';
import type {
  StandardHandleResult,
  StandardHandlerInterceptorOptions,
} from '@orpc/server/standard';
import { StandardRPCHandler } from '@orpc/server/standard';
import { createErrorInterceptor } from './error-interceptor.ts';
import { mountOrpcOnHono } from './hono-adapter.ts';
import { OrpcRequestContext } from './orpc-request-context.ts';
import type { ErrorInterceptor, OrpcModuleClass, OrpcRouterClass } from './types.ts';

function isOrpcRouterClass(cls: InjectableClass): cls is OrpcRouterClass {
  return '_isOrpcRouter' in cls && cls._isOrpcRouter === true;
}

function isOrpcModuleClass(moduleClass: ModuleClass): moduleClass is OrpcModuleClass {
  return '_isOrpcModule' in moduleClass && moduleClass._isOrpcModule === true;
}

const isHonoModuleClass = (moduleClass: ModuleClass): boolean =>
  '_isHonoModule' in moduleClass && moduleClass._isHonoModule === true;

const findOrpcModule = (
  moduleClass: ModuleClass,
  visited: Set<ModuleClass> = new Set(),
): OrpcModuleClass | undefined => {
  if (visited.has(moduleClass)) return undefined;
  visited.add(moduleClass);
  if (isOrpcModuleClass(moduleClass)) return moduleClass;
  for (const imp of moduleClass._imports) {
    const found = findOrpcModule(imp, visited);
    if (found) return found;
  }
  return undefined;
};

const hasHonoModuleInTree = (
  moduleClass: ModuleClass,
  visited: Set<ModuleClass> = new Set(),
): boolean => {
  if (visited.has(moduleClass)) return false;
  visited.add(moduleClass);
  if (isHonoModuleClass(moduleClass)) return true;
  for (const imp of moduleClass._imports) {
    if (hasHonoModuleInTree(imp, visited)) return true;
  }
  return false;
};

const getProcedureProperties = (instance: object): Record<string, unknown> => {
  const procedures: Record<string, unknown> = {};
  for (const key of Object.keys(instance)) {
    const value = (instance as Record<string, unknown>)[key];
    if (isProcedure(value)) {
      procedures[key] = value;
    }
  }
  return procedures;
};

type OrpcInterceptor = (
  options: StandardHandlerInterceptorOptions<Record<PropertyKey, unknown>> & {
    next: () => Promise<StandardHandleResult>;
  },
) => Promise<StandardHandleResult>;

const wrapErrorInterceptor = (interceptor: ErrorInterceptor): OrpcInterceptor => {
  return async (options) => {
    try {
      return await options.next();
    } catch (error) {
      if (error instanceof ORPCError) throw error;
      const result = await interceptor(error, options.context);
      throw result;
    }
  };
};

const OrpcServiceBase: InjectableClass<object, readonly [], typeof SCOPE.SINGLETON> = Injectable({
  scope: SCOPE.SINGLETON,
});

export class OrpcService extends OrpcServiceBase {
  #handler: StandardRPCHandler<Context> | undefined;
  #container: Container | undefined;
  #initialized = false;

  public get handler(): StandardRPCHandler<Context> {
    if (!this.#initialized && this.#container) {
      this.#buildHandler(this.#container);
    }
    if (!this.#handler) {
      throw new DIError(
        'CONTAINER_NOT_STARTED',
        'OrpcService handler accessed before container start',
      );
    }
    return this.#handler;
  }

  public handle(
    ...args: Parameters<StandardRPCHandler<Context>['handle']>
  ): Promise<StandardHandleResult> {
    if (!this.#container) {
      throw new DIError(
        'CONTAINER_NOT_STARTED',
        'OrpcService.handle() called before container start or after stop',
      );
    }
    return this.#container.withRequestScope(async () =>
      OrpcRequestContext.run({ req: args[0] as unknown as Request }, () =>
        this.handler.handle(...args),
      ),
    );
  }

  public onReady = (container: Container): void => {
    this.#container = container;
    this.#buildHandler(container);
  };

  public onStop = (_container: Container): void => {
    this.#initialized = false;
    this.#container = undefined;
    this.#handler = undefined;
  };

  #buildHandler(container: Container): void {
    const moduleClass = container.module;
    const logger = container.logger;
    const options = this.#readOptions(moduleClass, container);
    const providers = container.sorted;

    const routerTree: Record<string, unknown> = {};
    const seenPaths = new Set<string>();

    for (const provider of providers) {
      if (!isOrpcRouterClass(provider)) continue;

      const path = provider._orpcPath;
      if (seenPaths.has(path)) {
        throw new DIError('DUPLICATE_PROVIDER', `Duplicate ORPC router path: '${path}'`);
      }
      seenPaths.add(path);

      const instance = container.resolve(provider) as object;
      const procedures = getProcedureProperties(instance);
      if (Object.keys(procedures).length > 0) {
        routerTree[path] = procedures;
        logger.info(`${provider.name} mapped {${path}} ORPC router`);
      }
    }

    const interceptors = options?.errorInterceptor
      ? [wrapErrorInterceptor(createErrorInterceptor(options.errorInterceptor))]
      : [];

    this.#handler = new StandardRPCHandler(routerTree as AnyRouter, {
      plugins: options?.plugins ? [...options.plugins] : [],
      interceptors,
    });

    if (hasHonoModuleInTree(moduleClass)) {
      const prefix = options?.prefix ?? '/rpc';
      mountOrpcOnHono(container, this.#handler, prefix);
      logger.info(`ORPC routes mounted at ${prefix}`);
    }

    this.#initialized = true;
  }

  #readOptions(moduleClass: ModuleClass, container: Container) {
    const orpcModule = findOrpcModule(moduleClass);
    if (!orpcModule) return undefined;
    const factory = orpcModule._orpcOptions;
    return factory(<T>(cls: InjectableClass<T>): T => container.resolve(cls));
  }
}
