import { useTestFunctionFixture, useTestFunctionMapFixture } from '@dereekb/util/test';
import { type FirebaseAdminFunctionNestTestContext, wrapCloudFunctionForNestTestsGetter, type WrapCloudFunctionForNestTestsInput } from './firebase.admin.nest.function';
import { type WrappedCloudFunction } from './firebase.function';
import { mapObjectMap } from '@dereekb/util';

/**
 * Alias for {@link WrappedCloudFunction} used within cloud function test builders.
 * Provides a semantic name specific to the test context.
 */
export type CloudFunctionTestWrappedCloudFunction<I extends object> = WrappedCloudFunction<I>;

/**
 * Base configuration shared by both single and multiple cloud function test builders.
 * Provides the {@link FirebaseAdminFunctionNestTestContext} that supplies NestJS and
 * Cloud Function wrapping capabilities.
 */
export interface CloudFunctionTestBaseConfig {
  /** The test context fixture providing NestJS module and function wrapping access. */
  f: FirebaseAdminFunctionNestTestContext;
}

/**
 * Configuration for testing a single cloud function (v1 schedule, blocking, or cloud event).
 * The `fn` factory is wrapped and provided to the test callback as a {@link WrappedCloudFunction}.
 */
export interface CloudFunctionTestSingleConfig<I extends object> extends CloudFunctionTestBaseConfig {
  /** The cloud function factory to wrap for testing. */
  fn: WrapCloudFunctionForNestTestsInput<I>;
}

/**
 * Test callback for a single cloud function. Receives the wrapped function and should
 * register test cases (e.g., `it(...)` blocks) inside the callback body.
 */
export type CloudFunctionTestSingleFunction<I extends object> = (fn: WrappedCloudFunction<I>) => void;

/**
 * Map of named cloud function factories. Each key becomes a fixture property
 * (suffixed with `"CloudFn"`) containing the corresponding {@link WrappedCloudFunction}.
 */
export type CloudFunctionTestConfigMapObject = {
  [key: string]: WrapCloudFunctionForNestTestsInput<any>;
};

/**
 * Configuration for testing multiple cloud functions simultaneously.
 * Each entry in `fns` is independently wrapped and exposed via a {@link CloudFunctionTestMultipleFixture}.
 */
export interface CloudFunctionTestMultipleConfig<I extends object, T extends CloudFunctionTestConfigMapObject> extends CloudFunctionTestBaseConfig {
  /** Map of named cloud function factories to wrap for testing. */
  fns: T;
}

/**
 * Mapped type that transforms a {@link CloudFunctionTestConfigMapObject} into an object
 * whose keys are the original keys suffixed with `"CloudFn"` and whose values are the
 * corresponding {@link WrappedCloudFunction} instances.
 */
export type CloudFunctionTestMultipleFixture<T extends CloudFunctionTestConfigMapObject> = {
  [K in keyof T as K extends string ? `${K}CloudFn` : never]: T[K] extends WrapCloudFunctionForNestTestsInput<infer I> ? WrappedCloudFunction<I> : never;
};

/**
 * Test callback for multiple cloud functions. Receives a {@link CloudFunctionTestMultipleFixture}
 * containing all wrapped functions, keyed by their suffixed names.
 */
export type CloudFunctionTestMultipleFunction<T extends CloudFunctionTestConfigMapObject> = (fn: CloudFunctionTestMultipleFixture<T>) => void;

/**
 * Type guard that distinguishes a {@link CloudFunctionTestSingleConfig} from a
 * {@link CloudFunctionTestMultipleConfig} by checking for the presence of the `fn` property.
 */
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

    useTestFunctionFixture<CloudFunctionTestWrappedCloudFunction<I>>(
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

    useTestFunctionMapFixture(
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
