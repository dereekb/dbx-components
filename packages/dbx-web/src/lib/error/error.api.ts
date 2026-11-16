import { HttpErrorResponse } from '@angular/common/http';
import { DEFAULT_READABLE_ERROR_CODE, type Maybe, type ReadableError, type ServerError, ServerErrorResponse, type StringErrorCode, UnauthorizedServerErrorResponse, build, isPlainObject } from '@dereekb/util';
import { catchError, type MonoTypeOperatorFunction, throwError } from 'rxjs';

/**
 * Code given by {@link convertToServerErrorResponse} to an HTTP error whose body carries no `code`.
 *
 * This is intentionally not {@link DEFAULT_READABLE_ERROR_CODE}:
 * - `toReadableError()` passes an error that has a code through unchanged, which keeps its message, status and data.
 * - `<dbx-error>` only enables its details popover for non-default codes.
 */
export const HTTP_ERROR_CODE: StringErrorCode = 'HTTP_ERROR';

/**
 * Code given by {@link convertToServerErrorResponse} to a status-0 {@link HttpErrorResponse}, where no response arrived at all (offline, DNS/CORS failure, timeout or abort).
 *
 * An app can register an "offline" view for this code with `DbxErrorWidgetService`.
 */
export const HTTP_NETWORK_ERROR_CODE: StringErrorCode = 'HTTP_NETWORK_ERROR';

/**
 * Message used by {@link convertToServerErrorResponse} for a status-0 {@link HttpErrorResponse}.
 */
export const HTTP_NETWORK_ERROR_MESSAGE = 'Could not reach the server.';

/**
 * `statusText` values Angular uses when the response had no real reason phrase (for example over HTTP/2). These are never used as an error message.
 */
const HTTP_PLACEHOLDER_STATUS_TEXTS = new Set<string>(['', 'OK', 'Unknown Error']);

/**
 * Returns the input when it is a non-empty string.
 *
 * @param value - The value to check.
 * @returns The value if it is a non-empty string, otherwise undefined.
 */
