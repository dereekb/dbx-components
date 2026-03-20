import { type PromiseOrValue, serverError } from '@dereekb/util';
import { type OnCallDevelopmentParams, type DevelopmentFirebaseFunctionSpecifierRef, type DevelopmentFirebaseFunctionSpecifier } from '@dereekb/firebase';
import { badRequestError } from '../../function';
import { type OnCallWithNestContext } from '../function/call';
import { type NestContextCallableRequest } from '../function/nest';
import { type AssertDevelopmentRequestFunction } from './development.assert.function';

// MARK: Function
/**
 * A single development function handler.
 *
 * Receives the NestJS context request with unwrapped inner data and the specifier
 * identifying which dev operation was requested.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam I - The input data type.
 * @typeParam O - The output type.
 */
export type OnCallDevelopmentFunction<N, I = unknown, O = unknown> = (request: NestContextCallableRequest<N, I> & DevelopmentFirebaseFunctionSpecifierRef) => PromiseOrValue<O>;

/**
 * Maps specifier strings to development function handlers.
 *
 * Each key is a specifier that clients pass in the `specifier` field of
 * {@link OnCallDevelopmentParams} to invoke a specific dev operation.
 *
 * @typeParam N - The NestJS context type.
 */
export type OnCallDevelopmentFunctionMap<N> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- handler map values accept arbitrary input/output types
  readonly [key: string]: OnCallDevelopmentFunction<N, any, any>;
};

/**
 * Configuration for {@link onCallDevelopmentFunction}.
 *
 * @typeParam N - The NestJS context type.
 */
export interface OnCallDevelopmentConfig<N> {
  /**
   * Optional assertion run before the dev handler; throw to reject the request.
   */
  readonly preAssert?: AssertDevelopmentRequestFunction<N, OnCallDevelopmentParams>;
}

/**
 * Factory that creates a callable function dispatching to development utility handlers.
 *
 * Incoming requests carry a `specifier` field that selects the appropriate handler
 * from the provided map. The inner `data` payload is unwrapped and forwarded to the handler.
 *
 * @param map - Maps specifier strings to development function handlers.
 * @param config - Optional configuration including a pre-assertion hook.
 * @returns A callable function that dispatches to the correct dev handler by specifier.
 *
 * @example
 * ```typescript
 * const devFunction = onCallDevelopmentFunction<DemoNestContext>({
 *   initData: initDataFunction,
 *   resetData: resetDataFunction
 * });
 * ```
 */
export function onCallDevelopmentFunction<N>(map: OnCallDevelopmentFunctionMap<N>, config: OnCallDevelopmentConfig<N> = {}): OnCallWithNestContext<N, OnCallDevelopmentParams> {
  const { preAssert = () => undefined } = config;

  return (request) => {
    const specifier = request.data.specifier;
    const devFn = map[specifier];

    if (devFn) {
      preAssert({ request, specifier });
      return devFn({
        ...request,
        specifier,
        data: request.data.data
      });
    } else {
      throw developmentUnknownSpecifierError(specifier);
    }
  };
}

/**
 * Creates a bad-request error indicating the provided development function specifier is not recognized.
 *
 * @param specifier - the unrecognized specifier string from the client request.
 * @returns A bad-request error with the unknown specifier details.
 */
export function developmentUnknownSpecifierError(specifier: DevelopmentFirebaseFunctionSpecifier) {
  return badRequestError(
    serverError({
      status: 400,
      code: 'UNKNOWN_SPECIFIER_ERROR',
      message: `Invalid specifier "${specifier}" to run.`,
      data: {
        specifier
      }
    })
  );
}
