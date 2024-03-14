import { type Maybe } from '../value/maybe.type';
import { type ReadableError, type ReadableDataError, type StringErrorCode, type CodedError } from './error';

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

export function isServerError(input: unknown): input is ServerError {
  return typeof input === 'object' && (input as ServerError).status != null && (input as ServerError).code != null;
}

export type ErrorMessageOrPartialServerError<T = ServerErrorResponseData> = string | Partial<ReadableDataError | ServerError<T>>;

/**
 * Converts the input to a Partial ServerError
 *
 * @param message
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

export interface ServerErrorMakeConfig<T> extends ServerError<T>, Partial<CodedError> {}

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

export class UnauthorizedServerErrorResponse extends ServerErrorResponse {
  constructor({ code, data, message }: Partial<ServerError>) {
    super({ status: 401, message: message ?? 'Unauthorized', data, code });
  }
}