function nonEmptyStringOrUndefined(value: unknown): Maybe<string> {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Converts an HTTP error response into a plain JSON-serializable {@link ServerError} object, for example to store in NgRx state.
 *
 * Runs the input through {@link convertToServerErrorResponse}, then deep-copies `data` through `JSON.stringify`/`JSON.parse`.
 * Non-serializable data is removed with a console warning. A falsy input returns an empty object.
 *
 * @param httpError - The HTTP error response or generic error object to convert.
 * @returns A plain JSON-serializable {@link ServerError} object.
 *
 * @dbxUtil
 * @dbxUtilCategory http-error
 * @dbxUtilKind function
 * @dbxUtilTags http, error, server-error, response, convert, pojo, serializable, json, ngrx
 * @dbxUtilRelated convert-to-server-error-response, convert-server-error-params, catch-error-server-params
 *
 * @example
 * ```typescript
 * const pojoError = convertToPOJOServerErrorResponse(httpErrorResponse);
 * console.log(pojoError.code, pojoError.message);
 * ```
 */
export function convertToPOJOServerErrorResponse(httpError: HttpErrorResponse | object): ServerError {
  const result: ServerErrorResponse | undefined = convertToServerErrorResponse(httpError);
  const pojo: ServerErrorResponse = build({
    base: Object.assign({}, result),
    build: (x) => {
      if (x.data) {
        try {
          const stringy = JSON.stringify(x.data);
          x.data = JSON.parse(stringy);
        } catch {
          console.warn('convertToPOJOServerErrorResponse(): Non-serializable Error Data Detected. It is being removed.: ', x.data);
          x.data = undefined;
        }
      }
    }
  });

  return pojo;
}

/**
 * Converts an {@link HttpErrorResponse} (or any other thrown error object) into a {@link ServerErrorResponse} that reads well in `<dbx-error>` and `dbxActionSnackbarError`.
 *
 * For an {@link HttpErrorResponse}:
 * - Only a plain JSON-object body is read. Its `code` and `message` are used when they are non-empty strings, and a non-empty string `error` is used as the message when there is no `message` (as sent by `{ error, code }` APIs). The whole body is kept as `data`.
 * - Other bodies (`null`, text/HTML, a `ProgressEvent`, a `Blob`) are not used as the message and are not stored in `data`.
 * - When the body has no code, the code is {@link HTTP_NETWORK_ERROR_CODE} for status 0 (no response) and {@link HTTP_ERROR_CODE} otherwise.
 * - When the body has no message, the message is {@link HTTP_NETWORK_ERROR_MESSAGE} for status 0, then the `statusText` (unless it is Angular's placeholder `''`, `'OK'` or `'Unknown Error'`), then `Request failed with status <status>.`.
 * - A 401 response returns an {@link UnauthorizedServerErrorResponse}, whose message defaults to `'Unauthorized'`.
 *
 * A {@link ServerErrorResponse} input (including `FirebaseServerError`) is returned unchanged, so the function is idempotent.
 * Any other object keeps its string `code` (default {@link DEFAULT_READABLE_ERROR_CODE}), numeric `status` (default 0) and `message`.
 * A falsy input returns `undefined`.
 *
 * The result always has a code, because `toReadableError()` only keeps a server error's own message when it has one.
 *
 * In an `HttpClient` request chain, use {@link catchServerErrorResponse} instead of calling this directly.
 *
 * @param error - The HTTP error response or generic error object to convert.
 * @returns A {@link ServerErrorResponse} derived from the error, or `undefined` if the input is falsy.
 *
 * @dbxUtil
 * @dbxUtilCategory http-error
 * @dbxUtilKind function
 * @dbxUtilTags http, httpclient, error, readable, server-error, response, convert, decode, status, client
 * @dbxUtilRelated catch-server-error-response, convert-to-pojo-server-error-response, convert-https-callable-error-to-readable-error, firebase-server-error
 *
 * @example
 * ```typescript
 * const serverError = convertToServerErrorResponse(httpErrorResponse);
 * if (serverError) {
 *   console.log(serverError.status, serverError.code, serverError.message);
 * }
 * ```
 */
export function convertToServerErrorResponse(error: HttpErrorResponse | object): ServerErrorResponse | undefined {
  let result: ServerErrorResponse | undefined;

  if (error instanceof HttpErrorResponse) {
    const status = error.status;
    const body: unknown = error.error;
    const bodyObject = isPlainObject(body) ? body : undefined;
    const bodyCode = nonEmptyStringOrUndefined(bodyObject?.['code']);
    const bodyMessage = nonEmptyStringOrUndefined(bodyObject?.['message']) ?? nonEmptyStringOrUndefined(bodyObject?.['error']);
    const isNetworkError = status === 0;
    const code = bodyCode ?? (isNetworkError ? HTTP_NETWORK_ERROR_CODE : HTTP_ERROR_CODE);

    // statusText is deprecated with HTTP/2+ but still needed as a fallback for error messages
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const statusText = error.statusText;
    const usableStatusText = HTTP_PLACEHOLDER_STATUS_TEXTS.has(statusText) ? undefined : statusText;
    const data = bodyObject;

    if (status === 401) {
      result = new UnauthorizedServerErrorResponse({ code, data, message: bodyMessage ?? usableStatusText });
    } else {
      const fallbackMessage = isNetworkError ? HTTP_NETWORK_ERROR_MESSAGE : (usableStatusText ?? `Request failed with status ${status}.`);
      result = new ServerErrorResponse({ code, status, data, message: bodyMessage ?? fallbackMessage });
    }
  } else if (error instanceof ServerErrorResponse) {
    result = error;
  } else if (error) {
    const { code, status, message } = error as Partial<ReadableError & { readonly status: unknown }>;
    result = new ServerErrorResponse({
      code: nonEmptyStringOrUndefined(code) ?? DEFAULT_READABLE_ERROR_CODE,
      status: typeof status === 'number' ? status : 0,
      message: typeof message === 'string' ? message : undefined
    });
  }

  return result;
}

/**
 * RxJS operator for an `HttpClient` request chain that rethrows an {@link HttpErrorResponse} as the {@link ServerErrorResponse} built by {@link convertToServerErrorResponse}.
 *
 * Without it, `toReadableError()` (used by `dbxActionSnackbarError` and `<dbx-error>`) shows Angular's "Http failure response for <url>" text and loses the server's code and message.
 *
 * Place it directly after the `HttpClient` call. Only an {@link HttpErrorResponse} is converted; any other error (a `CodedError`, `ServerErrorResponse` or `FirebaseServerError`) is rethrown unchanged.
 * Errors are never swallowed and values pass through untouched.
 *
 * The NgRx-effect counterpart, which emits an error action instead of rethrowing, is {@link catchErrorServerParams}.
 *
 * @returns An operator that rethrows HTTP errors as {@link ServerErrorResponse} values.
 *
 * @dbxUtil
 * @dbxUtilCategory http-error
 * @dbxUtilKind function
 * @dbxUtilTags http, httpclient, error, readable, server-error, response, catch, rxjs, operator, action
 * @dbxUtilRelated convert-to-server-error-response, catch-error-server-params, convert-https-callable-error-to-readable-error
 *
 * @example
 * ```ts
 * readonly handleSave: WorkUsingObservable<SaveParams, SaveResult> = (params) => this.http.post<SaveResult>('/api/save', params).pipe(catchServerErrorResponse());
 * // template: <button dbxAction dbxActionSnackbarError [dbxActionHandler]="handleSave">Save</button>
 * ```
 */
export function catchServerErrorResponse<T>(): MonoTypeOperatorFunction<T> {
  return catchError((error: unknown) => throwError(() => (error instanceof HttpErrorResponse ? convertToServerErrorResponse(error) : error)));
}
