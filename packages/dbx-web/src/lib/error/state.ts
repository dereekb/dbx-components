import { type HttpErrorResponse } from '@angular/common/http';
import { convertToPOJOServerErrorResponse } from './error.api';
import { catchError, type MonoTypeOperatorFunction, of } from 'rxjs';
import { type ActionCreator, type Action } from '@ngrx/store';
import { type ServerError } from '@dereekb/util';

/**
 * Wrapper for a {@link ServerError} used as NgRx action props.
 */
export interface ServerErrorParams {
  readonly error: ServerError;
}

/**
 * Converts an HTTP error response into {@link ServerErrorParams} suitable for dispatching as an NgRx action prop.
 *
 * The error is converted with {@link convertToPOJOServerErrorResponse}, so it is a plain JSON-serializable object that is safe to keep in the store.
 *
 * @param httpError - The HTTP error response or generic error object to convert.
 * @returns A {@link ServerErrorParams} object wrapping the converted server error.
 *
 * @dbxUtil
 * @dbxUtilCategory http-error
 * @dbxUtilKind function
 * @dbxUtilTags http, error, server-error, response, convert, ngrx, action, params
 * @dbxUtilRelated catch-error-server-params, convert-to-pojo-server-error-response, catch-server-error-response
 *
 * @example
 * ```typescript
 * const params = convertServerErrorParams(httpErrorResponse);
 * store.dispatch(myErrorAction(params));
 * ```
 */
export function convertServerErrorParams(httpError: HttpErrorResponse | object): ServerErrorParams {
  const error: ServerError = convertToPOJOServerErrorResponse(httpError);
  return { error };
}

/**
 * RxJS operator for NgRx effects that catches HTTP errors, converts them to {@link ServerErrorParams}, and emits the given NgRx action instead of erroring.
 *
 * Outside NgRx (for example a `dbxActionHandler` that calls `HttpClient`), use `catchServerErrorResponse()` instead, which rethrows the converted error.
 *
 * @param action - The NgRx action creator to dispatch with the converted error params.
 * @param mapError - Optional function to transform the {@link ServerErrorParams} before dispatching. Defaults to identity.
 * @returns An RxJS operator that catches errors and emits the corresponding error action.
 *
 * @dbxUtil
 * @dbxUtilCategory http-error
 * @dbxUtilKind function
 * @dbxUtilTags http, error, server-error, response, catch, ngrx, effect, action, rxjs, operator
 * @dbxUtilRelated convert-server-error-params, catch-server-error-response, convert-to-server-error-response
 *
 * @example
 * ```typescript
 * return this.actions$.pipe(
 *   ofType(myAction),
 *   switchMap(() => this.api.getData().pipe(
 *     catchErrorServerParams(myErrorAction)
 *   ))
 * );
 * ```
 */
export function catchErrorServerParams<E extends ServerErrorParams, T extends string>(action: ActionCreator<T, (props: E) => E & Action<T>>, mapError: (error: ServerErrorParams) => E = (error) => error as E): MonoTypeOperatorFunction<E & Action<T>> {
  return catchError((error: HttpErrorResponse | object) => {
    const serverErrorParams = convertServerErrorParams(error);
    const mappedError: E = mapError(serverErrorParams);
    const act = action(mappedError);
    return of(act);
  });
}
