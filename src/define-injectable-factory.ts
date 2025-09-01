import { onApplicationInitialized, onApplicationStart, onApplicationStop } from './define-app.ts';

/**
 * Represents an injectable dependency that can be provided to other components.
 * This is a generic wrapper type that can hold any value that should be injectable.
 * @template T - The type of the injectable value
 */
export type Injectable<T = unknown> = T;

/**
 * The main factory interface for creating injectable factories.
 * Provides a fluent API for defining named injectables with optional dependencies.
 */
type DefineInjectableFactory = {
  name<TName extends string>(name: TName): NamedInjectableFactoryBuilder<TName>;
};

/**
 * Builder for creating a named injectable factory.
 * Allows specifying whether the injectable has dependencies or not.
 * @template TName - The name of the injectable
 */
type NamedInjectableFactoryBuilder<TName extends string> = {
  inject(): InjectableFactoryBuilderNoDeps<TName>;
  inject<TInject extends Record<string, Injectable<unknown>>>(): InjectableFactoryBuilderWithDeps<TName, TInject>;
};

/**
 * Builder for injectables that don't have dependencies.
 * @template TName - The name of the injectable
 */
type InjectableFactoryBuilderNoDeps<TName extends string> = {
  handler<S extends object | void>(
    fn: (params: {
      name: TName;
      injector: undefined;
      appHooks: {
        onApplicationInitialized: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStart: (callback: () => unknown, executionOrder?: number) => void;
        onApplicationStop: (callback: () => unknown, executionOrder?: number) => void;
      };
    }) => S,
  ): () => Injectable<S>;
};

/**
 * Builder for injectables that have dependencies.
 * @template TName - The name of the injectable
 * @template TInject - Record of dependency names to their injectable types
 */
type InjectableFactoryBuilderWithDeps<TName extends string, TInject extends Record<string, Injectable<unknown>>> = {
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
  ): (injector: () => TInject) => Injectable<S>;
};

/**
 * Factory for creating injectable dependencies with optional dependency injection support.
 * Provides a fluent API for defining named injectables that can be used throughout the application.
 *
 * @example
 * ```typescript
 * // Injectable without dependencies
 * const myService = defineInjectableFactory
 *   .name('myService')
 *   .inject()
 *   .handler(() => ({ message: 'Hello World' }));
 *
 * // Injectable with dependencies
 * const dependentService = defineInjectableFactory
 *   .name('dependentService')
 *   .inject<{ myService: Injectable<{ message: string }> }>()
 *   .handler(({ injector }) => {
 *     const deps = injector();
 *     return { greeting: deps.myService.message };
 *   });
 * ```
 */
export const defineInjectableFactory: DefineInjectableFactory = {
  name: (name) => ({
    inject: () => ({
      handler: (fn: any) => (injectorOrNothing?: unknown) =>
        fn({
          name,
          injector: injectorOrNothing as any,
          appHooks: { onApplicationInitialized, onApplicationStart, onApplicationStop },
        }),
    }),
  }),
};
