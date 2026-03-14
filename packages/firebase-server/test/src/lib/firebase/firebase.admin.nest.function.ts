import { type Getter } from '@dereekb/util';
import { type BuildTestsWithContextFunction, type TestContextFactory, type TestContextFixture } from '@dereekb/util/test';
import { firebaseAdminNestContextWithFixture, type FirebaseAdminNestTestConfig, type FirebaseAdminNestTestContext, FirebaseAdminNestTestContextFixture, FirebaseAdminNestTestContextInstance } from './firebase.admin.nest';
import { type FirebaseAdminFunctionTestContextInstance, firebaseAdminFunctionTestContextFactory } from './firebase.admin.function';
import { type NestApplicationBlockingFunctionFactory, type NestApplicationCallableHttpFunctionFactory, type NestApplicationCloudEventFunctionFactory, type NestApplicationScheduleFunctionFactory } from '@dereekb/firebase-server';
import { type FirebaseAdminCloudFunctionWrapper, type FirebaseAdminCloudFunctionWrapperSource, wrapCallableRequestForTests, wrapCloudFunctionV1ForTests, type WrappedCloudFunctionV1, type WrappedCallableRequest } from './firebase.function';
import { type CloudEvent } from 'firebase-functions/v2';

// MARK: Utility
type WrapCloudFunctionForNestTestsInputNonEventTypes = NestApplicationScheduleFunctionFactory | NestApplicationBlockingFunctionFactory<any, unknown>;

/**
 * Input type for {@link wrapCloudFunctionForNestTestsGetter} that resolves to the appropriate
 * NestJS application function factory based on the event type `I`.
 *
 * When `I` is a {@link CloudEvent}, cloud event factories are also accepted; otherwise only
 * schedule and blocking function factories are valid.
 */
export type WrapCloudFunctionForNestTestsInput<I extends object> = I extends CloudEvent<any> ? NestApplicationCloudEventFunctionFactory<I> | WrapCloudFunctionForNestTestsInputNonEventTypes : WrapCloudFunctionForNestTestsInputNonEventTypes;

/**
 * Creates a lazy getter that wraps a NestJS-hosted Cloud Function (v1) for testing.
 *
 * The returned getter defers wrapping until first invocation, so the NestJS application
 * is resolved at call time rather than at setup time.
 *
 * @param wrapper - The test context providing the function wrapper and NestJS app promise.
 * @param fn - The NestJS application function factory to wrap.
 * @returns A getter that produces a {@link WrappedCloudFunctionV1} on each call.
 */
export function wrapCloudFunctionForNestTestsGetter<I extends object>(wrapper: FirebaseAdminFunctionNestTestContext, fn: WrapCloudFunctionForNestTestsInput<I>): Getter<WrappedCloudFunctionV1<I>> {
  return wrapCloudFunctionV1ForTests<I>(wrapper.fnWrapper, () => fn(wrapper.nestAppPromiseGetter) as any);
}

/**
 * Input type for {@link wrapCallableRequestForNestTestsGetter}. Accepts a NestJS application
 * callable HTTP function factory that produces a gen-2 callable function from a NestJS app promise.
 */
export type WrapCallableRequestForNestTestsInput<I, O = unknown> = NestApplicationCallableHttpFunctionFactory<I, O>;

/**
 * Creates a lazy getter that wraps a NestJS-hosted callable request function for testing.
 *
 * Similar to {@link wrapCloudFunctionForNestTestsGetter} but targets gen-2 callable HTTP
 * functions. The getter defers resolution so the NestJS app is available at call time.
 *
 * @param wrapper - The test context providing the function wrapper and NestJS app promise.
 * @param fn - The NestJS callable HTTP function factory to wrap.
 * @returns A getter that produces a {@link WrappedCallableRequest} on each call.
 */
export function wrapCallableRequestForNestTestsGetter<I, O = unknown>(wrapper: FirebaseAdminFunctionNestTestContext, fn: WrapCallableRequestForNestTestsInput<I, O>): Getter<WrappedCallableRequest<I, O>> {
  return wrapCallableRequestForTests<I, O>(wrapper.fnWrapper, () => fn(wrapper.nestAppPromiseGetter));
}

// MARK: FirebaseAdminFunction
/**
 * Combined test context that merges {@link FirebaseAdminNestTestContext} (NestJS module access)
 * with {@link FirebaseAdminCloudFunctionWrapperSource} (Cloud Function wrapping).
 *
 * Implementations provide both the NestJS {@link TestingModule} and the `fnWrapper` needed
 * to wrap and invoke Cloud Functions within integration tests.
 */
