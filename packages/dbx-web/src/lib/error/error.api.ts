import { HttpErrorResponse } from '@angular/common/http';
import { type ReadableError, type ServerError, ServerErrorResponse, UnauthorizedServerErrorResponse, build } from '@dereekb/util';

/**
 * Converts an HTTP error response into a plain JSON-serializable {@link ServerError} object.
 *
 * Ensures that the error data is safe for serialization by running it through `JSON.stringify`/`JSON.parse`.
 * Non-serializable data is stripped with a console warning.
 *
 * @example
 * ```typescript
 * const pojoError = convertToPOJOServerErrorResponse(httpErrorResponse);
 * console.log(pojoError.message);
 * ```
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
 * Converts an {@link HttpErrorResponse} or generic error object into a {@link ServerErrorResponse}.
 *
 * Handles HTTP 401 responses specially by returning an {@link UnauthorizedServerErrorResponse}.
 * Returns `undefined` if the input is falsy.
 *
 * @example
 * ```typescript
 * const serverError = convertToServerErrorResponse(httpErrorResponse);
 * if (serverError) {
 *   console.log(serverError.status, serverError.message);
 * }
 * ```
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
