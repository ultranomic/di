/**
 * Base error class for all Voxel framework errors.
 *
 * Provides a consistent base for error handling with proper name
 * inheritance and stack trace support.
 */
export abstract class VoxelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
    const ErrorWithCapture = Error as typeof Error & {
      captureStackTrace?: (targetObject: object, constructorOpt?: Function) => void
    }
    if (ErrorWithCapture.captureStackTrace) {
      ErrorWithCapture.captureStackTrace(this, this.constructor)
    }
  }
}
