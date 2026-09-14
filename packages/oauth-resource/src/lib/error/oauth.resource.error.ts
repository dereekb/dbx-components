import { type CodedError, type Maybe } from '@dereekb/util';
import { BaseError } from 'make-error';

// MARK: Types
/**
 * Stable error code raised by the resource-server verification layer.
 *
 * `unauthorized` maps to a 401 (the token is missing / malformed / untrusted / invalid) and
 * `forbidden` to a 403 (the token verified but failed a policy gate). The distinction is what
 * selects the RFC 6750 challenge's `error` token — see {@link bearerChallengeErrorForCode}.
 */
export type OAuthResourceErrorCode = 'unauthorized' | 'forbidden';

/**
 * HTTP status paired with each {@link OAuthResourceErrorCode}.
 */
export const OAUTH_RESOURCE_ERROR_STATUS_CODES: Readonly<Record<OAuthResourceErrorCode, number>> = {
  unauthorized: 401,
  forbidden: 403
};

export interface OAuthResourceErrorInput {
  readonly code: OAuthResourceErrorCode;
  readonly message: string;
  /**
   * HTTP status. Defaults to the status paired with `code` in {@link OAUTH_RESOURCE_ERROR_STATUS_CODES}.
   */
  readonly status?: Maybe<number>;
  /**
   * Extra machine-readable context carried onto the error envelope.
   */
  readonly details?: Maybe<Record<string, unknown>>;
}

/**
 * The default JSON body emitted for a rejected request.
 */
export interface OAuthResourceErrorEnvelope {
  readonly error: {
    readonly code: OAuthResourceErrorCode;
    readonly message: string;
    readonly details?: Record<string, unknown>;
  };
}

// MARK: Error
/**
 * Error raised when a bearer token fails verification or a policy gate.
 *
 * Consumers that already have their own API error type do not have to catch and re-wrap this one:
 * pass an {@link OAuthResourceErrorFactory} on the verification options and the verifier throws
 * that type instead.
 */
export class OAuthResourceError extends BaseError implements CodedError {
  readonly code: OAuthResourceErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(input: OAuthResourceErrorInput) {
    super(input.message);
    this.code = input.code;
    this.status = input.status ?? OAUTH_RESOURCE_ERROR_STATUS_CODES[input.code];

    if (input.details != null) {
      this.details = input.details;
    }
  }

  /**
   * Builds the default JSON error body for this error.
   *
   * @returns The error envelope.
   */
  toEnvelope(): OAuthResourceErrorEnvelope {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details == null ? {} : { details: this.details })
      }
    };
  }
}

// MARK: Factory
/**
 * Creates the error thrown when verification fails.
 *
 * The seam that keeps this package error-type agnostic: supply one to map every rejection onto an
 * app's own error type (and therefore its own response envelope).
 */
export type OAuthResourceErrorFactory = (input: OAuthResourceErrorInput) => Error;

/**
 * Default {@link OAuthResourceErrorFactory}, producing an {@link OAuthResourceError}.
 *
 * @param input - The code, message, status, and details of the failure.
 * @returns The error to throw.
 */
export const defaultOAuthResourceErrorFactory: OAuthResourceErrorFactory = (input: OAuthResourceErrorInput) => new OAuthResourceError(input);

/**
 * Returns true when the input is an {@link OAuthResourceError}.
 *
 * @param error - The value to test.
 * @returns Whether the value is an {@link OAuthResourceError}.
 */
export function isOAuthResourceError(error: unknown): error is OAuthResourceError {
  return error instanceof OAuthResourceError;
}
