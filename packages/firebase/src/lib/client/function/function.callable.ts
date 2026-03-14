/* eslint-disable @typescript-eslint/no-explicit-any */
// The use of any here does not degrade the type-safety. The correct type is inferred in most cases.

import { type FactoryWithInput, type Maybe, type PromiseOrValue, toReadableError } from '@dereekb/util';
import { type FirebaseError } from 'firebase/app';
import { type HttpsCallable, type HttpsCallableResult } from 'firebase/functions';
import { FirebaseServerError } from './error';
import { isClientFirebaseError } from '../error/error';

/**
 * Configuration for mapping input/output values when wrapping an `HttpsCallable`.
 *
 * @template I - the external input type (what callers provide)
 * @template O - the external output type (what callers receive)
 * @template A - the internal input type (what the callable expects)
 * @template B - the internal output type (what the callable returns)
 */
export interface MapHttpsCallable<I, O, A, B> {
  /** Transforms the caller's input into the format expected by the underlying callable. */
  readonly mapInput?: FactoryWithInput<PromiseOrValue<A>, Maybe<I>>;
  /** Transforms the callable's raw output into the format returned to callers. */
  readonly mapOutput?: FactoryWithInput<PromiseOrValue<O>, Maybe<B>>;
}

/**
 * Wraps an `HttpsCallable` with input/output transformations and error conversion.
 *
 * Supports both standard mode (returns `HttpsCallableResult<O>`) and direct-data mode
 * (returns just `O`) depending on the `directData` parameter. Errors from the callable
 * are converted to readable errors via {@link convertHttpsCallableErrorToReadableError}.
 *
 * @param callable - the underlying Firebase `HttpsCallable` to wrap
 * @param wrap - input/output mapping functions
 * @param directData - when `true`, returns the unwrapped data instead of `HttpsCallableResult`
 *
 * @example
 * ```ts
 * const wrapped = mapHttpsCallable(httpsCallable(functions, 'myFn'), {
 *   mapInput: (params) => ({ ...params, timestamp: Date.now() }),
 *   mapOutput: (result) => result?.items ?? []
 * }, true);
 * const items = await wrapped({ query: 'test' });
 * ```
 */
export function mapHttpsCallable<I, O, A, B = unknown>(callable: HttpsCallable<A, B>, wrap: MapHttpsCallable<I, O, A, B>): HttpsCallable<I, O>;
export function mapHttpsCallable<I, O, A, B = unknown>(callable: HttpsCallable<A, B>, wrap: MapHttpsCallable<I, O, A, B>, directData: false): HttpsCallable<I, O>;
export function mapHttpsCallable<I, O, A, B = unknown>(callable: HttpsCallable<A, B>, wrap: MapHttpsCallable<I, O, A, B>, directData: true): DirectDataHttpsCallable<HttpsCallable<I, O>>;
export function mapHttpsCallable<I, O, A, B = unknown>(callable: HttpsCallable<A, B>, wrap: MapHttpsCallable<I, O, A, B>, directData?: boolean): HttpsCallable<I, O> | DirectDataHttpsCallable<HttpsCallable<I, O>>;
export function mapHttpsCallable<I, O, A, B = unknown>(callable: HttpsCallable<A, B>, wrap: MapHttpsCallable<I, O, A, B>, directData = false): HttpsCallable<I, O> | DirectDataHttpsCallable<HttpsCallable<I, O>> {
  const { mapInput = (x: Maybe<I>) => x as unknown as A, mapOutput = (x: Maybe<B>) => x as unknown as O } = wrap;

  return (async (inputData?: Maybe<I>): Promise<HttpsCallableResult<O> | O> => {
    const data: A = await mapInput(inputData);

    try {
      const result: HttpsCallableResult<B> = await callable(data);
      const resultData: Maybe<B> = result.data;
      const mappedResultData: O = await mapOutput(resultData);

      if (directData) {
        return mappedResultData;
      } else {
        return {
          ...result,
          data: mappedResultData
        };
      }
    } catch (e) {
      throw convertHttpsCallableErrorToReadableError(e);
    }
  }) as HttpsCallable<I, O> | DirectDataHttpsCallable<HttpsCallable<I, O>>;
}

/**
 * Unwraps an `HttpsCallable` so it returns the response data directly (`O`) instead of
 * `HttpsCallableResult<O>`. Simplifies consumption when only the data payload is needed.
 */
export type DirectDataHttpsCallable<C extends HttpsCallable<any, any>> = C extends HttpsCallable<infer I, infer O> ? (data?: I | null) => Promise<O> : never;

/**
 * Wraps an `HttpsCallable` to return the data payload directly, stripping the `HttpsCallableResult` wrapper.
 *
 * Errors are converted to readable errors via {@link convertHttpsCallableErrorToReadableError}.
 *
 * @param callable - the `HttpsCallable` to wrap
 *
 * @example
 * ```ts
 * const fn = directDataHttpsCallable(httpsCallable<Input, Output>(functions, 'myFn'));
 * const output: Output = await fn(input);
 * ```
 */
export function directDataHttpsCallable<I, O, C extends HttpsCallable<I, O> = HttpsCallable<I, O>>(callable: C): DirectDataHttpsCallable<C> {
  return ((data: I) =>
    callable(data)
      .then((x) => x.data)
      .catch((e) => convertHttpsCallableErrorToReadableError(e))) as DirectDataHttpsCallable<C>;
}

/**
 * Converts errors from `HttpsCallable` calls into more readable error types.
 *
 * If the error is a client-side {@link FirebaseError} with `details`, wraps it as a {@link FirebaseServerError}
 * to preserve server-side error context. Otherwise, converts it to a generic readable error via `toReadableError`.
 *
 * @param error - the caught error from an `HttpsCallable` invocation
 */
export function convertHttpsCallableErrorToReadableError(error: unknown) {
  let result: unknown;

  if (typeof error === 'object') {
    if (isClientFirebaseError(error) && (error as Partial<{ details: object }>).details != null) {
      result = FirebaseServerError.fromFirebaseError(error as FirebaseError);
    } else {
      result = toReadableError(error);
    }
  } else {
    result = error;
  }

  return result;
}
