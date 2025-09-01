import { describe, it } from 'node:test';
import assert from 'node:assert';
import { defineModuleFactory, type Module } from './define-module-factory.ts';
import { type Service } from './define-service-factory.ts';

/**
 * Test Plan for defineModuleFactory
 *
 * BASIC FUNCTIONALITY:
 * 1. ✅ Should create module factory returning object
 * 2. ✅ Should create module factory returning void
 * 3. ✅ Should support symbol keys
 * 4. ✅ Should group related functionality
 *
 * DEPENDENCY INJECTION:
 * 5. ✅ Should create module with service dependencies
 * 6. ✅ Should support module composition with other modules
 *
 * LIFECYCLE HOOKS:
 * 7. ✅ Should support lifecycle hooks
 *
 * TYPE CONSTRAINTS:
 * 8. ✅ Should enforce Record or void return types
 * 9. ✅ Should maintain Module type wrapper
 * 10. ✅ Should support complex record types
 *
 * REAL-WORLD PATTERNS:
 * 11. ✅ Should support feature module pattern
 */

describe('defineModuleFactory', () => {
  describe('handler without dependencies', () => {
    it('should create module factory returning object', () => {
      const defineModule = defineModuleFactory
        .name('TestModule')
        .inject()
        .handler(() => ({
          feature1: () => 'feature1 result',
          feature2: () => 'feature2 result',
          sharedUtility: (input: string) => `processed: ${input}`,
        }));

      const result = defineModule();
      assert.strictEqual(result.feature1(), 'feature1 result');
      assert.strictEqual(result.feature2(), 'feature2 result');
      assert.strictEqual(result.sharedUtility('test'), 'processed: test');
    });

    it('should create module factory returning void', () => {
      const defineModule = defineModuleFactory
        .name('VoidModule')
        .inject()
        .handler(() => {
          // void module for side effects only
        });

      const result = defineModule();
      assert.strictEqual(result, undefined);
    });

    it('should support symbol keys', () => {
      const symbolKey = Symbol('feature');

      const defineModule = defineModuleFactory
        .name('SymbolModule')
        .inject()
        .handler(() => ({
          stringFeature: () => 'string result',
          [symbolKey]: () => 'symbol result',
        }));

      const result = defineModule();
      assert.strictEqual(result.stringFeature(), 'string result');
      assert.strictEqual(result[symbolKey](), 'symbol result');
    });

    it('should group related functionality', () => {
      const defineAuthModule = defineModuleFactory
        .name('AuthModule')
        .inject()
        .handler(() => ({
          validateToken: (token: string) => token.length > 10,
          generateToken: () => `token-${Date.now()}`,
          parseToken: (token: string) => ({
            valid: token.startsWith('token-'),
            timestamp: token.split('-')[1],
          }),
          constants: {
            TOKEN_PREFIX: 'token-',
            TOKEN_EXPIRY: 3600000,
          },
        }));

      const module = defineAuthModule();
      const token = module.generateToken();

      assert.ok(module.validateToken(token));
      assert.ok(module.parseToken(token).valid);
      assert.strictEqual(module.constants.TOKEN_PREFIX, 'token-');
    });
  });

  describe('handler with dependencies', () => {
    it('should create module with service dependencies', () => {
      type Dependencies = {
        userService: Service<{ getUser: (id: string) => { id: string; name: string } }>;
        authService: Service<{ validateUser: (id: string) => boolean }>;
      };

      const defineUserModule = defineModuleFactory
        .name('UserModule')
        .inject<Dependencies>()
        .handler(({ injector }) => {
          const { userService, authService } = injector();

          return {
            getUserProfile: (id: string) => {
              if (!authService.validateUser(id)) {
                throw new Error('Unauthorized');
              }
              return userService.getUser(id);
            },

            getUserSummary: (id: string) => {
              const user = userService.getUser(id);
              const isValid = authService.validateUser(id);
              return {
                ...user,
                status: isValid ? 'active' : 'inactive',
              };
            },
          };
        });

      const mockDeps = {
        userService: {
          getUser: (id: string) => ({ id, name: `User ${id}` }),
        },
        authService: {
          validateUser: (id: string) => id === 'valid-user',
        },
      };

      const module = defineUserModule(() => mockDeps);

      const profile = module.getUserProfile('valid-user');
      const summary = module.getUserSummary('invalid-user');

      assert.strictEqual(profile.name, 'User valid-user');
      assert.strictEqual(summary.status, 'inactive');
    });

    it('should support module composition with other modules', () => {
      type UserModule = Module<{
        getUser: (id: string) => { id: string; name: string };
        createUser: (name: string) => { id: string; name: string };
      }>;

      type PostModule = Module<{
        getPost: (id: string) => { id: string; title: string; authorId: string };
        createPost: (title: string, authorId: string) => { id: string; title: string; authorId: string };
      }>;

      type Dependencies = {
        userModule: UserModule;
        postModule: PostModule;
      };

      const defineContentModule = defineModuleFactory
        .name('ContentModule')
        .inject<Dependencies>()
        .handler(({ injector }) => {
          const { userModule, postModule } = injector();

          return {
            getPostWithAuthor: (postId: string) => {
              const post = postModule.getPost(postId);
              const author = userModule.getUser(post.authorId);
              return {
                ...post,
                author,
              };
            },

            createPostWithValidation: (title: string, authorId: string) => {
              // Validate author exists
              const author = userModule.getUser(authorId);
              if (!author) {
                throw new Error('Author not found');
              }

              return postModule.createPost(title, authorId);
            },
          };
        });

      const mockDeps = {
        userModule: {
          getUser: (id: string) => ({ id, name: `User ${id}` }),
          createUser: (name: string) => ({ id: `user-${Date.now()}`, name }),
        },
        postModule: {
          getPost: (id: string) => ({ id, title: `Post ${id}`, authorId: 'user-1' }),
          createPost: (title: string, authorId: string) => ({
            id: `post-${Date.now()}`,
            title,
            authorId,
          }),
        },
      };

      const module = defineContentModule(() => mockDeps);

      const postWithAuthor = module.getPostWithAuthor('post-1');
      assert.strictEqual(postWithAuthor.author.name, 'User user-1');
      assert.strictEqual(postWithAuthor.title, 'Post post-1');
    });

    it('should support lifecycle hooks', () => {
      const moduleEvents: string[] = [];

      const defineModule = defineModuleFactory
        .name('EventModule')
        .inject<{}>()
        .handler(({ injector, appHooks: { onApplicationStart, onApplicationStop } }) => {
          onApplicationStart(() => {
            moduleEvents.push('module-started');
          }, 1);

          onApplicationStop(() => {
            moduleEvents.push('module-stopped');
          }, 1);

          return {
            getEvents: () => [...moduleEvents],
            addEvent: (event: string) => moduleEvents.push(event),
          };
        });

      const result = defineModule(() => ({}));
      result.addEvent('custom-event');

      assert.deepStrictEqual(result.getEvents(), ['custom-event']);
      // Lifecycle events would be fired by the app layer
    });
  });

  describe('module type constraints', () => {
    it('should enforce Record or void return types', () => {
      // These should compile successfully
      const defineRecordModule = defineModuleFactory
        .name('RecordModule')
        .inject()
        .handler(() => ({ key: 'value' }));
      const defineVoidModule = defineModuleFactory
        .name('VoidModule')
        .inject()
        .handler(() => {});

      // Verify they work as expected
      assert.deepStrictEqual(defineRecordModule(), { key: 'value' });
      assert.strictEqual(defineVoidModule(), undefined);
    });

    it('should maintain Module type wrapper', () => {
      const defineModule = defineModuleFactory
        .name('TestModule')
        .inject()
        .handler(() => ({
          method: () => 'result',
        }));

      // The return should be assignable to Module type
      const typedModule: () => Module<{ method: () => string }> = defineModule;
      assert.strictEqual(typedModule().method(), 'result');
    });

    it('should support complex record types', () => {
      const defineComplexModule = defineModuleFactory
        .name('ComplexModule')
        .inject()
        .handler(() => ({
          strings: {
            hello: 'world',
            foo: 'bar',
          },
          numbers: {
            count: 42,
            pi: 3.14159,
          },
          functions: {
            add: (a: number, b: number) => a + b,
            concat: (a: string, b: string) => a + b,
          },
          nested: {
            deep: {
              value: 'deeply nested',
            },
          },
        }));

      const module = defineComplexModule();

      assert.strictEqual(module.strings.hello, 'world');
      assert.strictEqual(module.numbers.count, 42);
      assert.strictEqual(module.functions.add(2, 3), 5);
      assert.strictEqual(module.nested.deep.value, 'deeply nested');
    });
  });

  describe('real-world module patterns', () => {
    it('should support feature module pattern', () => {
      const defineEcommerceModule = defineModuleFactory
        .name('EcommerceModule')
        .inject()
        .handler(() => ({
          cart: {
            items: [] as Array<{ id: string; quantity: number; price: number }>,

            addItem: function (id: string, quantity: number, price: number) {
              this.items.push({ id, quantity, price });
            },

            removeItem: function (id: string) {
              this.items = this.items.filter((item) => item.id !== id);
            },

            getTotal: function () {
              return this.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
            },

            clear: function () {
              this.items = [];
            },
          },

          checkout: {
            calculateTax: (subtotal: number) => subtotal * 0.08,
            calculateShipping: (items: number) => (items > 5 ? 0 : 9.99),

            processOrder: function (cartItems: Array<{ quantity: number; price: number }>) {
              const subtotal = cartItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
              const tax = this.calculateTax(subtotal);
              const shipping = this.calculateShipping(cartItems.length);

              return {
                subtotal,
                tax,
                shipping,
                total: subtotal + tax + shipping,
              };
            },
          },
        }));

      const module = defineEcommerceModule();

      // Test cart functionality
      module.cart.addItem('item1', 2, 10.0);
      module.cart.addItem('item2', 1, 15.0);

      assert.strictEqual(module.cart.getTotal(), 35.0);
      assert.strictEqual(module.cart.items.length, 2);

      // Test checkout functionality
      const order = module.checkout.processOrder(module.cart.items);
      assert.strictEqual(order.subtotal, 35.0);
      assert.ok(Math.abs(order.tax - 2.8) < 0.001); // 8% tax (handle floating point precision)
      assert.strictEqual(order.shipping, 9.99); // < 5 items
    });
  });
});
