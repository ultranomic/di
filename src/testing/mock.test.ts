import { describe, expect, it } from 'vitest';
import { mock, MockBuilder } from './mock.ts';

describe('mock', () => {
  describe('mock function', () => {
    it('should create a MockBuilder for a string token', () => {
      const builder = mock('Logger');
      expect(builder).toBeInstanceOf(MockBuilder);
    });

    it('should create a MockBuilder for a symbol token', () => {
      const token = Symbol('Database');
      const builder = mock(token);
      expect(builder).toBeInstanceOf(MockBuilder);
    });

    it('should create a MockBuilder for a class token', () => {
      abstract class ServiceBase {}
      const builder = mock(ServiceBase);
      expect(builder).toBeInstanceOf(MockBuilder);
    });
  });

  describe('MockBuilder', () => {
    describe('use', () => {
      it('should return the provided implementation', () => {
        const implementation = {
          log: (_msg: string) => {},
          error: (_msg: string) => {},
        };

        const result = mock('Logger').use(implementation);

        expect(result).toBe(implementation);
      });

      it('should return the implementation with methods', () => {
        const mockService = mock<{ getUsers: () => string[]; getUser: (id: string) => { id: string; name: string } }>(
          'UserService',
        ).use({
          getUsers: () => ['user1', 'user2'],
          getUser: (id: string) => ({ id, name: 'Test' }),
        });

        expect(mockService.getUsers()).toEqual(['user1', 'user2']);
        expect(mockService.getUser('1')).toEqual({ id: '1', name: 'Test' });
      });

      it('should work with function implementations', () => {
        const mockFn = mock<(req: unknown) => { status: number }>('Handler').use((_req: unknown) => ({ status: 200 }));

        expect(mockFn({})).toEqual({ status: 200 });
      });
    });

    describe('getToken', () => {
      it('should return the string token', () => {
        const builder = mock('Logger');
        expect(builder.getToken()).toBe('Logger');
      });

      it('should return the symbol token', () => {
        const token = Symbol('Database');
        const builder = mock(token);
        expect(builder.getToken()).toBe(token);
      });

      it('should return the class token', () => {
        abstract class ServiceBase {}
        const builder = mock(ServiceBase);
        expect(builder.getToken()).toBe(ServiceBase);
      });
    });
  });

  describe('type inference', () => {
    it('should infer types from implementation', () => {
      interface UserService {
        getUsers(): string[];
        getUser(id: string): { id: string; name: string };
      }

      const mockUserService = mock<UserService>('UserService').use({
        getUsers: () => ['user1'],
        getUser: (id: string) => ({ id, name: 'Test' }),
      });

      const users = mockUserService.getUsers();
      const user = mockUserService.getUser('1');

      expect(users).toEqual(['user1']);
      expect(user).toEqual({ id: '1', name: 'Test' });
    });
  });
});
