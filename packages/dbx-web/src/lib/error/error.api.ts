import { HttpErrorResponse } from '@angular/common/http';
import { ServerError, ServerErrorResponse, ServerErrorResponseData, UnauthorizedServerErrorResponse } from '@dereekb/util';

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
