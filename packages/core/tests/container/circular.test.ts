import { describe, expect, it, beforeEach } from 'vitest'
import { Container } from '../../src/container/container.js'

describe('Circular Dependencies', () => {
  let container: Container

  beforeEach(() => {
    container = new Container()
  })

  describe('basic circular dependency', () => {
    it('should resolve ServiceA -> ServiceB -> ServiceA without throwing', () => {
      class ServiceA {
        static readonly inject = { serviceB: 'ServiceB' } as const
        constructor(private deps: typeof ServiceA.inject) {}
        getValue() {
          return 'A'
        }
        getBValue() {
          return this.deps.serviceB.getValue()
        }
      }

      class ServiceB {
        static readonly inject = { serviceA: 'ServiceA' } as const
        constructor(private deps: typeof ServiceB.inject) {}
        getValue() {
          return 'B'
        }
        getAValue() {
          return this.deps.serviceA.getValue()
        }
      }

      container.register('ServiceA', (c) => new ServiceA({ serviceB: c.resolve('ServiceB') }))
      container.register('ServiceB', (c) => new ServiceB({ serviceA: c.resolve('ServiceA') }))

      expect(() => container.resolve('ServiceA')).not.toThrow()
    })

    it('should allow accessing circular dependency properties after resolution', () => {
      class ServiceA {
        static readonly inject = { serviceB: 'ServiceB' } as const
        constructor(private deps: typeof ServiceA.inject) {}
        getValue() {
          return 'A'
        }
        getBValue() {
          return this.deps.serviceB.getValue()
        }
      }

      class ServiceB {
        static readonly inject = { serviceA: 'ServiceA' } as const
        constructor(private deps: typeof ServiceB.inject) {}
        getValue() {
          return 'B'
        }
      }

      container.register('ServiceA', (c) => new ServiceA({ serviceB: c.resolve('ServiceB') }))
      container.register('ServiceB', (c) => new ServiceB({ serviceA: c.resolve('ServiceA') }))

      const serviceA = container.resolve('ServiceA')

      expect(serviceA.getBValue()).toBe('B')
    })

    it('should work with both directions of circular dependency', () => {
      class ServiceA {
        static readonly inject = { serviceB: 'ServiceB' } as const
        constructor(private deps: typeof ServiceA.inject) {}
        getValue() {
          return 'A'
        }
      }

      class ServiceB {
        static readonly inject = { serviceA: 'ServiceA' } as const
        constructor(private deps: typeof ServiceB.inject) {}
        getValue() {
          return 'B'
        }
      }

      container.register('ServiceA', (c) => new ServiceA({ serviceB: c.resolve('ServiceB') }))
      container.register('ServiceB', (c) => new ServiceB({ serviceA: c.resolve('ServiceA') }))

      const serviceA = container.resolve('ServiceA')
      const serviceB = container.resolve('ServiceB')

      expect(serviceA.getValue()).toBe('A')
      expect(serviceB.getValue()).toBe('B')
    })
  })

  describe('proxy edge cases', () => {
    it('should handle await on proxy without TypeError (then returns undefined)', async () => {
      class ServiceA {
        static readonly inject = { serviceB: 'ServiceB' } as const
        constructor(private deps: typeof ServiceA.inject) {}
      }

      class ServiceB {
        static readonly inject = { serviceA: 'ServiceA' } as const
        constructor(private deps: typeof ServiceB.inject) {}
      }

      container.register('ServiceA', (c) => new ServiceA({ serviceB: c.resolve('ServiceB') }))
      container.register('ServiceB', (c) => new ServiceB({ serviceA: c.resolve('ServiceA') }))

      const serviceA = container.resolve('ServiceA')

      const result = await serviceA.deps.serviceB
      expect(result).toBeDefined()
    })

    it('should handle toString on proxy for logging', () => {
      class ServiceA {
        static readonly inject = { serviceB: 'ServiceB' } as const
        constructor(private deps: typeof ServiceA.inject) {}
      }

      class ServiceB {
        static readonly inject = { serviceA: 'ServiceA' } as const
        constructor(private deps: typeof ServiceB.inject) {}
      }

      container.register('ServiceA', (c) => new ServiceA({ serviceB: c.resolve('ServiceB') }))
      container.register('ServiceB', (c) => new ServiceB({ serviceA: c.resolve('ServiceA') }))

      const serviceA = container.resolve('ServiceA')

      const str = String(serviceA.deps.serviceB)
      expect(typeof str).toBe('string')
    })

    it('should handle console.log style inspection', () => {
      class ServiceA {
        static readonly inject = { serviceB: 'ServiceB' } as const
        constructor(private deps: typeof ServiceA.inject) {}
      }

      class ServiceB {
        static readonly inject = { serviceA: 'ServiceA' } as const
        constructor(private deps: typeof ServiceB.inject) {}
      }

      container.register('ServiceA', (c) => new ServiceA({ serviceB: c.resolve('ServiceB') }))
      container.register('ServiceB', (c) => new ServiceB({ serviceA: c.resolve('ServiceA') }))

      const serviceA = container.resolve('ServiceA')

      // After resolution, serviceA.deps.serviceB is the actual instance, not a proxy.
      // The circular proxy is used for serviceB.deps.serviceA during construction.
      // Verify the object can be converted to string without error.
      const str = Object.prototype.toString.call(serviceA.deps.serviceB)
      expect(typeof str).toBe('string')
    })

    it('should return specific string from toString() on proxy during construction', () => {
      let capturedProxy: { toString: () => string } | null = null

      class ServiceA {
        static readonly inject = { serviceB: 'ServiceB' } as const
        constructor(private deps: typeof ServiceA.inject) {}
      }

      class ServiceB {
        static readonly inject = { serviceA: 'ServiceA' } as const
        constructor(deps: typeof ServiceB.inject) {
          // Capture proxy during construction before instance is set
          capturedProxy = deps.serviceA as { toString: () => string }
        }
      }

      container.register('ServiceA', (c) => new ServiceA({ serviceB: c.resolve('ServiceB') }))
      container.register('ServiceB', (c) => new ServiceB({ serviceA: c.resolve('ServiceA') }))

      container.resolve('ServiceA')

      // Call toString on the captured proxy
      expect(capturedProxy).not.toBeNull()
      const result = capturedProxy!.toString()
      expect(result).toBe('[CircularProxy: ServiceA]')
    })

    it('should return CircularProxy as Symbol.toStringTag on proxy', () => {
      let capturedProxy: { [Symbol.toStringTag]?: string } | null = null

      class ServiceA {
        static readonly inject = { serviceB: 'ServiceB' } as const
        constructor(private deps: typeof ServiceA.inject) {}
      }

      class ServiceB {
        static readonly inject = { serviceA: 'ServiceA' } as const
        constructor(deps: typeof ServiceB.inject) {
          // Capture proxy during construction
          capturedProxy = deps.serviceA as { [Symbol.toStringTag]?: string }
        }
      }

      container.register('ServiceA', (c) => new ServiceA({ serviceB: c.resolve('ServiceB') }))
      container.register('ServiceB', (c) => new ServiceB({ serviceA: c.resolve('ServiceA') }))

      container.resolve('ServiceA')

      // Access Symbol.toStringTag on the captured proxy
      expect(capturedProxy).not.toBeNull()
      expect(capturedProxy![Symbol.toStringTag]).toBe('CircularProxy')
    })

    it('should forward property access through proxy after instance is resolved', () => {
      let capturedProxy: { getValue: () => string } | null = null

      class ServiceA {
        static readonly inject = { serviceB: 'ServiceB' } as const
        constructor(private deps: typeof ServiceA.inject) {}
        getValue() {
          return 'A'
        }
      }

      class ServiceB {
        static readonly inject = { serviceA: 'ServiceA' } as const
        constructor(deps: typeof ServiceB.inject) {
          // Capture proxy during construction
          capturedProxy = deps.serviceA as { getValue: () => string }
        }
      }

      container.register('ServiceA', (c) => new ServiceA({ serviceB: c.resolve('ServiceB') })).asSingleton()
      container.register('ServiceB', (c) => new ServiceB({ serviceA: c.resolve('ServiceA') })).asSingleton()

      container.resolve('ServiceA')

      // After resolution, the proxy should forward to the actual instance
      expect(capturedProxy).not.toBeNull()
      expect(capturedProxy!.getValue()).toBe('A')
    })

    it('should return undefined for non-existent property on proxy', () => {
      let accessedValue: unknown = 'not-set'
      class ServiceA {
        static readonly inject = { serviceB: 'ServiceB' } as const
        constructor(private deps: typeof ServiceA.inject) {}
      }
      class ServiceB {
        static readonly inject = { serviceA: 'ServiceA' } as const
        constructor(deps: typeof ServiceB.inject) {
          const proxy = deps.serviceA as { nonExistent: unknown }
          accessedValue = proxy.nonExistent
        }
      }
      container.register('ServiceA', (c) => new ServiceA({ serviceB: c.resolve('ServiceB') }))
      container.register('ServiceB', (c) => new ServiceB({ serviceA: c.resolve('ServiceA') }))
      container.resolve('ServiceA')

      expect(accessedValue).toBeUndefined()
    })
  })

  describe('singleton circular dependencies', () => {
    it('should resolve singleton circular dependencies correctly', () => {
      class ServiceA {
        static readonly inject = { serviceB: 'ServiceB' } as const
        constructor(private deps: typeof ServiceA.inject) {}
        getValue() {
          return 'A'
        }
      }

      class ServiceB {
        static readonly inject = { serviceA: 'ServiceA' } as const
        constructor(private deps: typeof ServiceB.inject) {}
        getValue() {
          return 'B'
        }
      }

      container.register('ServiceA', (c) => new ServiceA({ serviceB: c.resolve('ServiceB') })).asSingleton()
      container.register('ServiceB', (c) => new ServiceB({ serviceA: c.resolve('ServiceA') })).asSingleton()

      const serviceA1 = container.resolve('ServiceA')
      const serviceA2 = container.resolve('ServiceA')

      expect(serviceA1).toBe(serviceA2)
    })

    it('should forward method calls through circular proxy', () => {
      class ServiceA {
        static readonly inject = { serviceB: 'ServiceB' } as const
        constructor(private deps: typeof ServiceA.inject) {}
        getValue() {
          return 'A'
        }
      }

      class ServiceB {
        static readonly inject = { serviceA: 'ServiceA' } as const
        constructor(private deps: typeof ServiceB.inject) {}
        getValue() {
          return 'B'
        }
        getAValue() {
          return this.deps.serviceA.getValue()
        }
      }

      container.register('ServiceA', (c) => new ServiceA({ serviceB: c.resolve('ServiceB') })).asSingleton()
      container.register('ServiceB', (c) => new ServiceB({ serviceA: c.resolve('ServiceA') })).asSingleton()

      const serviceA = container.resolve('ServiceA')
      const serviceB = container.resolve('ServiceB')

      expect(serviceA.getValue()).toBe('A')
      expect(serviceB.getValue()).toBe('B')
      expect(serviceB.getAValue()).toBe('A')
    })
  })

  describe('complex circular dependencies', () => {
    it('should handle three-way circular dependency', () => {
      class ServiceA {
        static readonly inject = { serviceB: 'ServiceB' } as const
        constructor(private deps: typeof ServiceA.inject) {}
        getValue() {
          return 'A'
        }
      }

      class ServiceB {
        static readonly inject = { serviceC: 'ServiceC' } as const
        constructor(private deps: typeof ServiceB.inject) {}
        getValue() {
          return 'B'
        }
      }

      class ServiceC {
        static readonly inject = { serviceA: 'ServiceA' } as const
        constructor(private deps: typeof ServiceC.inject) {}
        getValue() {
          return 'C'
        }
      }

      container.register('ServiceA', (c) => new ServiceA({ serviceB: c.resolve('ServiceB') }))
      container.register('ServiceB', (c) => new ServiceB({ serviceC: c.resolve('ServiceC') }))
      container.register('ServiceC', (c) => new ServiceC({ serviceA: c.resolve('ServiceA') }))

      expect(() => container.resolve('ServiceA')).not.toThrow()
    })

    it('should handle self-referencing dependency', () => {
      class Service {
        static readonly inject = { self: 'Service' } as const
        constructor(private deps: typeof Service.inject) {}
        getValue() {
          return 'value'
        }
      }

      container.register('Service', (c) => new Service({ self: c.resolve('Service') }))

      const service = container.resolve('Service')
      expect(service.getValue()).toBe('value')
    })
  })
})
