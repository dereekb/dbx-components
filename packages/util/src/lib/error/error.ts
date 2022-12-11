import { BaseError } from 'make-error';
import { escapeStringForRegex } from '../string/replace';
import { Maybe } from '../value/maybe.type';

/**
 * A unique identifier for a specific error.
 */
export type StringErrorCode = string;

export const DEFAULT_READABLE_ERROR_CODE = 'ERROR';

/**
 * An error that is identified by a unique code.
 */
export interface CodedError {
  code: StringErrorCode;
  /**
   * The original error, if available.
   */
  _error?: unknown;
}

/**
 * An error with a human-readable message.
 */
export interface ReadableError extends Partial<CodedError> {
  message?: Maybe<string>;
}

export function isDefaultReadableError(error: Maybe<ReadableError | StringErrorCode>) {
  const code = typeof error === 'object' ? error?.code : error;
  return !code || code === DEFAULT_READABLE_ERROR_CODE;
}

export type ReadableErrorWithCode<T extends ReadableError = ReadableError> = T & CodedError;

export function readableError(code: StringErrorCode, message?: string): ReadableErrorWithCode {
  return {
    code,
    message
  };
}

export interface ReadableDataError<T = unknown> extends ReadableError {
  data?: T;
}

export interface ErrorWrapper {
  data: ReadableError | CodedError;
}

export type ErrorInput = ErrorWrapper | CodedError | ReadableError | ReadableDataError;

/**
 * Converts the input error content to a ReadableError or CodedError.
 *
 * @param inputError
 * @returns
 */
export function toReadableError(inputError: Maybe<ErrorInput>): Maybe<CodedError | ReadableErrorWithCode> {
  let error: Maybe<ReadableErrorWithCode>;

  if (inputError) {
    if ((inputError as CodedError).code) {
      error = {
        ...(inputError as ReadableErrorWithCode)
      };
    } else if ((inputError as ErrorWrapper).data) {
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
        message: (inputError as ReadableError).message || '',
        _error: inputError
      };
    }
  }

  return error;
}

export function errorMessageContainsString(input: Maybe<ErrorInput | string>, target: string): boolean {
  return input ? errorMessageContainsStringFunction(target)(input) : false;
}

export type ErrorMessageContainsStringFunction = (input: Maybe<ErrorInput | string>) => boolean;

export function errorMessageContainsStringFunction(target: string): ErrorMessageContainsStringFunction {
  const regex = new RegExp(escapeStringForRegex(target));

  return (input: Maybe<ErrorInput | string>) => {
    const message: Maybe<string> = messageFromError(input);
    return message ? regex.test(message) : false;
  };
}

export function messageFromError(input: Maybe<ErrorInput | string>): Maybe<string> {
  return (typeof input === 'object' ? (input as ReadableError).message : input) || (input as string | undefined | null);
}