export interface FirebaseAdminFunctionNestTestContext extends FirebaseAdminNestTestContext, FirebaseAdminCloudFunctionWrapperSource {}

/**
 * Fixture that combines NestJS testing module access with Cloud Function wrapping capabilities.
 *
 * Extends {@link FirebaseAdminNestTestContextFixture} and adds convenience methods for wrapping
 * both v1 cloud functions and gen-2 callable requests directly from the fixture, delegating
 * to the standalone {@link wrapCloudFunctionForNestTestsGetter} and {@link wrapCallableRequestForNestTestsGetter} helpers.
 */
export class FirebaseAdminFunctionNestTestContextFixture<PI extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance, PF extends TestContextFixture<PI> = TestContextFixture<PI>, I extends FirebaseAdminFunctionNestTestContextInstance<PI> = FirebaseAdminFunctionNestTestContextInstance<PI>> extends FirebaseAdminNestTestContextFixture<PI, PF, I> implements FirebaseAdminFunctionNestTestContext {
  // MARK: FirebaseAdminTestContext (Forwarded)
  wrapCloudFunctionForNestTests<I extends object>(fn: WrapCloudFunctionForNestTestsInput<I>): WrappedCloudFunctionV1<I> {
    return this.wrapCloudFunctionForNestTestsGetter(fn)();
  }

  wrapCloudFunctionForNestTestsGetter<I extends object>(fn: WrapCloudFunctionForNestTestsInput<I>): Getter<WrappedCloudFunctionV1<I>> {
    return wrapCloudFunctionForNestTestsGetter(this, fn);
  }

  wrapCallableRequestForNestTests<I, O = unknown>(fn: WrapCallableRequestForNestTestsInput<I, O>): WrappedCallableRequest<I, O> {
    return this.wrapCallableRequestForNestTestsGetter(fn)();
  }

  wrapCallableRequestForNestTestsGetter<I, O = unknown>(fn: WrapCallableRequestForNestTestsInput<I, O>): Getter<WrappedCallableRequest<I, O>> {
    return wrapCallableRequestForNestTestsGetter(this, fn);
  }

  // MARK: FirebaseAdminCloudFunctionWrapperSource
  get fnWrapper(): FirebaseAdminCloudFunctionWrapper {
    return this.parent.instance.fnWrapper;
  }
}

/**
 * Concrete instance that extends {@link FirebaseAdminNestTestContextInstance} with the
 * {@link FirebaseAdminCloudFunctionWrapperSource} interface, delegating `fnWrapper` to
 * the parent {@link FirebaseAdminFunctionTestContextInstance}.
 */
export class FirebaseAdminFunctionNestTestContextInstance<PI extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends FirebaseAdminNestTestContextInstance<PI> implements FirebaseAdminFunctionNestTestContext {
  // MARK: FirebaseAdminTestContext (Forwarded)
  override get fnWrapper(): FirebaseAdminCloudFunctionWrapper {
    return this.parent.fnWrapper;
  }
}

/**
 * Configuration type for NestJS + Cloud Function test contexts.
 * Alias for {@link FirebaseAdminNestTestConfig} parameterized with function-aware types.
 */
export type FirebaseAdminFunctionNestTestConfig<PI extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance, PF extends TestContextFixture<PI> = TestContextFixture<PI>, I extends FirebaseAdminFunctionNestTestContextInstance<PI> = FirebaseAdminFunctionNestTestContextInstance<PI>, C extends FirebaseAdminFunctionNestTestContextFixture<PI, PF, I> = FirebaseAdminFunctionNestTestContextFixture<PI, PF, I>> = FirebaseAdminNestTestConfig<PI, PF, I, C>;

/**
 * Factory type that produces a {@link FirebaseAdminFunctionNestTestContextFixture} for each test suite.
 */
export type FirebaseAdminFunctionNestTestContextFactory<PI extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance, PF extends TestContextFixture<PI> = TestContextFixture<PI>, I extends FirebaseAdminFunctionNestTestContextInstance<PI> = FirebaseAdminFunctionNestTestContextInstance<PI>, C extends FirebaseAdminFunctionNestTestContextFixture<PI, PF, I> = FirebaseAdminFunctionNestTestContextFixture<PI, PF, I>> = TestContextFactory<C>;

