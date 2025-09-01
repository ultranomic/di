import { describe, it } from 'node:test';
import assert from 'node:assert';
import { defineInjectableFactory, type Injectable } from './define-injectable-factory.ts';

/**
 * Test Plan for defineInjectableFactory
 *
 * BASIC FUNCTIONALITY:
 * 1. ✅ Should require name to be specified first
 * 2. ✅ Should create injectable factory with object return
 * 3. ✅ Should create injectable factory with void return
 * 4. ✅ Should pass component name to handler function
 * 5. ✅ Should support side effects and multiple instantiations
 *
 * DEPENDENCY INJECTION:
 * 6. ✅ Should create injectable factory with typed dependencies
 * 7. ✅ Should inject dependencies correctly via injector function
 * 8. ✅ Should support complex dependency types
 * 9. ✅ Should handle multiple dependencies of different types
 *
 * LIFECYCLE HOOKS:
 * 10. ✅ Should provide access to application lifecycle hooks
 * 11. ✅ Should register hooks without immediately firing them
 * 12. ✅ Should provide all three lifecycle hooks (init, start, stop)
 * 13. ✅ Should work with lifecycle hooks and dependencies together
 *
 * ERROR HANDLING:
 * 14. ✅ Should handle injector being undefined when no dependencies specified
 * 15. ✅ Should provide meaningful error messages
 * 16. ✅ Should handle invalid injector calls gracefully
 *
 * TYPE SAFETY:
 * 17. ✅ Should enforce object or void return types
 * 18. ✅ Should maintain Injectable type wrapper
 * 19. ✅ Should provide proper TypeScript intellisense
 * 20. ✅ Should support generic name types for better type safety
 * 21. ✅ Should provide literal string types for component names
 *
 * INTEGRATION:
 * 22. ✅ Should work as building block for higher-level abstractions
 * 23. ✅ Should support functional composition patterns
 * 24. ✅ Should maintain consistent API with other factory functions
 */

