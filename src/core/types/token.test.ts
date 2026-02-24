import { describe, expect, it } from 'vitest';
import type { Token } from './token.ts';

describe('Token types', () => {
  describe('Token', () => {
    it('should accept abstract class tokens', () => {
      abstract class Logger {
        abstract log(message: string): void;
      }
      const classToken: Token<Logger> = Logger;
      expect(classToken).toBe(Logger);
    });

    it('should accept regular class as token', () => {
      class Database {
        connect() {
          return true;
        }
      }
      const classToken: Token<Database> = Database;
      expect(classToken).toBe(Database);
    });

    it('should accept class with constructor parameters', () => {
      class Service {
        constructor(private config: { name: string }) {}
        getName() {
          return this.config.name;
        }
      }
      const classToken: Token<Service> = Service;
      expect(classToken).toBe(Service);
    });
  });

  describe('Token type inference', () => {
    it('should infer type from class token', () => {
      class Service {
        getValue() {
          return 42;
        }
      }

      type ServiceToken = Token<Service>;
      const token: ServiceToken = Service;

      expect(token).toBe(Service);
    });

    it('should preserve type parameter for generic classes', () => {
      abstract class Repository<T> {
        abstract find(id: string): Promise<T | null>;
      }

      type User = { id: string; name: string };
      const userRepoToken: Token<Repository<User>> = Repository;

      expect(userRepoToken).toBe(Repository);
    });
  });
});
