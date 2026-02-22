import { describe, expect, it } from 'vitest'
import type { Token, TokenRegistry } from '../../src/types/token.js'

describe('Token types', () => {
  describe('Token', () => {
    it('should accept string tokens', () => {
      const stringToken: Token = 'Logger'
      expect(stringToken).toBe('Logger')
    })

    it('should accept symbol tokens', () => {
      const symbolToken: Token = Symbol('Database')
      expect(typeof symbolToken).toBe('symbol')
    })

    it('should accept abstract class tokens', () => {
      abstract class Logger {
        abstract log(message: string): void
      }
      const classToken: Token<Logger> = Logger
      expect(classToken).toBe(Logger)
    })

    it('should accept regular class as token', () => {
      class Database {
        connect() {
          return true
        }
      }
      const classToken: Token<Database> = Database
      expect(classToken).toBe(Database)
    })
  })

  describe('TokenRegistry', () => {
    it('should be extendable via declaration merging', () => {
      interface TestRegistry extends TokenRegistry {
        Logger: { log(msg: string): void }
        Database: { query(sql: string): Promise<unknown> }
      }

      type TestToken = keyof TestRegistry
      const tokens: TestToken[] = ['Logger', 'Database']

      expect(tokens).toContain('Logger')
      expect(tokens).toContain('Database')
    })
  })

  describe('Token type inference', () => {
    it('should infer type from class token', () => {
      class Service {
        getValue() {
          return 42
        }
      }

      type ServiceToken = Token<Service>
      const token: ServiceToken = Service

      expect(token).toBe(Service)
    })

    it('should work with generic token', () => {
      const tokens: Token[] = ['StringToken', Symbol('SymbolToken')]

      expect(tokens[0]).toBe('StringToken')
      expect(typeof tokens[1]).toBe('symbol')
    })
  })
})
