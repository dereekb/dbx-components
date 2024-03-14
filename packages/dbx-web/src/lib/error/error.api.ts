import { HttpErrorResponse } from '@angular/common/http';
import { ReadableError, ServerError, ServerErrorResponse, ServerErrorResponseData, UnauthorizedServerErrorResponse, build } from '@dereekb/util';

/**
 * Converts the error response to a POJO.
 */
export function convertToPOJOServerErrorResponse(httpError: HttpErrorResponse | object): ServerError {
  const result: ServerErrorResponse | undefined = convertToServerErrorResponse(httpError);
  const pojo: ServerErrorResponse = build({
    base: Object.assign({}, result),
    build: (x) => {
      if (x.data) {
        try {
          const stringy = JSON.stringify(pojo.data);
          x.data = JSON.parse(stringy);
        } catch (e) {
          console.warn('convertToPOJOServerErrorResponse(): Non-serializable Error Data Detected. It is being removed.: ', pojo.data);
          x.data = undefined;
        }
      }
    }
  });

  return pojo;
}

/**
 * Converts an HTTP Error Response to a ServerErrorResponse type.
 *
 * @param error
 * @returns
 */
export function convertToServerErrorResponse(error: HttpErrorResponse | object): ServerErrorResponse | undefined {
  let result: ServerErrorResponse | undefined;

  if (error instanceof HttpErrorResponse) {
    const { status, error: data }: { status: number; error: ServerError } = error;

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
    result = new ServerErrorResponse({ message: (error as ReadableError).message, status: 0 });
  }

  return result;
}