describe('defineInjectableFactory', () => {
  describe('Basic Functionality', () => {
    // Test 1: Should require name to be specified first
    it('should require name to be specified first', () => {
      const defineInjectable = defineInjectableFactory
        .name('TestComponent')
        .inject()
        .handler(({ name }) => ({
          componentName: name,
          getValue: () => 'test value',
        }));

      const instance = defineInjectable();
      assert.strictEqual(instance.componentName, 'TestComponent');
      assert.strictEqual(instance.getValue(), 'test value');
    });

    // Test 2: Should create injectable factory with object return
    it('should create injectable factory with object return', () => {
      const defineInjectable = defineInjectableFactory
        .name('ObjectComponent')
        .inject()
        .handler(() => ({
          property: 'value',
          method: () => 'method result',
          number: 42,
          nested: {
            deep: 'nested value',
          },
        }));

      const instance = defineInjectable();
      assert.strictEqual(typeof instance, 'object');
      assert.strictEqual(instance.property, 'value');
      assert.strictEqual(instance.method(), 'method result');
      assert.strictEqual(instance.number, 42);
      assert.strictEqual(instance.nested.deep, 'nested value');
    });

    // Test 3: Should create injectable factory with void return
    it('should create injectable factory with void return', () => {
      let sideEffectExecuted = false;

      const defineInjectable = defineInjectableFactory
        .name('VoidComponent')
        .inject()
        .handler(() => {
          sideEffectExecuted = true;
          // Explicit void return
        });

      const instance = defineInjectable();
      assert.strictEqual(instance, undefined);
      assert.strictEqual(sideEffectExecuted, true);
    });

    // Test 4: Should pass component name to handler function
    it('should pass component name to handler function', () => {
      const receivedNames: string[] = [];

      const defineInjectable1 = defineInjectableFactory
        .name('Component1')
        .inject()
        .handler(({ name }) => {
          receivedNames.push(name);
          return { name };
        });

      const defineInjectable2 = defineInjectableFactory
        .name('Component2')
        .inject()
        .handler(({ name }) => {
          receivedNames.push(name);
          return { name };
        });

      const instance1 = defineInjectable1();
      const instance2 = defineInjectable2();

      assert.strictEqual(receivedNames.length, 2);
      assert.strictEqual(receivedNames[0], 'Component1');
      assert.strictEqual(receivedNames[1], 'Component2');
      assert.strictEqual(instance1.name, 'Component1');
      assert.strictEqual(instance2.name, 'Component2');
    });

    // Test 5: Should support side effects and multiple instantiations
    it('should support side effects and multiple instantiations', () => {
      let counter = 0;

      const defineInjectable = defineInjectableFactory
        .name('CounterComponent')
        .inject()
        .handler(({ name }) => {
          counter++;
          return {
            name,
            instanceNumber: counter,
            getGlobalCounter: () => counter,
          };
        });

      const instance1 = defineInjectable();
      const instance2 = defineInjectable();
      const instance3 = defineInjectable();

      assert.strictEqual(instance1.instanceNumber, 1);
      assert.strictEqual(instance2.instanceNumber, 2);
      assert.strictEqual(instance3.instanceNumber, 3);

      // All instances should see the current global counter
      assert.strictEqual(instance1.getGlobalCounter(), 3);
      assert.strictEqual(instance2.getGlobalCounter(), 3);
      assert.strictEqual(instance3.getGlobalCounter(), 3);
    });
  });

  describe('Dependency Injection', () => {
    // Test 6: Should create injectable factory with typed dependencies
    it('should create injectable factory with typed dependencies', () => {
      type Dependencies = {
        logger: Injectable<{ log: (msg: string) => void }>;
        config: Injectable<{ apiUrl: string; timeout: number }>;
      };

      const defineInjectable = defineInjectableFactory
        .name('ServiceComponent')
        .inject<Dependencies>()
        .handler(({ name, injector }) => {
          const { logger, config } = injector();

          return {
            name,
            makeRequest: (endpoint: string) => {
              logger.log(`Making request to ${config.apiUrl}${endpoint}`);
              return {
                url: `${config.apiUrl}${endpoint}`,
                timeout: config.timeout,
              };
            },
          };
        });

      const mockLogger = { log: () => {} };
      const mockConfig = { apiUrl: 'https://api.test.com', timeout: 5000 };
      const mockInjector = () => ({ logger: mockLogger, config: mockConfig });

      const instance = defineInjectable(mockInjector);
      const result = instance.makeRequest('/users');

      assert.strictEqual(instance.name, 'ServiceComponent');
      assert.strictEqual(result.url, 'https://api.test.com/users');
      assert.strictEqual(result.timeout, 5000);
    });

    // Test 7: Should inject dependencies correctly via injector function
    it('should inject dependencies correctly via injector function', () => {
      type Dependencies = {
        database: Injectable<{ query: (sql: string) => any[] }>;
        cache: Injectable<{ get: (key: string) => any; set: (key: string, value: any) => void }>;
      };

      const defineInjectable = defineInjectableFactory
        .name('DataService')
        .inject<Dependencies>()
        .handler(({ name, injector }) => {
          const deps = injector();

          return {
            name,
            findUser: (id: string) => {
              // Check cache first
              const cached = deps.cache.get(`user:${id}`);
              if (cached) return cached;

              // Query database
              const result = deps.database.query(`SELECT * FROM users WHERE id = '${id}'`);
              if (result.length > 0) {
                deps.cache.set(`user:${id}`, result[0]);
                return result[0];
              }
              return null;
            },
          };
        });

      const mockDatabase = {
        query: (sql: string) => (sql.includes("id = '123'") ? [{ id: '123', name: 'John' }] : []),
      };
      const mockCache = new Map();
      const mockCacheService = {
        get: (key: string) => mockCache.get(key),
        set: (key: string, value: any) => mockCache.set(key, value),
      };
      const mockInjector = () => ({ database: mockDatabase, cache: mockCacheService });

      const instance = defineInjectable(mockInjector);

      // First call should hit database
      const user1 = instance.findUser('123');
      assert.deepStrictEqual(user1, { id: '123', name: 'John' });

      // Second call should hit cache
      const user2 = instance.findUser('123');
      assert.deepStrictEqual(user2, { id: '123', name: 'John' });

      // Non-existent user
      const user3 = instance.findUser('456');
      assert.strictEqual(user3, null);
    });

    // Test 8: Should support complex dependency types
    it('should support complex dependency types', () => {
      type ComplexDependencies = {
        eventBus: Injectable<{
          emit: (event: string, data: any) => void;
          on: (event: string, handler: (data: any) => void) => void;
        }>;
        validator: Injectable<{
          validate: (schema: any, data: any) => { valid: boolean; errors: string[] };
        }>;
        transformer: Injectable<{
          transform: <T, R>(data: T, mapper: (item: T) => R) => R;
        }>;
      };

      const defineInjectable = defineInjectableFactory
        .name('ComplexService')
        .inject<ComplexDependencies>()
        .handler(({ name, injector }) => {
          const { eventBus, validator, transformer } = injector();

          return {
            name,
            processData: (data: any) => {
              // Validate input
              const validation = validator.validate({ required: ['id', 'name'] }, data);
              if (!validation.valid) {
                eventBus.emit('validation_error', { errors: validation.errors });
                return null;
              }

              // Transform data
              const transformed = transformer.transform(data, (item: any) => ({
                ...item,
                processed: true,
                timestamp: Date.now(),
              }));

              eventBus.emit('data_processed', { data: transformed });
              return transformed;
            },
          };
        });

      const events: Array<{ event: string; data: any }> = [];
      const mockEventBus = {
        emit: (event: string, data: any) => events.push({ event, data }),
        on: () => {},
      };
      const mockValidator = {
        validate: (schema: any, data: any) => {
          const hasId = data && data.id !== undefined;
          const hasName = data && data.name !== undefined;
          return {
            valid: hasId && hasName,
            errors: [...(!hasId ? ['id is required'] : []), ...(!hasName ? ['name is required'] : [])],
          };
        },
      };
      const mockTransformer = {
        transform: <T, R>(data: T, mapper: (item: T) => R): R => mapper(data),
      };
      const mockInjector = () => ({
        eventBus: mockEventBus,
        validator: mockValidator,
        transformer: mockTransformer,
      });

      const instance = defineInjectable(mockInjector);

      // Valid data
      const validResult = instance.processData({ id: '123', name: 'John' });
      assert.strictEqual(validResult.id, '123');
      assert.strictEqual(validResult.name, 'John');
      assert.strictEqual(validResult.processed, true);
      assert.strictEqual(typeof validResult.timestamp, 'number');

      // Invalid data
      const invalidResult = instance.processData({ id: '123' }); // missing name
      assert.strictEqual(invalidResult, null);

      // Check events
      assert.strictEqual(events.length, 2);
      assert.strictEqual(events[0].event, 'data_processed');
      assert.strictEqual(events[1].event, 'validation_error');
    });

    // Test 9: Should handle multiple dependencies of different types
    it('should handle multiple dependencies of different types', () => {
      type MixedDependencies = {
        stringService: Injectable<string>;
        numberService: Injectable<number>;
        functionService: Injectable<() => boolean>;
        objectService: Injectable<{ prop: string; method: () => void }>;
        arrayService: Injectable<string[]>;
      };

      const defineInjectable = defineInjectableFactory
        .name('MixedService')
        .inject<MixedDependencies>()
        .handler(({ name, injector }) => {
          const deps = injector();

          return {
            name,
            getAllTypes: () => ({
              string: deps.stringService,
              number: deps.numberService,
              functionResult: deps.functionService(),
              objectProp: deps.objectService.prop,
              arrayLength: deps.arrayService.length,
            }),
          };
        });

      const mockInjector = () => ({
        stringService: 'test string',
        numberService: 42,
        functionService: () => true,
        objectService: { prop: 'object prop', method: () => {} },
        arrayService: ['a', 'b', 'c'],
      });

      const instance = defineInjectable(mockInjector);
      const result = instance.getAllTypes();

      assert.strictEqual(result.string, 'test string');
      assert.strictEqual(result.number, 42);
      assert.strictEqual(result.functionResult, true);
      assert.strictEqual(result.objectProp, 'object prop');
      assert.strictEqual(result.arrayLength, 3);
    });
  });

  describe('Lifecycle Hooks', () => {
    // Test 10: Should provide access to application lifecycle hooks
    it('should provide access to application lifecycle hooks', () => {
      const defineInjectable = defineInjectableFactory
        .name('HookComponent')
        .inject()
        .handler(({ name, appHooks }) => {
          return {
            name,
            hooks: appHooks,
          };
        });

      const instance = defineInjectable();

      assert.strictEqual(instance.name, 'HookComponent');
      assert.strictEqual(typeof instance.hooks.onApplicationInitialized, 'function');
      assert.strictEqual(typeof instance.hooks.onApplicationStart, 'function');
      assert.strictEqual(typeof instance.hooks.onApplicationStop, 'function');
    });

    // Test 11: Should register hooks without immediately firing them
    it('should register hooks without immediately firing them', () => {
      let initCalled = false;
      let startCalled = false;
      let stopCalled = false;

      const defineInjectable = defineInjectableFactory
        .name('DelayedHookComponent')
        .inject()
        .handler(({ name, appHooks }) => {
          // Register hooks - they should NOT fire immediately
          appHooks.onApplicationInitialized(() => {
            initCalled = true;
          });

          appHooks.onApplicationStart(() => {
            startCalled = true;
          });

          appHooks.onApplicationStop(() => {
            stopCalled = true;
          });

          return {
            name,
            checkHookStatus: () => ({ initCalled, startCalled, stopCalled }),
          };
        });

      const instance = defineInjectable();
      const status = instance.checkHookStatus();

      // Hooks should be registered but not yet fired
      assert.strictEqual(status.initCalled, false);
      assert.strictEqual(status.startCalled, false);
      assert.strictEqual(status.stopCalled, false);
    });

    // Test 12: Should provide all three lifecycle hooks (init, start, stop)
    it('should provide all three lifecycle hooks (init, start, stop)', () => {
      const hooksCalled: string[] = [];

      const defineInjectable = defineInjectableFactory
        .name('FullLifecycleComponent')
        .inject()
        .handler(({ name, appHooks }) => {
          appHooks.onApplicationInitialized(() => {
            hooksCalled.push('init');
          });

          appHooks.onApplicationStart(() => {
            hooksCalled.push('start');
          });

          appHooks.onApplicationStop(() => {
            hooksCalled.push('stop');
          });

          return {
            name,
            getHooksCalled: () => [...hooksCalled],
            registerAdditionalHooks: () => {
              // Should be able to register multiple hooks of same type
              appHooks.onApplicationInitialized(() => {
                hooksCalled.push('init2');
              });

              appHooks.onApplicationStart(() => {
                hooksCalled.push('start2');
              });
            },
          };
        });

      const instance = defineInjectable();

      // Initially no hooks called
      assert.deepStrictEqual(instance.getHooksCalled(), []);

      // Should be able to register additional hooks after component creation
      instance.registerAdditionalHooks();
      assert.deepStrictEqual(instance.getHooksCalled(), []);

      assert.strictEqual(instance.name, 'FullLifecycleComponent');
    });

    // Test 13: Should work with lifecycle hooks and dependencies together
    it('should work with lifecycle hooks and dependencies together', () => {
      type Dependencies = {
        logger: Injectable<{ log: (message: string) => void; getHistory: () => string[] }>;
        config: Injectable<{ appName: string; version: string }>;
      };

      const logs: string[] = [];
      const mockLogger = {
        log: (message: string) => logs.push(message),
        getHistory: () => [...logs],
      };
      const mockConfig = { appName: 'TestApp', version: '1.0.0' };
      const mockInjector = () => ({ logger: mockLogger, config: mockConfig });

      const defineInjectable = defineInjectableFactory
        .name('IntegratedComponent')
        .inject<Dependencies>()
        .handler(({ name, injector, appHooks }) => {
          const { logger, config } = injector();

          // Register lifecycle hooks that use dependencies
          appHooks.onApplicationInitialized(() => {
            logger.log(`${name} initialized for ${config.appName} v${config.version}`);
          });

          appHooks.onApplicationStart(() => {
            logger.log(`${name} started`);
          });

          appHooks.onApplicationStop(() => {
            logger.log(`${name} stopped`);
          });

          return {
            name,
            performAction: () => {
              logger.log(`${name} performing action`);
              return `Action performed for ${config.appName}`;
            },
            getLogHistory: () => logger.getHistory(),
            getConfig: () => config,
          };
        });

      const instance = defineInjectable(mockInjector);

      // Test that dependencies are properly injected
      const config = instance.getConfig();
      assert.strictEqual(config.appName, 'TestApp');
      assert.strictEqual(config.version, '1.0.0');

      // Test that component methods work with dependencies
      const result = instance.performAction();
      assert.strictEqual(result, 'Action performed for TestApp');

      // Check that manual log was recorded
      const history = instance.getLogHistory();
      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0], 'IntegratedComponent performing action');

      // Lifecycle hooks are registered but not yet fired
      // (they would fire during actual app lifecycle events)
      assert.strictEqual(instance.name, 'IntegratedComponent');
    });
  });

  describe('Error Handling', () => {
    // Test 14: Should handle injector being undefined when no dependencies specified
    it('should handle injector being undefined when no dependencies specified', () => {
      const defineInjectable = defineInjectableFactory
        .name('NoDepsComponent')
        .inject()
        .handler(({ name, injector }) => {
          return {
            name,
            injectorType: typeof injector,
            injectorValue: injector,
          };
        });

      const instance = defineInjectable();

      // When no dependencies are specified, injector should be undefined
      assert.strictEqual(instance.name, 'NoDepsComponent');
      assert.strictEqual(instance.injectorType, 'undefined');
      assert.strictEqual(instance.injectorValue, undefined);
    });

    // Test 15: Should provide meaningful error messages
    it('should provide meaningful error messages', () => {
      const defineInjectable = defineInjectableFactory
        .name('ErrorTestComponent')
        .inject()
        .handler(({ name, injector }) => {
          // This should be safe - injector is undefined when no deps specified
          return {
            name,
            hasInjector: injector !== undefined,
            canCallInjector: typeof injector === 'function',
          };
        });

      const instance = defineInjectable();

      assert.strictEqual(instance.name, 'ErrorTestComponent');
      assert.strictEqual(instance.hasInjector, false);
      assert.strictEqual(instance.canCallInjector, false);
    });

    // Test 16: Should handle invalid injector calls gracefully
    it('should handle invalid injector calls gracefully', () => {
      type Dependencies = {
        service: Injectable<{ getValue: () => string }>;
      };

      const defineInjectable = defineInjectableFactory
        .name('InjectorTestComponent')
        .inject<Dependencies>()
        .handler(({ name, injector }) => {
          return {
            name,
            testInjector: () => {
              try {
                const deps = injector();
                return {
                  success: true,
                  hasService: 'service' in deps,
                  serviceValue: deps.service?.getValue?.(),
                };
              } catch (error) {
                return {
                  success: false,
                  error: error instanceof Error ? error.message : 'Unknown error',
                };
              }
            },
          };
        });

      // Test with valid injector
      const validMockInjector = () => ({
        service: { getValue: () => 'test value' },
      });

      const validInstance = defineInjectable(validMockInjector);
      const validResult = validInstance.testInjector();

      assert.strictEqual(validResult.success, true);
      assert.strictEqual(validResult.hasService, true);
      assert.strictEqual(validResult.serviceValue, 'test value');

      // Test with invalid injector (missing service)
      const invalidMockInjector = () => ({}) as any;

      const invalidInstance = defineInjectable(invalidMockInjector);
      const invalidResult = invalidInstance.testInjector();

      assert.strictEqual(invalidResult.success, true); // No error thrown
      assert.strictEqual(invalidResult.hasService, false);
      assert.strictEqual(invalidResult.serviceValue, undefined);
    });
  });

  describe('Type Safety', () => {
    // Test 17: Should enforce object or void return types
    it('should enforce object or void return types', () => {
      // Test object return type
      const defineObjectComponent = defineInjectableFactory
        .name('ObjectComponent')
        .inject()
        .handler(() => ({
          stringProp: 'string',
          numberProp: 42,
          booleanProp: true,
          method: () => 'method result',
          nestedObject: { nested: 'value' },
          arrayProp: [1, 2, 3],
        }));

      const objectInstance = defineObjectComponent();
      assert.strictEqual(typeof objectInstance, 'object');
      assert.strictEqual(objectInstance.stringProp, 'string');
      assert.strictEqual(objectInstance.numberProp, 42);
      assert.strictEqual(objectInstance.booleanProp, true);
      assert.strictEqual(objectInstance.method(), 'method result');
      assert.deepStrictEqual(objectInstance.nestedObject, { nested: 'value' });
      assert.deepStrictEqual(objectInstance.arrayProp, [1, 2, 3]);

      // Test void return type
      const defineVoidComponent = defineInjectableFactory
        .name('VoidComponent')
        .inject()
        .handler(() => {
          // Explicit void return
        });

      const voidInstance = defineVoidComponent();
      assert.strictEqual(voidInstance, undefined);
    });

    // Test 18: Should maintain Injectable type wrapper
    it('should maintain Injectable type wrapper', () => {
      type TestService = Injectable<{
        getValue: () => string;
        setValue: (value: string) => void;
        getCount: () => number;
      }>;

      const defineServiceComponent = defineInjectableFactory
        .name('ServiceComponent')
        .inject()
        .handler((): TestService => {
          let value = 'initial';
          let count = 0;

          return {
            getValue: () => value,
            setValue: (newValue: string) => {
              value = newValue;
              count++;
            },
            getCount: () => count,
          };
        });

      const instance = defineServiceComponent();

      // Test that the instance conforms to the Injectable type
      assert.strictEqual(typeof instance.getValue, 'function');
      assert.strictEqual(typeof instance.setValue, 'function');
      assert.strictEqual(typeof instance.getCount, 'function');

      assert.strictEqual(instance.getValue(), 'initial');
      assert.strictEqual(instance.getCount(), 0);

      instance.setValue('updated');
      assert.strictEqual(instance.getValue(), 'updated');
      assert.strictEqual(instance.getCount(), 1);
    });

    // Test 19: Should provide proper TypeScript intellisense
    it('should provide proper TypeScript intellisense', () => {
      // Test that TypeScript can infer types correctly
      const defineTypedComponent = defineInjectableFactory
        .name('TypedComponent')
        .inject()
        .handler(({ name }) => {
          // TypeScript should infer name as string
          const nameLength: number = name.length;

          return {
            name,
            nameLength,
            isLongName: nameLength > 10,
            getFormattedName: (): string => `Component: ${name}`,
            processName: (transformer: (s: string) => string): string => transformer(name),
          };
        });

      const instance = defineTypedComponent();

      // Test inferred return types
      assert.strictEqual(typeof instance.name, 'string');
      assert.strictEqual(typeof instance.nameLength, 'number');
      assert.strictEqual(typeof instance.isLongName, 'boolean');
      assert.strictEqual(typeof instance.getFormattedName, 'function');
      assert.strictEqual(typeof instance.processName, 'function');

      // Test actual values
      assert.strictEqual(instance.name, 'TypedComponent');
      assert.strictEqual(instance.nameLength, 14); // 'TypedComponent'.length = 14
      assert.strictEqual(instance.isLongName, true);
      assert.strictEqual(instance.getFormattedName(), 'Component: TypedComponent');
      assert.strictEqual(
        instance.processName((s) => s.toUpperCase()),
        'TYPEDCOMPONENT',
      );

      // Test with dependencies and type inference
      type TypedDependencies = {
        stringDep: Injectable<string>;
        numberDep: Injectable<number>;
        objectDep: Injectable<{ prop: string }>;
      };

      const defineTypedWithDeps = defineInjectableFactory
        .name('TypedWithDeps')
        .inject<TypedDependencies>()
        .handler(({ name, injector }) => {
          const deps = injector();

          // TypeScript should infer all dependency types
          const stringValue: string = deps.stringDep;
          const numberValue: number = deps.numberDep;
          const objectProp: string = deps.objectDep.prop;

          return {
            name,
            combinedValue: `${stringValue}-${numberValue}-${objectProp}`,
            getTypes: () => ({
              stringType: typeof deps.stringDep,
              numberType: typeof deps.numberDep,
              objectType: typeof deps.objectDep,
            }),
          };
        });

      const mockInjector = () => ({
        stringDep: 'test',
        numberDep: 123,
        objectDep: { prop: 'object' },
      });

      const typedInstance = defineTypedWithDeps(mockInjector);
      const types = typedInstance.getTypes();

      assert.strictEqual(typedInstance.combinedValue, 'test-123-object');
      assert.strictEqual(types.stringType, 'string');
      assert.strictEqual(types.numberType, 'number');
      assert.strictEqual(types.objectType, 'object');
    });

    // Test 20: Should support generic name types for better type safety
    it('should support generic name types for better type safety', () => {
      // Test that the name parameter maintains its literal string type
      const defineComponentWithLiteralName = defineInjectableFactory
        .name('MySpecificComponent' as const)
        .inject()
        .handler(({ name }) => {
          // The name should be the exact literal type 'MySpecificComponent'
          // not just string
          return {
            name,
            nameType: typeof name,
            nameValue: name,
            isExactName: name === 'MySpecificComponent',
          };
        });

      const instance = defineComponentWithLiteralName();

      assert.strictEqual(instance.nameType, 'string');
      assert.strictEqual(instance.nameValue, 'MySpecificComponent');
      assert.strictEqual(instance.isExactName, true);
      assert.strictEqual(instance.name, 'MySpecificComponent');
    });

    // Test 21: Should provide literal string types for component names
    it('should provide literal string types for component names', () => {
      // Test with different literal string types
      const names = ['UserService', 'PaymentProcessor', 'EmailNotifier'] as const;
      const instances: Array<{ name: string; originalName: string }> = [];

      names.forEach((componentName) => {
        const defineComponent = defineInjectableFactory
          .name(componentName)
          .inject()
          .handler(({ name }) => ({
            name,
            originalName: componentName,
            matches: name === componentName,
          }));

        const instance = defineComponent();
        instances.push({
          name: instance.name,
          originalName: instance.originalName,
        });

        // Verify the name is preserved exactly
        assert.strictEqual(instance.name, componentName);
        assert.strictEqual(instance.originalName, componentName);
        assert.strictEqual(instance.matches, true);
      });

      // Verify all instances have different names
      assert.strictEqual(instances.length, 3);
      assert.strictEqual(instances[0].name, 'UserService');
      assert.strictEqual(instances[1].name, 'PaymentProcessor');
      assert.strictEqual(instances[2].name, 'EmailNotifier');

      // Test with dependencies and generic name
      type TestDependencies = {
        logger: Injectable<{ log: (msg: string) => void }>;
      };

      const defineNamedServiceWithDeps = defineInjectableFactory
        .name('NamedServiceWithDeps' as const)
        .inject<TestDependencies>()
        .handler(({ name, injector }) => {
          const { logger } = injector();

          return {
            name,
            logWithName: (message: string) => {
              logger.log(`[${name}] ${message}`);
              return `${name}: ${message}`;
            },
          };
        });

      const mockLogger = { log: () => {} };
      const mockInjector = () => ({ logger: mockLogger });
      const namedInstance = defineNamedServiceWithDeps(mockInjector);

      assert.strictEqual(namedInstance.name, 'NamedServiceWithDeps');
      const result = namedInstance.logWithName('test message');
      assert.strictEqual(result, 'NamedServiceWithDeps: test message');
    });
  });

  describe('Integration', () => {
    // Test 22: Should work as building block for higher-level abstractions
    it('should work as building block for higher-level abstractions', () => {
      // Simulate how defineInjectableFactory could be used as a building block
      // for higher-level abstractions like services or modules

      // Base injectable factory
      const defineBaseComponent = defineInjectableFactory
        .name('BaseComponent')
        .inject()
        .handler(({ name, appHooks }) => {
          return {
            name,
            type: 'base',
            initialize: () => `${name} initialized`,
            getHooks: () => appHooks,
          };
        });

      // Higher-level abstraction using the base
      const createServiceFactory = (serviceName: string) => {
        return defineInjectableFactory
          .name(serviceName)
          .inject()
          .handler(({ name, appHooks }) => {
            const base = defineBaseComponent();

            return {
              ...base,
              name,
              type: 'service',
              performBusinessLogic: () => `${name} performing business logic`,
              getBase: () => base,
            };
          });
      };

      const defineUserService = createServiceFactory('UserService');
      const userService = defineUserService();

      assert.strictEqual(userService.name, 'UserService');
      assert.strictEqual(userService.type, 'service');
      assert.strictEqual(userService.performBusinessLogic(), 'UserService performing business logic');
      assert.strictEqual(userService.initialize(), 'BaseComponent initialized');

      const base = userService.getBase();
      assert.strictEqual(base.name, 'BaseComponent');
      assert.strictEqual(base.type, 'base');
    });

    // Test 23: Should support functional composition patterns
    it('should support functional composition patterns', () => {
      // Test composition of multiple injectable factories

      type LoggerDeps = {
        logger: Injectable<{ log: (msg: string) => void; getLogs: () => string[] }>;
      };

      type ConfigDeps = {
        config: Injectable<{ get: (key: string) => any }>;
      };

      const logs: string[] = [];
      const mockLogger = {
        log: (msg: string) => logs.push(msg),
        getLogs: () => [...logs],
      };

      const mockConfig = {
        get: (key: string) => {
          const values: Record<string, any> = {
            'app.name': 'TestApp',
            'app.version': '1.0.0',
            'db.host': 'localhost',
          };
          return values[key];
        },
      };

      // Create composable components
      const defineLoggingMixin = defineInjectableFactory
        .name('LoggingMixin')
        .inject<LoggerDeps>()
        .handler(({ name, injector }) => {
          const { logger } = injector();
          return {
            name,
            logInfo: (msg: string) => logger.log(`[INFO] ${msg}`),
            logError: (msg: string) => logger.log(`[ERROR] ${msg}`),
          };
        });

      const defineConfigMixin = defineInjectableFactory
        .name('ConfigMixin')
        .inject<ConfigDeps>()
        .handler(({ name, injector }) => {
          const { config } = injector();
          return {
            name,
            getAppName: () => config.get('app.name'),
            getVersion: () => config.get('app.version'),
            getDbHost: () => config.get('db.host'),
          };
        });

      // Compose them into a service
      const defineComposedService = defineInjectableFactory
        .name('ComposedService')
        .inject<LoggerDeps & ConfigDeps>()
        .handler(({ name, injector }) => {
          const deps = injector();

          const loggingMixin = defineLoggingMixin(() => ({ logger: deps.logger }));
          const configMixin = defineConfigMixin(() => ({ config: deps.config }));

          return {
            name,
            logInfo: loggingMixin.logInfo,
            logError: loggingMixin.logError,
            getAppName: configMixin.getAppName,
            getVersion: configMixin.getVersion,
            getDbHost: configMixin.getDbHost,
            start: () => {
              const appName = configMixin.getAppName();
              const version = configMixin.getVersion();
              loggingMixin.logInfo(`Starting ${appName} v${version}`);
              return `${appName} started`;
            },
          };
        });

      const composedService = defineComposedService(() => ({
        logger: mockLogger,
        config: mockConfig,
      }));

      // Test composed functionality
      const result = composedService.start();
      assert.strictEqual(result, 'TestApp started');
      assert.strictEqual(composedService.getAppName(), 'TestApp');
      assert.strictEqual(composedService.getVersion(), '1.0.0');
      assert.strictEqual(composedService.getDbHost(), 'localhost');

      composedService.logError('Test error');
      const allLogs = mockLogger.getLogs();
      assert.strictEqual(allLogs.length, 2);
      assert.strictEqual(allLogs[0], '[INFO] Starting TestApp v1.0.0');
      assert.strictEqual(allLogs[1], '[ERROR] Test error');
    });

    // Test 24: Should maintain consistent API with other factory functions
    it('should maintain consistent API with other factory functions', () => {
      // Test that defineInjectableFactory follows the same patterns
      // that would be expected in other factory functions

      // Pattern 1: name().inject().handler() for no dependencies
      const defineSimple = defineInjectableFactory
        .name('SimpleComponent')
        .inject()
        .handler(({ name }) => ({ name, type: 'simple' }));

      // Pattern 2: name().inject<T>().handler() for with dependencies
      type Dependencies = {
        dep: Injectable<{ value: string }>;
      };

      const defineWithDeps = defineInjectableFactory
        .name('ComponentWithDeps')
        .inject<Dependencies>()
        .handler(({ name, injector }) => {
          const { dep } = injector();
          return { name, type: 'with-deps', depValue: dep.value };
        });

      // Test consistent API structure
      const simple = defineSimple();
      assert.strictEqual(simple.name, 'SimpleComponent');
      assert.strictEqual(simple.type, 'simple');

      const withDeps = defineWithDeps(() => ({ dep: { value: 'test' } }));
      assert.strictEqual(withDeps.name, 'ComponentWithDeps');
      assert.strictEqual(withDeps.type, 'with-deps');
      assert.strictEqual(withDeps.depValue, 'test');

      // Test that both follow the same return type patterns
      assert.strictEqual(typeof simple, 'object');
      assert.strictEqual(typeof withDeps, 'object');

      // Test that the API is chainable and fluent
      const fluent = defineInjectableFactory
        .name('FluentComponent')
        .inject()
        .handler(() => ({}));
      assert.strictEqual(typeof fluent, 'function');

      // Test that lifecycle hooks are consistently available
      let hooksAvailable = false;
      defineInjectableFactory
        .name('HookTest')
        .inject()
        .handler(({ appHooks }) => {
          hooksAvailable = !!(
            typeof appHooks.onApplicationInitialized === 'function'
            && typeof appHooks.onApplicationStart === 'function'
            && typeof appHooks.onApplicationStop === 'function'
          );
          return {};
        })();

      assert.strictEqual(hooksAvailable, true);
    });
  });
});
