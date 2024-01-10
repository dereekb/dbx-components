import { useJestFunctionFixture, useJestFunctionMapFixture } from '@dereekb/util/test';
import { FirebaseAdminFunctionNestTestContext, wrapCloudFunctionForNestTestsGetter, WrapCloudFunctionForNestTestsInput } from './firebase.admin.nest.function';
import { WrappedCloudFunctionV1 } from './firebase.function';
import { mapObjectMap } from '@dereekb/util';

// MARK: V1
export interface CloudFunctionTestBaseConfig {
  f: FirebaseAdminFunctionNestTestContext;
}

export interface CloudFunctionTestSingleConfig<I> extends CloudFunctionTestBaseConfig {
  fn: WrapCloudFunctionForNestTestsInput<I>;
}

export type CloudFunctionTestSingleFunction<I> = (fn: WrappedCloudFunctionV1<I>) => void;

export type CloudFunctionTestConfigMapObject = {
  [key: string]: WrapCloudFunctionForNestTestsInput<any>;
};

export interface CloudFunctionTestMultipleConfig<I, T extends CloudFunctionTestConfigMapObject> extends CloudFunctionTestBaseConfig {
  fns: T;
}

export type CloudFunctionTestMultipleFixture<T extends CloudFunctionTestConfigMapObject> = {
  [K in keyof T as K extends string ? `${K}CloudFn` : never]: T[K] extends WrapCloudFunctionForNestTestsInput<infer I> ? WrappedCloudFunctionV1<I> : never;
};

export type CloudFunctionTestMultipleFunction<T extends CloudFunctionTestConfigMapObject> = (fn: CloudFunctionTestMultipleFixture<T>) => void;

export function isCloudFunctionTestSingleConfig<I, T extends CloudFunctionTestConfigMapObject>(config: CloudFunctionTestSingleConfig<I> | CloudFunctionTestMultipleConfig<I, T>): config is CloudFunctionTestSingleConfig<I> {
  const isSingle = Boolean((config as CloudFunctionTestSingleConfig<I>).fn);
  return isSingle;
}

/**
 * Used to provide a test builder that exposes a WrappedCloudFunction using the input configuration.
 *
 * @param config
 * @param buildTests
 */
export function cloudFunctionTest<I, T extends CloudFunctionTestConfigMapObject>(config: CloudFunctionTestMultipleConfig<I, T>, buildTests: CloudFunctionTestMultipleFunction<T>): void;
export function cloudFunctionTest<I>(config: CloudFunctionTestSingleConfig<I>, buildTests: CloudFunctionTestSingleFunction<I>): void;
export function cloudFunctionTest<I, T extends CloudFunctionTestConfigMapObject>(config: CloudFunctionTestSingleConfig<I> | CloudFunctionTestMultipleConfig<I, T>, buildTests: CloudFunctionTestSingleFunction<I> | CloudFunctionTestMultipleFunction<T>): void;
export function cloudFunctionTest<I, T extends CloudFunctionTestConfigMapObject>(config: CloudFunctionTestSingleConfig<I> | CloudFunctionTestMultipleConfig<I, T>, buildTests: CloudFunctionTestSingleFunction<I> | CloudFunctionTestMultipleFunction<T>): void {
  if (isCloudFunctionTestSingleConfig(config)) {
    const { f, fn } = config;
    useJestFunctionFixture<WrappedCloudFunctionV1<I>>(
      {
        fn: () => {
          const x = wrapCloudFunctionForNestTestsGetter(f, fn)();
          return x;
        }
      },
      buildTests as CloudFunctionTestSingleFunction<I>
    );
  } else {
    const { f, fns: inputFns } = config;
    const mappedFns = mapObjectMap(inputFns, (fn) => () => wrapCloudFunctionForNestTestsGetter(f, fn)());
    const fns: any = {};

    Object.keys(mappedFns).forEach((key) => {
      fns[`${key}CloudFn`] = mappedFns[key];
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
 * Convenience function that calls describe and cloudFunctionContext together.
 *
 * @param label
 * @param config
 * @param buildTests
 */
export function describeCloudFunctionTest<I, T extends CloudFunctionTestConfigMapObject>(label: string, config: CloudFunctionTestMultipleConfig<I, T>, buildTests: CloudFunctionTestMultipleFunction<T>): void;
export function describeCloudFunctionTest<I>(clabel: string, onfig: CloudFunctionTestSingleConfig<I>, buildTests: CloudFunctionTestSingleFunction<I>): void;
export function describeCloudFunctionTest<I, T extends CloudFunctionTestConfigMapObject>(label: string, config: CloudFunctionTestSingleConfig<I> | CloudFunctionTestMultipleConfig<I, T>, buildTests: CloudFunctionTestSingleFunction<I> | CloudFunctionTestMultipleFunction<T>): void;
export function describeCloudFunctionTest<I, T extends CloudFunctionTestConfigMapObject>(label: string, config: CloudFunctionTestSingleConfig<I> | CloudFunctionTestMultipleConfig<I, T>, buildTests: CloudFunctionTestSingleFunction<I> | CloudFunctionTestMultipleFunction<T>): void {
  describe(label, () => {
    cloudFunctionTest<I, T>(config, buildTests);
  });
}

// MARK: V2
// TODO
