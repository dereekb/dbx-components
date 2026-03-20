import { BaseError } from 'make-error';
import { escapeStringForRegex } from '../string/replace';
import { type Maybe } from '../value/maybe.type';

/**
 * Generic function that is meant to throw an error if the input is known. Returns void otherwise.
 */
export type ThrowErrorFunction<T = unknown> = (error: T) => never | void;

/**
 * A unique identifier for a specific error.
 */
export type StringErrorCode = string;

/**
 * Default error code used when no specific code is provided.
 */
export const DEFAULT_READABLE_ERROR_CODE = 'ERROR';

/**
 * An error that is identified by a unique code.
 */
export interface CodedError {
  readonly code: StringErrorCode;
  /**
   * The original error, if available.
   */
  readonly _error?: unknown;
}

/**
 * An error with a human-readable message.
 */
export interface ReadableError extends Partial<CodedError> {
  readonly message?: Maybe<string>;
}

/**
 * Checks if the error has the default error code or no code at all.
 *
 * @param error - A ReadableError or error code string to check
 * @returns True if the error uses the default code or has no code
 */
export function isDefaultReadableError(error: Maybe<ReadableError | StringErrorCode>) {
  const code = typeof error === 'object' ? error?.code : error;
  return !code || code === DEFAULT_READABLE_ERROR_CODE;
}

/**
 * A ReadableError that is guaranteed to have a code.
 */
export type ReadableErrorWithCode<T extends ReadableError = ReadableError> = T & CodedError;

/**
 * Creates a ReadableError with a code and optional message.
 *
 * @param code - The error code
 * @param message - Optional human-readable error message
 * @returns A ReadableErrorWithCode object
 */
export function readableError(code: StringErrorCode, message?: string): ReadableErrorWithCode {
  return {
    code,
    message
  };
}

/**
 * A ReadableError that includes additional data of type T.
 */
export interface ReadableDataError<T = unknown> extends ReadableError {
  readonly data?: T;
}

/**
 * Wrapper around an error that contains the error data.
 */
export interface ErrorWrapper {
  readonly data: ReadableError | CodedError;
}

/**
 * Union of all supported error input types for conversion functions.
 */
export type ErrorInput = ErrorWrapper | CodedError | ReadableError | ReadableDataError;

/**
 * Converts various error input formats to a normalized ReadableErrorWithCode.
 * Handles CodedError, ErrorWrapper, BaseError, and plain ReadableError inputs.
 *
 * @param inputError - The error to convert
 * @returns A normalized ReadableErrorWithCode
 */
export function toReadableError(inputError: ErrorInput): CodedError | ReadableErrorWithCode;
export function toReadableError(inputError: Maybe<ErrorInput>): Maybe<CodedError | ReadableErrorWithCode>;
export function toReadableError(inputError: Maybe<ErrorInput>): Maybe<CodedError | ReadableErrorWithCode> {
  let error: Maybe<ReadableErrorWithCode>;

  if (inputError) {
    if ('code' in inputError && (inputError as CodedError).code) {
      error = inputError as CodedError;
    } else if ('data' in inputError) {
      error = {
        code: DEFAULT_READABLE_ERROR_CODE,
        ...(inputError as ErrorWrapper).data
      };
    } else if (inputError instanceof BaseError) {
      error = {
        code: inputError.name,
        message: inputError.message,
        _error: inputError
      };
    } else {
      error = {
        code: DEFAULT_READABLE_ERROR_CODE,
        message: (inputError as ReadableError).message ?? '',
        _error: inputError
      };
    }
  }

  return error;
}

/**
 * Checks if an error's message contains the target string.
 *
 * @param input - The error or string to check
 * @param target - The string to search for in the error message
 * @returns True if the error message contains the target string
 */
export function errorMessageContainsString(input: Maybe<ErrorInput | string>, target: string): boolean {
  return input ? errorMessageContainsStringFunction(target)(input) : false;
}

/**
 * Function that checks if an error's message contains a specific string.
 */
export type ErrorMessageContainsStringFunction = (input: Maybe<ErrorInput | string>) => boolean;

/**
 * Creates a function that checks if an error's message contains the target string.
 *
 * @param target - The string to search for
 * @returns A function that checks error messages for the target string
 */
export function errorMessageContainsStringFunction(target: string): ErrorMessageContainsStringFunction {
  const regex = new RegExp(escapeStringForRegex(target));

  return (input: Maybe<ErrorInput | string>) => {
    const message: Maybe<string> = messageFromError(input);
    return message ? regex.test(message) : false;
  };
}

/**
 * Extracts the message string from an error or returns the input if it's already a string.
 *
 * @param input - The error or string to extract a message from
 * @returns The error message string, or null/undefined if not available
 */
export function messageFromError(input: Maybe<ErrorInput | string>): Maybe<string> {
  return (typeof input === 'object' ? (input as ReadableError).message : input) ?? (input as string | undefined | null);
}
