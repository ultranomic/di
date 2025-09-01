import { defineInjectableFactory, type Injectable } from './define-injectable-factory.ts';

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
 * @template TName - The name of the service
 */
type ServiceFactoryBuilderNoDeps<TName extends string> = {
  handler<S extends object | void>(
    fn: (params: {
      name: TName;
      injector: never;
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
 * @template TName - The name of the service
 * @template TInject - Record of dependency names to their injectable types
 */
type ServiceFactoryBuilderWithDeps<TName extends string, TInject extends Record<string, Injectable<unknown>>> = {
  handler<S extends object | void>(
    fn: (params: {
      name: TName;
      injector: () => TInject;
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
 *
 * @example
 * ```typescript
 * // Service without dependencies
 * const userService = defineServiceFactory
 *   .name('userService')
 *   .inject()
 *   .handler(() => ({
 *     getUsers: () => [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }],
 *     createUser: (userData: any) => ({ id: Date.now(), ...userData }),
 *     validateUser: (user: any) => user.name && user.email,
 *   }));
 *
 * // Service with dependencies
 * const emailService = defineServiceFactory
 *   .name('emailService')
 *   .inject<{ userService: Service<{ getUsers: Function }> }>()
 *   .handler(({ injector }) => {
 *     const deps = injector();
 *     return {
 *       sendWelcomeEmail: (userId: number) => {
 *         const users = deps.userService.getUsers();
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
      handler: (fn: any) => (injectorOrNothing?: unknown) =>
        defineInjectableFactory.name(name).inject<any>().handler(fn)(injectorOrNothing as any) as any,
    }),
  }),
};
