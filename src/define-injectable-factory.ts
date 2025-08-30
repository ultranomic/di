import { onApplicationInitialized, onApplicationStart, onApplicationStop } from './define-app.ts';

/**
 * Base type for all dependency injectable components.
 * This is a generic wrapper type that preserves the underlying type structure.
 *
 * @template T - The type of the injectable component
 * @example
 * ```typescript
 * type MyService = Injectable<{ getData: () => string }>;
 * ```
 */
export type Injectable<T = unknown> = T;

/**
 * Main interface for the defineInjectableFactory utility.
 * Provides methods for creating injectable factory functions with or without dependencies.
 */
type DefineInjectableFactory = {
  /**
   * Creates an injectable factory function without dependencies.
   *
   * @template S - The return type of the component (must be object or void)
   * @param fn - Factory function that returns the component instance
   * @returns A factory function that creates the injectable component
   */
  handler<S extends object | void>(fn: () => S): () => Injectable<S>;

  /**
   * Creates a builder for injectable factory functions that require dependencies.
   *
   * @template T - Record type defining the required dependencies
   * @returns An InjectableFactoryBuilder instance for configuring the factory
   */
  inject<T extends Record<string, Injectable<unknown>>>(): InjectableFactoryBuilder<T>;
};

/**
 * Builder interface for creating injectable factory functions with dependencies.
 * Provides access to dependency injection and application lifecycle hooks.
 *
 * @template T - Record type defining the required dependencies
 */
type InjectableFactoryBuilder<T> = {
  /**
   * Defines the handler function for the injectable component with dependencies.
   *
   * @template S - The return type of the component (must be object or void)
   * @param fn - Factory function that receives injector and lifecycle hooks
   * @param fn.injector - Function that provides access to injected dependencies
   * @param fn.appHooks - Object containing application lifecycle hook registrars
   * @param fn.appHooks.onApplicationInitialized - Register callback for application initialization event
   * @param fn.appHooks.onApplicationStart - Register callback for application start event
   * @param fn.appHooks.onApplicationStop - Register callback for application stop event
   * @returns A factory function that accepts an injector and creates the component
   */
  handler<S extends object | void>(
    fn: (
      injector: () => T,
      appHooks: {
        onApplicationInitialized: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStart: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStop: (callback: () => unknown, executionOrder?: number) => void;
      },
    ) => S,
  ): (injector: () => T) => Injectable<S>;
};

/**
 * Core utility for creating type-safe injectable factory functions with dependency injection support.
 * This is the foundational building block for all other layers (Service, Module, Router, App).
 *
 * Features:
 * - Type-safe dependency injection
 * - Application lifecycle hook integration
 * - Support for factory functions with and without dependencies
 * - Functional composition patterns
 *
 * @example
 * ```typescript
 * // Without dependencies - creates injectable factory
 * const defineSimpleComponent = defineInjectableFactory.handler(() => ({
 *   getValue: () => 'hello world'
 * }));
 *
 * // With dependencies - creates injectable factory with dependencies
 * const defineComplexComponent = defineInjectableFactory
 *   .inject<{ logger: Injectable<{ log: (msg: string) => void }> }>()
 *   .handler((injector, { onApplicationInitialized, onApplicationStart }) => {
 *     const { logger } = injector();
 *
 *     onApplicationInitialized(() => {
 *       logger.log('Component initialized');
 *     });
 *
 *     onApplicationStart(() => {
 *       logger.log('Component started');
 *     });
 *
 *     return {
 *       process: (data: string) => {
 *         logger.log(`Processing: ${data}`);
 *         return data.toUpperCase();
 *       }
 *     };
 *   });
 * ```
 */
export const defineInjectableFactory: DefineInjectableFactory = {
  handler: (fn) => () => fn(),
  inject: () => ({
    handler: (fn) => {
      return (injector) => {
        const result = fn(injector, { onApplicationInitialized, onApplicationStart, onApplicationStop });
        return result;
      };
    },
  }),
};
