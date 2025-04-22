import { type PromiseOrValue, serverError } from '@dereekb/util';
import { type OnCallDevelopmentParams, type DevelopmentFirebaseFunctionSpecifierRef, type DevelopmentFirebaseFunctionSpecifier } from '@dereekb/firebase';
import { badRequestError } from '../../function';
import { type OnCallWithNestContext } from '../function/call';
import { type NestContextCallableRequest } from '../function/nest';
import { type AssertDevelopmentRequestFunction } from './development.assert.function';

// MARK: Function
export type OnCallDevelopmentFunction<N, I = unknown, O = unknown> = (request: NestContextCallableRequest<N, I> & DevelopmentFirebaseFunctionSpecifierRef) => PromiseOrValue<O>;

export type OnCallDevelopmentFunctionMap<N> = {
  readonly [key: string]: OnCallDevelopmentFunction<N, any, any>;
};

export interface OnCallDevelopmentConfig<N> {
  readonly preAssert?: AssertDevelopmentRequestFunction<N, OnCallDevelopmentParams>;
}

/**
 * Creates a OnCallWithAuthorizedNestContext function for creating a model.
 *
 * @param map
 * @returns
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
