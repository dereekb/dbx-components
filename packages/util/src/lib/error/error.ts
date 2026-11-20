import { BaseError } from 'make-error';
import { escapeStringForRegex } from '../string/replace';
import { type Maybe } from '../value/maybe.type';

/**
 * Generic function that is meant to throw an error if the input is known. Returns void otherwise.
 */
export type ThrowErrorFunction<T = unknown> = (error: T) => never | void;

/**
 * A unique identifier for a specific error.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
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
 * @param error - A ReadableError or error code string to check.
 * @returns True if the error uses the default code or has no code.
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
 * @param code - The error code.
 * @param message - Optional human-readable error message.
 * @returns A ReadableErrorWithCode object.
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
  readonly data?: T | undefined;
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
 * @param input - Error-shaped value or message string to inspect; nullish short-circuits to false.
 * @param target - Substring that must appear in the resolved error message.
 * @returns True when the error message includes `target`.
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
 * @param target - Substring that must appear in the resolved error message.
 * @returns Reusable predicate that yields true when the inspected error contains `target`.
 *
 * @dbxUtil
 * @dbxUtilCategory error
 * @dbxUtilKind factory
 * @dbxUtilTags error, message, contains, factory, predicate, regex
 * @dbxUtilRelated escape-string-for-regex
 *
 * @__NO_SIDE_EFFECTS__
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
 * @param input - The error or string to extract a message from.
 * @returns The error message string, or null/undefined if not available.
 */
export function messageFromError(input: Maybe<ErrorInput | string>): Maybe<string> {
  return (typeof input === 'object' ? (input as ReadableError).message : input) ?? (input as Maybe<string>);
}

/**
 * Reads a human-readable message from any thrown value, never throwing.
 *
 * - An `Error` (including `DOMException`) yields its `message`.
 * - Any other non-null object whose `message` is a string (a {@link ReadableError}-like or cross-realm error) yields that message.
 * - Anything else yields `String(error)`; when `String()` itself throws (a null-prototype object or a throwing `toString`),
 *   it falls back to `Object.prototype.toString.call(error)`.
 *
 * This is the `unknown → string` sibling of {@link messageFromError}, for catch blocks whose caught value is `unknown`.
 *
 * @param error - The caught value to read a message from.
 * @returns The message text; never null or undefined.
 *
 * @dbxUtil
 * @dbxUtilCategory error
 * @dbxUtilTags error, message, unknown, catch, text, string
 * @dbxUtilRelated message-from-error
 *
 * @example
 * ```ts
 * readErrorMessage(new Error('boom')); // 'boom'
 * readErrorMessage({ message: 'readable' }); // 'readable'
 * readErrorMessage('plain'); // 'plain'
 * readErrorMessage(undefined); // 'undefined'
 * ```
 */
export function readErrorMessage(error: unknown): string {
  let message: string;

  if (error instanceof Error) {
    message = error.message;
  } else if (error != null && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    message = (error as { message: string }).message;
  } else {
    try {
      message = String(error);
    } catch {
      message = Object.prototype.toString.call(error);
    }
  }

  return message;
}

/**
 * Every constructor NAME on a thrown value's prototype chain, leaf first, stopping at `Object.prototype` — a STRUCTURAL
 * identity for error classes that never set `.name` (the `openai` SDK's, whose every instance reads
 * `.name === 'Error'`), matched without importing them.
 *
 * Matching an ANCESTOR's name makes a future subclass match by inheritance, the way `instanceof` would, with zero
 * imports. The leaf name alone is not enough: a subclass such as `APIConnectionTimeoutError` extends
 * `APIConnectionError`, and a leaf-only check lets the parent's other subclasses fall through.
 *
 * Minified bundles that mangle class names defeat it; a `.name` the class sets itself survives minification, so a
 * classifier usually checks `.name` too.
 *
 * @param error - The thrown value.
 * @returns The chain's constructor names, leaf first. Empty for a non-object or a null-prototype object.
 *
 * @dbxUtil
 * @dbxUtilCategory error
 * @dbxUtilTags error, class, name, prototype, instanceof, structural, constructor
 *
 * @example
 * ```ts
 * class HttpError extends Error {}
 * class RateLimitError extends HttpError {}
 *
 * errorClassNames(new RateLimitError()); // ['RateLimitError', 'HttpError', 'Error']
 * errorClassNames('boom'); // []
 * ```
 */
export function errorClassNames(error: unknown): string[] {
  const names: string[] = [];

  if (error != null && typeof error === 'object') {
    let proto: Maybe<object> = Object.getPrototypeOf(error) as Maybe<object>;

    while (proto != null && proto !== Object.prototype) {
      const className = (proto as { readonly constructor?: { readonly name?: unknown } }).constructor?.name;

      if (typeof className === 'string' && className !== '') {
        names.push(className);
      }

      proto = Object.getPrototypeOf(proto) as Maybe<object>;
    }
  }

  return names;
}
