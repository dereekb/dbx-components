import { StringErrorCode, ReadableError } from './error';

/**
 * The expected error object returned from the server.
 */
export interface ServerErrorResponseData {
  /**
   * Unique identifier of the error returned, if available.
   */
  code?: StringErrorCode;
  /**
   * User-readable message of the error returned.
   */
  message?: string;
  /**
   * Additional keys/data returned in the error data.
   */
  [key: string]: any;
}

/**
 * Human-readable server error with additional data and a status code.
 */
export interface ServerError extends ReadableError {
  status: number;
  data?: any;
}

/**
 * Base server-error class.
 */
export class ServerErrorResponse implements ServerError {

  public readonly code?: string;
  public readonly status: number;
  public readonly message: string;
  public readonly data: ServerErrorResponseData;

  constructor({ code, status, data, message }: ServerError) {
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
