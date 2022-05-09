import { BaseError } from 'make-error';
import { Maybe } from '../value/maybe';

/**
 * A unique identifier for a specific error.
 */
export type StringErrorCode = string;

/**
 * An error that is identified by a unique code.
 */
export interface CodedError {
  code: StringErrorCode;
}

/**
 * An error with a human-readable message.
 */
export interface ReadableError extends Partial<CodedError> {
  message?: Maybe<string>;
}

export function readableError(code: StringErrorCode, message?: string) {
  return {
    code,
    message
  };
}

export interface ReadableDataError<T = any> extends ReadableError {
  data?: T;
}

export interface ErrorWrapper {
  data: ReadableError | CodedError;
}

export type ErrorInput = ErrorWrapper | CodedError | ReadableError;

/**
 * Converts the input error content to a ReadableError or CodedError.
 * 
 * @param inputError 
 * @returns 
 */
export function convertToReadableError(inputError: ErrorInput | undefined): CodedError | ReadableError | undefined {
  let error: CodedError | ReadableError | undefined;

  if (inputError) {
    if ((inputError as CodedError).code) {
      error = inputError as ReadableError;
    } else if ((inputError as ErrorWrapper).data) {
      error = (inputError as ErrorWrapper).data as ReadableError;
    } else if (inputError instanceof BaseError) {
      error = {
        code: (inputError as any).code || inputError.name,
        message: inputError.message
      };
    } else {
      error = {
        code: 'ERROR',
        message: (inputError as any).message || ''
      };
    }
  }

  return error;
}
