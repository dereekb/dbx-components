import { useJestFunctionFixture, useJestFunctionMapFixture } from '@dereekb/util/test';
import { FirebaseAdminFunctionNestTestContext, wrapCloudFunctionForNestTestsGetter, WrapCloudFunctionForNestTestsInput } from './firebase.admin.nest.function';
import { WrappedCloudFunction } from './firebase.function';
import { mapObjectMap } from '@dereekb/util';

export type CloudFunctionTestWrappedCloudFunction<I extends object> = WrappedCloudFunction<I>;

export interface CloudFunctionTestBaseConfig {
  f: FirebaseAdminFunctionNestTestContext;
}

export interface CloudFunctionTestSingleConfig<I extends object> extends CloudFunctionTestBaseConfig {
  fn: WrapCloudFunctionForNestTestsInput<I>;
}

export type CloudFunctionTestSingleFunction<I extends object> = (fn: WrappedCloudFunction<I>) => void;

export type CloudFunctionTestConfigMapObject = {
  [key: string]: WrapCloudFunctionForNestTestsInput<any>;
};

export interface CloudFunctionTestMultipleConfig<I extends object, T extends CloudFunctionTestConfigMapObject> extends CloudFunctionTestBaseConfig {
  fns: T;
}

export type CloudFunctionTestMultipleFixture<T extends CloudFunctionTestConfigMapObject> = {
  [K in keyof T as K extends string ? `${K}CloudFn` : never]: T[K] extends WrapCloudFunctionForNestTestsInput<infer I> ? WrappedCloudFunction<I> : never;
};

export type CloudFunctionTestMultipleFunction<T extends CloudFunctionTestConfigMapObject> = (fn: CloudFunctionTestMultipleFixture<T>) => void;

export function isCloudFunctionTestSingleConfig<I extends object, T extends CloudFunctionTestConfigMapObject>(config: CloudFunctionTestSingleConfig<I> | CloudFunctionTestMultipleConfig<I, T>): config is CloudFunctionTestSingleConfig<I> {
  const isSingle = Boolean((config as CloudFunctionTestSingleConfig<I>).fn);
  return isSingle;
}

/**
 * Used to provide a test builder that exposes a WrappedCloudFunction using the input configuration.
 *
 * For gen 2 callable functions, see cloudFunctionTest().
 *
 * @param config
 * @param buildTests
 */
export function cloudFunctionTest<I extends object, T extends CloudFunctionTestConfigMapObject>(config: CloudFunctionTestMultipleConfig<I, T>, buildTests: CloudFunctionTestMultipleFunction<T>): void;
export function cloudFunctionTest<I extends object>(config: CloudFunctionTestSingleConfig<I>, buildTests: CloudFunctionTestSingleFunction<I>): void;
export function cloudFunctionTest<I extends object, T extends CloudFunctionTestConfigMapObject>(config: CloudFunctionTestSingleConfig<I> | CloudFunctionTestMultipleConfig<I, T>, buildTests: CloudFunctionTestSingleFunction<I> | CloudFunctionTestMultipleFunction<T>): void;
export function cloudFunctionTest<I extends object, T extends CloudFunctionTestConfigMapObject>(config: CloudFunctionTestSingleConfig<I> | CloudFunctionTestMultipleConfig<I, T>, buildTests: CloudFunctionTestSingleFunction<I> | CloudFunctionTestMultipleFunction<T>): void {
  if (isCloudFunctionTestSingleConfig(config)) {
    const { f, fn } = config;

    useJestFunctionFixture<CloudFunctionTestWrappedCloudFunction<I>>(
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
 * For gen 2 callable functions, see describeCallableRequestTest().
 *
 * @param label
 * @param config
 * @param buildTests
 */
export function describeCloudFunctionTest<I extends object, T extends CloudFunctionTestConfigMapObject>(label: string, config: CloudFunctionTestMultipleConfig<I, T>, buildTests: CloudFunctionTestMultipleFunction<T>): void;
export function describeCloudFunctionTest<I extends object>(label: string, config: CloudFunctionTestSingleConfig<I>, buildTests: CloudFunctionTestSingleFunction<I>): void;
export function describeCloudFunctionTest<I extends object, T extends CloudFunctionTestConfigMapObject>(label: string, config: CloudFunctionTestSingleConfig<I> | CloudFunctionTestMultipleConfig<I, T>, buildTests: CloudFunctionTestSingleFunction<I> | CloudFunctionTestMultipleFunction<T>): void;
export function describeCloudFunctionTest<I extends object, T extends CloudFunctionTestConfigMapObject>(label: string, config: CloudFunctionTestSingleConfig<I> | CloudFunctionTestMultipleConfig<I, T>, buildTests: CloudFunctionTestSingleFunction<I> | CloudFunctionTestMultipleFunction<T>): void {
  describe(label, () => {
    cloudFunctionTest<I, T>(config, buildTests);
  });
}
