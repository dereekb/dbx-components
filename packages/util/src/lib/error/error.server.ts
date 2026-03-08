import { type Maybe } from '../value/maybe.type';
import { type ReadableDataError, type StringErrorCode, type CodedError } from './error';

/**
 * The expected error object returned from the server.
 */
export type ServerErrorResponseData = object;

/**
 * Human-readable server error with additional data and a status code.
 */
export interface ServerError<T = ServerErrorResponseData> extends ReadableDataError<T> {
  readonly status: number;
}

/**
 * Type guard that checks if the input is a ServerError (has both status and code properties).
 *
 * @param input - The value to check
 * @returns True if the input is a ServerError
 */
export function isServerError(input: unknown): input is ServerError {
  return typeof input === 'object' && (input as ServerError).status != null && (input as ServerError).code != null;
}

/**
 * Union type for either a plain error message string or a partial server error object.
 */
export type ErrorMessageOrPartialServerError<T = ServerErrorResponseData> = string | Partial<ReadableDataError | ServerError<T>>;

/**
 * Normalizes a string or partial error into a Partial ServerError object.
 * If the input is a string, it becomes the message property.
 *
 * @param messageOrError - A string message or partial server error object
 * @returns A partial ServerError object
 */
export function partialServerError<T = ServerErrorResponseData>(message: string): Partial<ServerError<T>>;
export function partialServerError<T = ServerErrorResponseData>(serverError: Partial<ReadableDataError | ServerError<T>>): Partial<ServerError<T>>;
export function partialServerError<T = ServerErrorResponseData>(messageOrError: Maybe<ErrorMessageOrPartialServerError<T>>): Partial<ServerError<T>>;
export function partialServerError<T = ServerErrorResponseData>(messageOrError: Maybe<ErrorMessageOrPartialServerError<T>>): Partial<ServerError<T>> {
  let serverError: Maybe<Partial<ServerError<T>>>;

  if (typeof messageOrError === 'string') {
    serverError = { message: messageOrError };
  } else {
    serverError = (messageOrError as Partial<ServerError<T>>) ?? {};
  }

  return serverError;
}

/**
 * Configuration for creating a ServerError, combining ServerError and optional CodedError properties.
 */
export interface ServerErrorMakeConfig<T> extends ServerError<T>, Partial<CodedError> {}

/**
 * Creates a ServerError from the given configuration.
 *
 * @param config - The server error configuration
 * @returns A ServerError object
 */
export function serverError<T>(config: ServerErrorMakeConfig<T>): ServerError<T> {
  return {
    ...config,
    data: config.data
  };
}

/**
 * Base server-error class.
 */
export class ServerErrorResponse<T extends ServerErrorResponseData = ServerErrorResponseData> implements ServerError<T> {
  readonly status: number;
  readonly code?: StringErrorCode;
  readonly message?: Maybe<string>;
  readonly data?: T;

  constructor({ code, status, data, message }: ServerError<T>) {
    this.code = code;
    this.message = message;
    this.status = status;
    this.data = data;
  }
}

/**
 * Server error response with a 401 Unauthorized status.
 */
export class UnauthorizedServerErrorResponse extends ServerErrorResponse {
  constructor({ code, data, message }: Partial<ServerError>) {
    super({ status: 401, message: message ?? 'Unauthorized', data, code });
  }
}
