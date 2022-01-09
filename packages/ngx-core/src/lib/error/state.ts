import { HttpErrorResponse } from '@angular/common/http';
import { convertToPOJOErrorResponse, ServerError } from './api.error';
import { of, Observable, OperatorFunction } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Action, ActionCreator, TypedAction } from '@ngrx/store/src/models';

export interface ServerErrorParams {
  error: ServerError;
}

/**
 * Converts the error response to ServerErrorParams.
 */
export function convertServerErrorParams(httpError: HttpErrorResponse | any): ServerErrorParams {
  const error: ServerError = convertToPOJOErrorResponse(httpError);
  return { error };
}

/**
 * Catches error server params and feeds them to an action that takes ServerErrorParams as a prop.
 */
export function catchErrorServerParams<E extends ServerErrorParams, T extends string>(
  action: ActionCreator<T, (props: E) => E & TypedAction<T>>,
  mapError: (error: ServerErrorParams) => E = (error) => error as E
):
  OperatorFunction<HttpErrorResponse | any, E & TypedAction<T>> {
  return catchError((error: HttpErrorResponse) => of(action(mapError(convertServerErrorParams(error)))));
}
