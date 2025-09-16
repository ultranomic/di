import { defineInjectableFactory, type Injectable } from './define-injectable-factory.ts';
import { appLogger } from './app-logger.ts';
import type { Logger } from 'pino';

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
 * Automatically provides a logger instance specific to the named module.
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
 * Automatically provides a logger instance specific to the named module along with the specified dependencies.
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
 * Automatically injects a component-specific logger derived from the app logger.
 *
 * @example
 * ```typescript
 * // Module without dependencies (logger automatically injected)
 * const userModule = defineModuleFactory
 *   .name('userModule')
 *   .inject()
 *   .handler(({ injector }) => {
 *     const { logger } = injector();
 *     logger?.info('User module initializing');
 *     return {
 *       getUser: (id: string) => ({ id, name: 'John Doe' }),
 *       createUser: (data: any) => ({ id: '123', ...data }),
 *     };
 *   });
 *
 * // Module with dependencies (logger automatically included with dependencies)
 * const apiModule = defineModuleFactory
 *   .name('apiModule')
 *   .inject<{ userModule: Module<{ getUser: Function }> }>()
 *   .handler(({ injector }) => {
 *     const { logger, userModule } = injector();
 *     logger?.info('API module initializing');
 *     return {
 *       getUser: userModule.getUser,
 *       getUserByApi: (id: string) => userModule.getUser(id),
 *     };
 *   });
 * ```
 */
export const defineModuleFactory: DefineModuleFactory = {
  name: (name) => ({
    inject: () => ({
      handler: (fn: any) => (injectorOrNothing?: Function) => {
        const logger = appLogger?.child({}, { msgPrefix: name ? `[${name}] ` : '' });
        return defineInjectableFactory.name(name).inject<any>().handler(fn)(() => ({
          logger,
          ...injectorOrNothing?.(),
        })) as any;
      },
    }),
  }),
};
