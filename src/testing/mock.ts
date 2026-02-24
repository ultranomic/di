/**
 * Mock utilities for testing DI applications
 *
 * The mock() function provides a fluent API for creating mock implementations
 * of providers for use in tests.
 *
 * @example
 * // Create a mock with a custom implementation
 * class UserService {
 *   getUsers() { return [] }
 * }
 * const mockUserService = mock(UserService).use({
 *   getUsers: vi.fn().mockReturnValue(['user1']),
 *   getUser: vi.fn().mockReturnValue({ id: '1', name: 'Test' })
 * })
 *
 * // Use the mock in a test module
 * const module = await Test.createModule({
 *   controllers: [UserController]
 * })
 *   .overrideProvider(UserService, mockUserService)
 *   .compile()
 */

/**
 * MockBuilder provides a fluent API for creating mock implementations
 *
 * @template T - The type of the mock implementation
 */
export class MockBuilder<T> {
  private readonly token: abstract new (...args: unknown[]) => T;

  constructor(token: abstract new (...args: unknown[]) => T) {
    this.token = token;
  }

  /**
   * Specify the mock implementation to use
   *
   * @param implementation - The mock implementation object
   * @returns The mock implementation
   *
   * @example
   * class UserService {}
   * const mockService = mock(UserService).use({
   *   getUsers: () => ['user1'],
   *   createUser: (data) => ({ id: '1', ...data })
   * })
   */
  use(implementation: T): T {
    return implementation;
  }

  /**
   * Get the token this mock is for
   *
   * @returns The token
   */
  getToken(): abstract new (...args: unknown[]) => T {
    return this.token;
  }
}

/**
 * Create a mock builder for a class token
 *
 * This function creates a MockBuilder that can be used to specify
 * a mock implementation for a provider.
 *
 * @template T - The type of the mock implementation
 * @param token - The class token to mock
 * @returns A MockBuilder for creating the mock
 *
 * @example
 * // Create a mock for a class token
 * class Database {
 *   query() { return [] }
 * }
 * const mockDb = mock(Database).use({
 *   query: vi.fn().mockResolvedValue([{ id: 1 }])
 * })
 */
export function mock<T>(token: abstract new (...args: unknown[]) => T): MockBuilder<T> {
  return new MockBuilder(token);
}
