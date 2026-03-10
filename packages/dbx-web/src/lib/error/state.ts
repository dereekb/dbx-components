import { type HttpErrorResponse } from '@angular/common/http';
import { convertToPOJOServerErrorResponse } from './error.api';
import { catchError, type MonoTypeOperatorFunction, of } from 'rxjs';
import { type ActionCreator, type Action } from '@ngrx/store';
import { type ServerError } from '@dereekb/util';

/**
 * Wrapper for a {@link ServerError} used as NgRx action props.
 */
export interface ServerErrorParams {
  error: ServerError;
}

/**
 * Converts an HTTP error response into {@link ServerErrorParams} suitable for dispatching as an NgRx action prop.
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
 * RxJS operator that catches HTTP errors, converts them to {@link ServerErrorParams}, and dispatches the given NgRx action.
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
