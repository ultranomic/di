import { defineInjectableFactory, type Injectable } from './define-injectable-factory.ts';
import { type Logger, loggerFactory } from './app-logger.ts';

/**
 * Represents a module that can be loaded into the application.
 * Modules are injectable containers that typically hold related functionality, services, or configuration.
 * @template T - The type of the module's exported interface
 */
export type Module<T = unknown> = Injectable<T>;

/**
 * The main factory interface for creating module factories.
 * Provides a fluent API for defining named modules with optional dependencies.
 */
type DefineModuleFactory = {
  name<TName extends string>(name: TName): NamedModuleFactoryBuilder<TName>;
};

/**
 * Builder for creating a named module factory.
 * Allows specifying whether the module has dependencies or not.
 * @template TName - The name of the module
 */
type NamedModuleFactoryBuilder<TName extends string> = {
  inject(): ModuleFactoryBuilderNoDeps<TName>;
  inject<TInject extends Record<string, Injectable<unknown>>>(): ModuleFactoryBuilderWithDeps<TName, TInject>;
};

/**
 * Builder for modules that don't have dependencies.
 * @template TName - The name of the module
 */
type ModuleFactoryBuilderNoDeps<TName extends string> = {
  handler<S extends Record<string | symbol, unknown> | void>(
    fn: (params: {
      name: TName;
      injector: () => { logger?: Logger };
      appHooks: {
        onApplicationInitialized: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStart: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStop: (callback: () => unknown, executionOrder?: number) => void;
      };
    }) => S,
  ): () => Module<S>;
};

/**
 * Builder for modules that have dependencies.
 * @template TName - The name of the module
 * @template TInject - Record of dependency names to their injectable types
 */
type ModuleFactoryBuilderWithDeps<TName extends string, TInject extends Record<string, Injectable<unknown>>> = {
  handler<S extends Record<string | symbol, unknown> | void>(
    fn: (params: {
      name: TName;
      injector: () => { logger?: Logger } & TInject;
      appHooks: {
        onApplicationInitialized: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStart: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStop: (callback: () => unknown, executionOrder?: number) => void;
      };
    }) => S,
  ): (injector: () => TInject) => Module<S>;
};

/**
 * Factory for creating application modules with optional dependency injection support.
 * Modules are higher-level containers that can encapsulate related services, configuration, and functionality.
 *
 * @example
 * ```typescript
 * // Module without dependencies
 * const userModule = defineModuleFactory
 *   .name('userModule')
 *   .inject()
 *   .handler(() => ({
 *     getUser: (id: string) => ({ id, name: 'John Doe' }),
 *     createUser: (data: any) => ({ id: '123', ...data }),
 *   }));
 *
 * // Module with dependencies
 * const apiModule = defineModuleFactory
 *   .name('apiModule')
 *   .inject<{ userModule: Module<{ getUser: Function }> }>()
 *   .handler(({ injector }) => {
 *     const deps = injector();
 *     return {
 *       getUser: deps.userModule.getUser,
 *       getUserByApi: (id: string) => deps.userModule.getUser(id),
 *     };
 *   });
 * ```
 */
export const defineModuleFactory: DefineModuleFactory = {
  name: (name) => ({
    inject: () => ({
      handler: (fn: any) => (injectorOrNothing?: Function) => {
        const logger = loggerFactory?.(name);
        return defineInjectableFactory.name(name).inject<any>().handler(fn)(() => ({
          logger,
          ...injectorOrNothing?.(),
        })) as any;
      },
    }),
  }),
};
