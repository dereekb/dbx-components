import { type Getter } from '@dereekb/util';
import { type JestBuildTestsWithContextFunction, type JestTestContextFactory, type JestTestContextFixture } from '@dereekb/util/test';
import { firebaseAdminNestContextWithFixture, type FirebaseAdminNestTestConfig, type FirebaseAdminNestTestContext, FirebaseAdminNestTestContextFixture, FirebaseAdminNestTestContextInstance } from './firebase.admin.nest';
import { type FirebaseAdminFunctionTestContextInstance, firebaseAdminFunctionTestContextFactory } from './firebase.admin.function';
import { type NestApplicationBlockingFunctionFactory, type NestApplicationCallableHttpFunctionFactory, type NestApplicationCloudEventFunctionFactory, type NestApplicationRunnableHttpFunctionFactory, type NestApplicationScheduleCloudFunctionFactory, type NestApplicationScheduleFunctionFactory } from '@dereekb/firebase-server';
import { type FirebaseAdminCloudFunctionWrapper, type FirebaseAdminCloudFunctionWrapperSource, wrapCallableRequestForTests, wrapCloudFunctionV1ForTests, type WrappedCloudFunctionV1, type WrappedCallableRequest } from './firebase.function';
import { type CloudEvent } from 'firebase-functions/v2';

// MARK: Utility
type WrapCloudFunctionForNestTestsInputNonEventTypes = NestApplicationScheduleFunctionFactory | NestApplicationBlockingFunctionFactory<any, unknown> | NestApplicationRunnableHttpFunctionFactory<any> | NestApplicationScheduleCloudFunctionFactory<any>;

export type WrapCloudFunctionForNestTestsInput<I extends object> = I extends CloudEvent<any> ? NestApplicationCloudEventFunctionFactory<I> | WrapCloudFunctionForNestTestsInputNonEventTypes : WrapCloudFunctionForNestTestsInputNonEventTypes;

export function wrapCloudFunctionForNestTestsGetter<I extends object>(wrapper: FirebaseAdminFunctionNestTestContext, fn: WrapCloudFunctionForNestTestsInput<I>): Getter<WrappedCloudFunctionV1<I>> {
  return wrapCloudFunctionV1ForTests<I>(wrapper.fnWrapper, () => fn(wrapper.nestAppPromiseGetter) as any);
}

export type WrapCallableRequestForNestTestsInput<I, O = unknown> = NestApplicationCallableHttpFunctionFactory<I, O>;

export function wrapCallableRequestForNestTestsGetter<I, O = unknown>(wrapper: FirebaseAdminFunctionNestTestContext, fn: WrapCallableRequestForNestTestsInput<I, O>): Getter<WrappedCallableRequest<I, O>> {
  return wrapCallableRequestForTests<I, O>(wrapper.fnWrapper, () => fn(wrapper.nestAppPromiseGetter));
}

// MARK: FirebaseAdminFunction
export interface FirebaseAdminFunctionNestTestContext extends FirebaseAdminNestTestContext, FirebaseAdminCloudFunctionWrapperSource {}

export class FirebaseAdminFunctionNestTestContextFixture<PI extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance, PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>, I extends FirebaseAdminFunctionNestTestContextInstance<PI> = FirebaseAdminFunctionNestTestContextInstance<PI>> extends FirebaseAdminNestTestContextFixture<PI, PF, I> implements FirebaseAdminFunctionNestTestContext {
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

export class FirebaseAdminFunctionNestTestContextInstance<PI extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends FirebaseAdminNestTestContextInstance<PI> implements FirebaseAdminFunctionNestTestContext {
  // MARK: FirebaseAdminTestContext (Forwarded)
  override get fnWrapper(): FirebaseAdminCloudFunctionWrapper {
    return this.parent.fnWrapper;
  }
}

export type FirebaseAdminFunctionNestTestConfig<PI extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance, PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>, I extends FirebaseAdminFunctionNestTestContextInstance<PI> = FirebaseAdminFunctionNestTestContextInstance<PI>, C extends FirebaseAdminFunctionNestTestContextFixture<PI, PF, I> = FirebaseAdminFunctionNestTestContextFixture<PI, PF, I>> = FirebaseAdminNestTestConfig<PI, PF, I, C>;

export type FirebaseAdminFunctionNestTestContextFactory<PI extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance, PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>, I extends FirebaseAdminFunctionNestTestContextInstance<PI> = FirebaseAdminFunctionNestTestContextInstance<PI>, C extends FirebaseAdminFunctionNestTestContextFixture<PI, PF, I> = FirebaseAdminFunctionNestTestContextFixture<PI, PF, I>> = JestTestContextFactory<C>;

export function firebaseAdminFunctionNestContextFixture<PI extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance, PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>, I extends FirebaseAdminFunctionNestTestContextInstance<PI> = FirebaseAdminFunctionNestTestContextInstance<PI>, C extends FirebaseAdminFunctionNestTestContextFixture<PI, PF, I> = FirebaseAdminFunctionNestTestContextFixture<PI, PF, I>>(
  config: FirebaseAdminFunctionNestTestConfig<PI, PF, I, C>,
  factory: JestTestContextFactory<PF>
): FirebaseAdminFunctionNestTestContextFactory<PI, PF, I, C> {
  return (buildTests: JestBuildTestsWithContextFunction<C>) => {
    factory((f) => firebaseAdminFunctionNestContextWithFixture<PI, PF, I, C>(config, f, buildTests));
  };
}

export class FirebaseAdminFunctionNestRootModule {}

export function firebaseAdminFunctionNestContextWithFixture<PI extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance, PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>, I extends FirebaseAdminFunctionNestTestContextInstance<PI> = FirebaseAdminFunctionNestTestContextInstance<PI>, C extends FirebaseAdminFunctionNestTestContextFixture<PI, PF, I> = FirebaseAdminFunctionNestTestContextFixture<PI, PF, I>>(
  config: FirebaseAdminFunctionNestTestConfig<PI, PF, I, C>,
  f: PF,
  buildTests: JestBuildTestsWithContextFunction<C>
) {
  const mergedConfig: FirebaseAdminFunctionNestTestConfig<PI, PF, I, C> = {
    makeFixture: (parent) => new FirebaseAdminFunctionNestTestContextFixture(parent) as C,
    makeInstance: (instance, nest) => new FirebaseAdminFunctionNestTestContextInstance<PI>(instance, nest) as I,
    ...config
  };

  return firebaseAdminNestContextWithFixture<PI, PF, I, C>(mergedConfig, f, buildTests);
}

export function firebaseAdminFunctionNestContextFactory<I extends FirebaseAdminFunctionNestTestContextInstance<FirebaseAdminFunctionTestContextInstance> = FirebaseAdminFunctionNestTestContextInstance<FirebaseAdminFunctionTestContextInstance>>(
  config: FirebaseAdminFunctionNestTestConfig<FirebaseAdminFunctionTestContextInstance, JestTestContextFixture<FirebaseAdminFunctionTestContextInstance>, I>
): FirebaseAdminFunctionNestTestContextFactory<FirebaseAdminFunctionTestContextInstance, JestTestContextFixture<FirebaseAdminFunctionTestContextInstance>, I> {
  return firebaseAdminFunctionNestContextFixture<FirebaseAdminFunctionTestContextInstance, JestTestContextFixture<FirebaseAdminFunctionTestContextInstance>, I>(config, firebaseAdminFunctionTestContextFactory);
}
