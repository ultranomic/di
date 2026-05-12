export const DI_ERROR_CODE = {
  CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',
  MISSING_PROVIDER: 'MISSING_PROVIDER',
  EXPORT_NOT_IN_PROVIDERS: 'EXPORT_NOT_IN_PROVIDERS',
  EXPORT_NOT_IN_IMPORTS: 'EXPORT_NOT_IN_IMPORTS',
  SCOPE_VIOLATION: 'SCOPE_VIOLATION',
  NOT_IN_REQUEST_SCOPE: 'NOT_IN_REQUEST_SCOPE',
  CONTAINER_STOPPED: 'CONTAINER_STOPPED',
  CONTAINER_NOT_STARTED: 'CONTAINER_NOT_STARTED',
  ALREADY_STARTED: 'ALREADY_STARTED',
  UNKNOWN_SCOPE: 'UNKNOWN_SCOPE',
  DUPLICATE_PROVIDER: 'DUPLICATE_PROVIDER',
} as const;

export type DIErrorCode = (typeof DI_ERROR_CODE)[keyof typeof DI_ERROR_CODE];

/** Typed error with a `code` discriminator for programmatic error handling in the DI system. */
export class DIError extends Error {
  #code: DIErrorCode;
  public get code(): DIErrorCode {
    return this.#code;
  }
  public constructor(code: DIErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.#code = code;
    this.name = 'DIError';
  }
}
