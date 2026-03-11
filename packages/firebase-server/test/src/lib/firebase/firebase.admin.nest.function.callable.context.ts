import { useTestFunctionFixture, useTestFunctionMapFixture } from '@dereekb/util/test';
import { type FirebaseAdminFunctionNestTestContext, wrapCallableRequestForNestTestsGetter, type WrapCallableRequestForNestTestsInput } from './firebase.admin.nest.function';
import { mapObjectMap } from '@dereekb/util';
import { type WrappedCallableRequest } from './firebase.function';

// MARK: V1
/**
 * Base configuration shared by both single and multiple callable request test builders.
 * Provides the {@link FirebaseAdminFunctionNestTestContext} that supplies NestJS and
 * Cloud Function wrapping capabilities.
 */
export interface CallableRequestTestBaseConfig {
  /** The test context fixture providing NestJS module and function wrapping access. */
  readonly f: FirebaseAdminFunctionNestTestContext;
}

/**
 * Configuration for testing a single callable request function.
 * The `fn` factory is wrapped and provided to the test callback as a {@link WrappedCallableRequest}.
 */
export interface CallableRequestTestSingleConfig<I, O = unknown> extends CallableRequestTestBaseConfig {
  /** The callable HTTP function factory to wrap for testing. */
  readonly fn: WrapCallableRequestForNestTestsInput<I, O>;
}

/**
 * Test callback for a single callable request. Receives the wrapped callable function
 * and should register test cases (e.g., `it(...)` blocks) inside the callback body.
 */
export type CallableRequestTestSingleFunction<I, O = unknown> = (fn: WrappedCallableRequest<I, O>) => void;

/**
 * Map of named callable request function factories.
 *
 * Each key becomes a fixture property (with a {@link CallableRequestTestMultipleFixtureSuffix} suffix)
 * containing the corresponding {@link WrappedCallableRequest}.
 */
export type CallableRequestTestConfigMapObject = {
  [key: string]: WrapCallableRequestForNestTestsInput<any>;
};

/**
 * Configuration for testing multiple callable request functions simultaneously.
 * Each entry in `fns` is independently wrapped and exposed via a {@link CallableRequestTestMultipleFixture}.
 */
export interface CallableRequestTestMultipleConfig<I, T extends CallableRequestTestConfigMapObject> extends CallableRequestTestBaseConfig {
  /** Map of named callable function factories to wrap for testing. */
  fns: T;
}

/**
 * Suffix appended to each key in a {@link CallableRequestTestConfigMapObject} when building
 * the {@link CallableRequestTestMultipleFixture}. For example, a key `"createUser"` produces
 * a fixture property named `"createUserWrappedFn"`.
 */
export const CallableRequestTestMultipleFixtureSuffix = 'WrappedFn';

/**
 * Mapped type that transforms a {@link CallableRequestTestConfigMapObject} into an object
 * whose keys are the original keys suffixed with {@link CallableRequestTestMultipleFixtureSuffix}
 * and whose values are the corresponding {@link WrappedCallableRequest} instances.
 */
export type CallableRequestTestMultipleFixture<T extends CallableRequestTestConfigMapObject> = {
  [K in keyof T as K extends string ? `${K}${typeof CallableRequestTestMultipleFixtureSuffix}` : never]: T[K] extends WrapCallableRequestForNestTestsInput<infer I, infer O> ? WrappedCallableRequest<I, O> : never;
};

/**
 * Test callback for multiple callable requests. Receives a {@link CallableRequestTestMultipleFixture}
 * containing all wrapped functions, keyed by their suffixed names.
 */
export type CallableRequestTestMultipleFunction<T extends CallableRequestTestConfigMapObject> = (fn: CallableRequestTestMultipleFixture<T>) => void;

/**
 * Type guard that distinguishes a {@link CallableRequestTestSingleConfig} from a
 * {@link CallableRequestTestMultipleConfig} by checking for the presence of the `fn` property.
 */
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

    useTestFunctionFixture<WrappedCallableRequest<I>>(
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

    useTestFunctionMapFixture(
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
