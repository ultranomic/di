import { defineInjectableFactory, type Injectable } from './define-injectable-factory.ts';
import { appLogger } from './app-logger.ts';
import type { Logger } from 'pino';

/**
 * Represents a service component that provides business logic and data operations.
 * Services are injectable containers that typically contain methods for data manipulation, business rules, and external API calls.
 * @template T - The type of the service's exported interface
 */
export type Service<T = unknown> = Injectable<T>;

/**
 * The main factory interface for creating service factories.
 * Provides a fluent API for defining named services with optional dependencies.
 */
type DefineServiceFactory = {
  name<TName extends string>(injectableName: TName): NamedServiceFactoryBuilder<TName>;
};

/**
 * Builder for creating a named service factory.
 * Allows specifying whether the service has dependencies or not.
 * @template TName - The name of the service
 */
type NamedServiceFactoryBuilder<TName extends string> = {
  inject(): ServiceFactoryBuilderNoDeps<TName>;
  inject<TInject extends Record<string, Injectable<unknown>>>(): ServiceFactoryBuilderWithDeps<TName, TInject>;
};

/**
 * Builder for services that don't have dependencies.
 * Automatically provides a logger instance specific to the named service.
 * @template TName - The name of the service
 */
type ServiceFactoryBuilderNoDeps<TName extends string> = {
  handler<S extends object | void>(
    fn: (params: {
      name: TName;
      injector: () => { logger?: Logger };
      appHooks: {
        onApplicationInitialized: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStart: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStop: (callback: () => unknown, executionOrder?: number) => void;
      };
    }) => S,
  ): () => Service<S>;
};

/**
 * Builder for services that have dependencies.
 * Automatically provides a logger instance specific to the named service along with the specified dependencies.
 * @template TName - The name of the service
 * @template TInject - Record of dependency names to their injectable types
 */
type ServiceFactoryBuilderWithDeps<TName extends string, TInject extends Record<string, Injectable<unknown>>> = {
  handler<S extends object | void>(
    fn: (params: {
      name: TName;
      injector: () => { logger?: Logger } & TInject;
      appHooks: {
        onApplicationInitialized: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStart: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStop: (callback: () => unknown, executionOrder?: number) => void;
      };
    }) => S,
  ): (injector: () => TInject) => Service<S>;
};

/**
 * Factory for creating service components with optional dependency injection support.
 * Services provide business logic, data operations, and encapsulate application functionality.
 * Automatically injects a component-specific logger derived from the app logger.
 *
 * @example
 * ```typescript
 * // Service without dependencies (logger automatically injected)
 * const userService = defineServiceFactory
 *   .name('userService')
 *   .inject()
 *   .handler(({ injector }) => {
 *     const { logger } = injector();
 *     logger?.info('User service initializing');
 *     return {
 *       getUsers: () => [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }],
 *       createUser: (userData: any) => ({ id: Date.now(), ...userData }),
 *       validateUser: (user: any) => user.name && user.email,
 *     };
 *   });
 *
 * // Service with dependencies (logger automatically included with dependencies)
 * const emailService = defineServiceFactory
 *   .name('emailService')
 *   .inject<{ userService: Service<{ getUsers: Function }> }>()
 *   .handler(({ injector }) => {
 *     const { logger, userService } = injector();
 *     logger?.info('Email service initializing');
 *     return {
 *       sendWelcomeEmail: (userId: number) => {
 *         const users = userService.getUsers();
 *         const user = users.find(u => u.id === userId);
 *         // Send email logic here
 *         return { success: true, user };
 *       },
 *     };
 *   });
 * ```
 */
export const defineServiceFactory: DefineServiceFactory = {
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