/**
 * Composes a NestJS + Cloud Function test context on top of an existing parent factory.
 *
 * Use when the parent factory is custom; for the common case with default parent, prefer
 * {@link firebaseAdminFunctionNestContextFactory}.
 *
 * @param config - NestJS module, provider, and fixture configuration.
 * @param factory - The parent context factory providing the Firebase Admin function instance.
 * @returns A new factory combining NestJS and Cloud Function wrapping capabilities.
 */
export function firebaseAdminFunctionNestContextFixture<PI extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance, PF extends TestContextFixture<PI> = TestContextFixture<PI>, I extends FirebaseAdminFunctionNestTestContextInstance<PI> = FirebaseAdminFunctionNestTestContextInstance<PI>, C extends FirebaseAdminFunctionNestTestContextFixture<PI, PF, I> = FirebaseAdminFunctionNestTestContextFixture<PI, PF, I>>(
  config: FirebaseAdminFunctionNestTestConfig<PI, PF, I, C>,
  factory: TestContextFactory<PF>
): FirebaseAdminFunctionNestTestContextFactory<PI, PF, I, C> {
  return (buildTests: BuildTestsWithContextFunction<C>) => {
    factory((f) => firebaseAdminFunctionNestContextWithFixture<PI, PF, I, C>(config, f, buildTests));
  };
}

/**
 * Empty NestJS module class used as a placeholder root module for function nest test contexts.
 */
export class FirebaseAdminFunctionNestRootModule {}

/**
 * Wires up a NestJS {@link TestingModule} with Cloud Function wrapping inside an existing parent fixture.
 *
 * Merges default `makeFixture` / `makeInstance` implementations that produce function-aware
 * fixture and instance classes, then delegates to {@link firebaseAdminNestContextWithFixture}.
 *
 * @param config - NestJS module, provider, and fixture configuration.
 * @param f - The parent fixture that is already set up.
 * @param buildTests - Callback that receives the child fixture and registers test cases.
 */
export function firebaseAdminFunctionNestContextWithFixture<PI extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance, PF extends TestContextFixture<PI> = TestContextFixture<PI>, I extends FirebaseAdminFunctionNestTestContextInstance<PI> = FirebaseAdminFunctionNestTestContextInstance<PI>, C extends FirebaseAdminFunctionNestTestContextFixture<PI, PF, I> = FirebaseAdminFunctionNestTestContextFixture<PI, PF, I>>(
  config: FirebaseAdminFunctionNestTestConfig<PI, PF, I, C>,
  f: PF,
  buildTests: BuildTestsWithContextFunction<C>
) {
  const mergedConfig: FirebaseAdminFunctionNestTestConfig<PI, PF, I, C> = {
    makeFixture: (parent) => new FirebaseAdminFunctionNestTestContextFixture(parent) as C,
    makeInstance: (instance, nest) => new FirebaseAdminFunctionNestTestContextInstance<PI>(instance, nest) as I,
    ...config
  };

  return firebaseAdminNestContextWithFixture<PI, PF, I, C>(mergedConfig, f, buildTests);
}

/**
 * Convenience factory that layers a NestJS + Cloud Function test context on top of the
 * default {@link firebaseAdminFunctionTestContextFactory}. This is the simplest entry point
 * for tests that need both NestJS module access and Cloud Function wrapping.
 *
 * @example
 * ```ts
 * const f = firebaseAdminFunctionNestContextFactory({
 *   nestModules: [MyAppModule]
 * });
 *
 * f((c) => {
 *   describeCallableRequestTest('myCallable', { f: c, fn: myCallableFactory }, (wrappedFn) => {
 *     it('should succeed', async () => { ... });
 *   });
 * });
 * ```
 */
export function firebaseAdminFunctionNestContextFactory<I extends FirebaseAdminFunctionNestTestContextInstance<FirebaseAdminFunctionTestContextInstance> = FirebaseAdminFunctionNestTestContextInstance<FirebaseAdminFunctionTestContextInstance>>(
  config: FirebaseAdminFunctionNestTestConfig<FirebaseAdminFunctionTestContextInstance, TestContextFixture<FirebaseAdminFunctionTestContextInstance>, I>
): FirebaseAdminFunctionNestTestContextFactory<FirebaseAdminFunctionTestContextInstance, TestContextFixture<FirebaseAdminFunctionTestContextInstance>, I> {
  return firebaseAdminFunctionNestContextFixture<FirebaseAdminFunctionTestContextInstance, TestContextFixture<FirebaseAdminFunctionTestContextInstance>, I>(config, firebaseAdminFunctionTestContextFactory);
}
