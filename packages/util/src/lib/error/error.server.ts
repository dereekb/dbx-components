import { Maybe } from '../value/maybe.type';
import { ReadableError, ReadableDataError, StringErrorCode, CodedError } from './error';

/**
 * The expected error object returned from the server.
 */
export interface ServerErrorResponseData extends ReadableError {
  /**
   * Additional keys/data returned in the error data.
   */
  [key: string]: unknown;
}

/**
 * Human-readable server error with additional data and a status code.
 */
export interface ServerError<T = ServerErrorResponseData> extends ReadableDataError<T> {
  status: number;
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
  public readonly code?: StringErrorCode;
  public readonly status: number;
  public readonly message: Maybe<string>;
  public readonly data?: T;

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
