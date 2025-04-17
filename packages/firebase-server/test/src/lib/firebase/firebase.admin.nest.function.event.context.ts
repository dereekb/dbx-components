import { useJestFunctionFixture, useJestFunctionMapFixture } from '@dereekb/util/test';
import { FirebaseAdminFunctionNestTestContext, wrapCallableRequestForNestTestsGetter, WrapCallableRequestForNestTestsInput } from './firebase.admin.nest.function';
import { mapObjectMap } from '@dereekb/util';
import { WrappedCallableRequest } from './firebase.function';

// MARK: V1
export interface CallableRequestTestBaseConfig {
  f: FirebaseAdminFunctionNestTestContext;
}

export interface CallableRequestTestSingleConfig<I> extends CallableRequestTestBaseConfig {
  fn: WrapCallableRequestForNestTestsInput<I>;
}

export type CallableRequestTestSingleFunction<I> = (fn: WrappedCallableRequest<I>) => void;

export type CallableRequestTestConfigMapObject = {
  [key: string]: WrapCallableRequestForNestTestsInput<any>;
};

export interface CallableRequestTestMultipleConfig<I, T extends CallableRequestTestConfigMapObject> extends CallableRequestTestBaseConfig {
  fns: T;
}

export const CallableRequestTestMultipleFixtureSuffix = 'WrappedFn';

export type CallableRequestTestMultipleFixture<T extends CallableRequestTestConfigMapObject> = {
  [K in keyof T as K extends string ? `${K}${typeof CallableRequestTestMultipleFixtureSuffix}` : never]: T[K] extends WrapCallableRequestForNestTestsInput<infer I> ? WrappedCallableRequest<I> : never;
};

export type CallableRequestTestMultipleFunction<T extends CallableRequestTestConfigMapObject> = (fn: CallableRequestTestMultipleFixture<T>) => void;

export function isCallableRequestTestSingleConfig<I, T extends CallableRequestTestConfigMapObject>(config: CallableRequestTestSingleConfig<I> | CallableRequestTestMultipleConfig<I, T>): config is CallableRequestTestSingleConfig<I> {
  const isSingle = Boolean((config as CallableRequestTestSingleConfig<I>).fn);
  return isSingle;
}

/**
 * Used to provide a test builder that exposes a WrappedCallableRequest using the input configuration.
 *
 * @param config
 * @param buildTests
 */
export function callableRequestTest<I, T extends CallableRequestTestConfigMapObject>(config: CallableRequestTestMultipleConfig<I, T>, buildTests: CallableRequestTestMultipleFunction<T>): void;
export function callableRequestTest<I>(config: CallableRequestTestSingleConfig<I>, buildTests: CallableRequestTestSingleFunction<I>): void;
export function callableRequestTest<I, T extends CallableRequestTestConfigMapObject>(config: CallableRequestTestSingleConfig<I> | CallableRequestTestMultipleConfig<I, T>, buildTests: CallableRequestTestSingleFunction<I> | CallableRequestTestMultipleFunction<T>): void;
export function callableRequestTest<I, T extends CallableRequestTestConfigMapObject>(config: CallableRequestTestSingleConfig<I> | CallableRequestTestMultipleConfig<I, T>, buildTests: CallableRequestTestSingleFunction<I> | CallableRequestTestMultipleFunction<T>): void {
  if (isCallableRequestTestSingleConfig(config)) {
    const { f, fn } = config;

    useJestFunctionFixture<WrappedCallableRequest<I>>(
      {
        fn: () => {
          const x = wrapCallableRequestForNestTestsGetter(f, fn)();
          return x;
        }
      },
      buildTests as CallableRequestTestSingleFunction<I>
    );
  } else {
    const { f, fns: inputFns } = config;
    const mappedFns = mapObjectMap(inputFns, (fn) => () => wrapCallableRequestForNestTestsGetter(f, fn)());
    const fns: any = {};

    Object.keys(mappedFns).forEach((key) => {
      fns[`${key}${CallableRequestTestMultipleFixtureSuffix}`] = mappedFns[key];
    });

    useJestFunctionMapFixture(
      {
        fns
      },
      buildTests as any
    );
  }
}

/**
 * Convenience function that calls describe and callableRequestContext together.
 *
 * @param label
 * @param config
 * @param buildTests
 */
export function describeCallableRequestTest<I, T extends CallableRequestTestConfigMapObject>(label: string, config: CallableRequestTestMultipleConfig<I, T>, buildTests: CallableRequestTestMultipleFunction<T>): void;
export function describeCallableRequestTest<I>(label: string, config: CallableRequestTestSingleConfig<I>, buildTests: CallableRequestTestSingleFunction<I>): void;
export function describeCallableRequestTest<I, T extends CallableRequestTestConfigMapObject>(label: string, config: CallableRequestTestSingleConfig<I> | CallableRequestTestMultipleConfig<I, T>, buildTests: CallableRequestTestSingleFunction<I> | CallableRequestTestMultipleFunction<T>): void;
export function describeCallableRequestTest<I, T extends CallableRequestTestConfigMapObject>(label: string, config: CallableRequestTestSingleConfig<I> | CallableRequestTestMultipleConfig<I, T>, buildTests: CallableRequestTestSingleFunction<I> | CallableRequestTestMultipleFunction<T>): void {
  describe(label, () => {
    callableRequestTest<I, T>(config, buildTests);
  });
}
