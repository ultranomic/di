import type { Token } from '../types/token.js'
import type { ContainerInterface } from '../container/interfaces.js'

export interface ModuleMetadata {
  imports?: readonly unknown[]
  providers?: readonly unknown[]
  controllers?: readonly unknown[]
  exports?: readonly Token[]
}

export abstract class Module {
  static readonly metadata?: ModuleMetadata

  abstract register(container: ContainerInterface): void
}
