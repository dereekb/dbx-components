import { HttpErrorResponse } from '@angular/common/http';
import { convertToPOJOServerErrorResponse } from './error.api';
import { catchError, MonoTypeOperatorFunction, of } from 'rxjs';
import { ActionCreator, TypedAction } from '@ngrx/store/src/models';
import { ServerError } from '@dereekb/util';

export interface ServerErrorParams {
  error: ServerError;
}

/**
 * Converts the error response to ServerErrorParams.
 */
export function convertServerErrorParams(httpError: HttpErrorResponse | object): ServerErrorParams {
  const error: ServerError = convertToPOJOServerErrorResponse(httpError);
  return { error };
}

/**
 * Catches error server params and feeds them to an action that takes ServerErrorParams as a prop.
 */
export function catchErrorServerParams<E extends ServerErrorParams, T extends string>(
  action: ActionCreator<T, (props: E) => E & TypedAction<T>>,
  mapError: (error: ServerErrorParams) => E = ((error) => error as E)
): MonoTypeOperatorFunction<E & TypedAction<T>> {
  return catchError((error: HttpErrorResponse | object) => {
    const serverErrorParams = convertServerErrorParams(error);
    const mappedError: E = mapError(serverErrorParams);
    const act = action(mappedError);
    return of(act);
  });
}
