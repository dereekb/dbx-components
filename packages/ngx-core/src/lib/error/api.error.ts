import { HttpErrorResponse } from '@angular/common/http';
import { AppError } from './error';

export interface ServerError extends AppError {
  status?: number;
  message: string;
  data?: any;
}

export class ServerErrorResponse implements ServerError {

  public readonly code?: string;
  public readonly status?: number;
  public readonly message: string;
  public readonly data: any;

  constructor({ code, status, data, message }: ServerError) {
    this.code = code;
    this.message = message;
    this.status = status;
    this.data = data;
  }

}

export class UnauthorizedServerErrorResponse extends ServerErrorResponse {

  constructor(public override readonly data: any) {
    super({ status: 401, message: 'Unauthorized', data });
  }

}

/**
 * Converts the error response to a POJO.
 */
export function convertToPOJOErrorResponse(httpError: HttpErrorResponse | any): ServerError {
  const result: ServerErrorResponse | undefined = convertToServerErrorResponse(httpError);
  const pojo: ServerErrorResponse = Object.assign({}, result);

  if (pojo.data) {
    try {
      const stringy = JSON.stringify(pojo.data);
      (pojo as any).data = JSON.parse(stringy);
    } catch (e) {
      console.warn('Non-serializable Error Data Detected. It is being removed.: ', pojo.data);
      (pojo as any).data = undefined;
    }
  }

  return pojo;
}

export function convertToServerErrorResponse(error: HttpErrorResponse | any): ServerErrorResponse | undefined {
  let result: ServerErrorResponse | undefined;

  // console.log('Server Error Response: ', error);

  if (error instanceof HttpErrorResponse) {
    const status = error.status;
    const data = error.error;

    const code = data.code;
    const message = data.message ?? error.statusText;

    // console.log('Error: ', error);

    switch (status) {
      case 401:
        result = new UnauthorizedServerErrorResponse(data);
        break;
      default:
        result = new ServerErrorResponse({ code, status, data, message });
        break;
    }
  } else if (error) {
    // console.log('Failed serializing error: ', error);
    result = new ServerErrorResponse({ message: error.message, status: 0 });
  }

  return result;
}
