import { HttpErrorResponse } from '@angular/common/http';
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

/**
 * Converts the error response to a POJO.
 */
export function convertToPOJOServerErrorResponse(httpError: HttpErrorResponse | any): ServerError {
  const result: ServerErrorResponse | undefined = convertToServerErrorResponse(httpError);
  const pojo: ServerErrorResponse = Object.assign({}, result);

  if (pojo.data) {
    try {
      const stringy = JSON.stringify(pojo.data);
      (pojo as any).data = JSON.parse(stringy);
    } catch (e) {
      console.warn('convertToPOJOServerErrorResponse(): Non-serializable Error Data Detected. It is being removed.: ', pojo.data);
      (pojo as any).data = undefined;
    }
  }

  return pojo;
}

/**
 * Converts an HTTP Error Response to a ServerErrorResponse type.
 * 
 * @param error 
 * @returns 
 */
export function convertToServerErrorResponse(error: HttpErrorResponse | any): ServerErrorResponse | undefined {
  let result: ServerErrorResponse | undefined;

  if (error instanceof HttpErrorResponse) {
    const { status, error: data }: { status: number, error: ServerErrorResponseData } = error;

    const code = data.code;
    const message = data.message ?? error.statusText;

    switch (status) {
      case 401:
        result = new UnauthorizedServerErrorResponse({ message, data, code });
        break;
      default:
        result = new ServerErrorResponse({ code, status, data, message });
        break;
    }
  } else if (error) {
    result = new ServerErrorResponse({ message: error.message, status: 0 });
  }

  return result;
}
