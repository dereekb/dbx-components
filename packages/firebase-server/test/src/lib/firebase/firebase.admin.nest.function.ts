import { Getter } from "@dereekb/util";
import { JestBuildTestsWithContextFunction, JestTestContextFactory, JestTestContextFixture } from '@dereekb/util/test';
import { firebaseAdminNestContextWithFixture, FirebaseAdminNestTestConfig, FirebaseAdminNestTestContext, FirebaseAdminNestTestContextFixture, FirebaseAdminNestTestContextInstance } from "./firebase.admin.nest";
import { FirebaseAdminFunctionTestContextInstance, firebaseAdminFunctionTestContextFactory } from "./firebase.admin.function";
import { NestApplicationRunnableHttpFunctionFactory } from "@dereekb/firebase-server";
import { FirebaseAdminCloudFunctionWrapper, FirebaseAdminCloudFunctionWrapperSource, wrapCloudFunctionV1ForTests, WrappedCloudFunctionV1 } from "./firebase.function";

// MARK: Utility
export function wrapCloudFunctionForNestTestsGetter<I>(wrapper: FirebaseAdminFunctionNestTestContext, fn: NestApplicationRunnableHttpFunctionFactory<I>): Getter<WrappedCloudFunctionV1<I>> {
  return wrapCloudFunctionV1ForTests<I>(wrapper.fnWrapper, () => fn(wrapper.nestAppPromiseGetter));
}

// MARK: FirebaseAdminFunction
export interface FirebaseAdminFunctionNestTestContext extends FirebaseAdminNestTestContext, FirebaseAdminCloudFunctionWrapperSource { }

export class FirebaseAdminFunctionNestTestContextFixture<
  PI extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance,
  PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>,
  I extends FirebaseAdminFunctionNestTestContextInstance<PI> = FirebaseAdminFunctionNestTestContextInstance<PI>
  > extends FirebaseAdminNestTestContextFixture<PI, PF, I> implements FirebaseAdminFunctionNestTestContext {

  // MARK: FirebaseAdminTestContext (Forwarded)
  wrapCloudFunctionForNestTests<I>(fn: NestApplicationRunnableHttpFunctionFactory<I>): WrappedCloudFunctionV1<I> {
    return this.wrapCloudFunctionForNestTestsGetter(fn)();
  }

  wrapCloudFunctionForNestTestsGetter<I>(fn: NestApplicationRunnableHttpFunctionFactory<I>): Getter<WrappedCloudFunctionV1<I>> {
    return wrapCloudFunctionForNestTestsGetter(this, fn);
  }

  // MARK: FirebaseAdminCloudFunctionWrapperSource
  get fnWrapper(): FirebaseAdminCloudFunctionWrapper {
    return this.parent.instance.fnWrapper;
  }

}

export class FirebaseAdminFunctionNestTestContextInstance<
  PI extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance
  > extends FirebaseAdminNestTestContextInstance<PI> implements FirebaseAdminFunctionNestTestContext {

  // MARK: FirebaseAdminTestContext (Forwarded)
  get fnWrapper(): FirebaseAdminCloudFunctionWrapper {
    return this.parent.fnWrapper;
  }

}

export interface FirebaseAdminFunctionNestTestConfig<
  PI extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance,
  PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>,
  I extends FirebaseAdminFunctionNestTestContextInstance<PI> = FirebaseAdminFunctionNestTestContextInstance<PI>,
  C extends FirebaseAdminFunctionNestTestContextFixture<PI, PF, I> = FirebaseAdminFunctionNestTestContextFixture<PI, PF, I>
  > extends FirebaseAdminNestTestConfig<PI, PF, I, C> { }

export type FirebaseAdminFunctionNestTestContextFactory<
  PI extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance,
  PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>,
  I extends FirebaseAdminFunctionNestTestContextInstance<PI> = FirebaseAdminFunctionNestTestContextInstance<PI>,
  C extends FirebaseAdminFunctionNestTestContextFixture<PI, PF, I> = FirebaseAdminFunctionNestTestContextFixture<PI, PF, I>
  > = JestTestContextFactory<C>;

export function firebaseAdminFunctionNestContextFixture<
  PI extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance,
  PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>,
  I extends FirebaseAdminFunctionNestTestContextInstance<PI> = FirebaseAdminFunctionNestTestContextInstance<PI>,
  C extends FirebaseAdminFunctionNestTestContextFixture<PI, PF, I> = FirebaseAdminFunctionNestTestContextFixture<PI, PF, I>
>(config: FirebaseAdminFunctionNestTestConfig<PI, PF, I, C>, factory: JestTestContextFactory<PF>): FirebaseAdminFunctionNestTestContextFactory<PI, PF, I, C> {
  return (buildTests: JestBuildTestsWithContextFunction<C>) => {
    factory((f) => firebaseAdminFunctionNestContextWithFixture<PI, PF, I, C>(config, f, buildTests));
  };
}

export class FirebaseAdminFunctionNestRootModule { }

export function firebaseAdminFunctionNestContextWithFixture<
  PI extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance,
  PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>,
  I extends FirebaseAdminFunctionNestTestContextInstance<PI> = FirebaseAdminFunctionNestTestContextInstance<PI>,
  C extends FirebaseAdminFunctionNestTestContextFixture<PI, PF, I> = FirebaseAdminFunctionNestTestContextFixture<PI, PF, I>
>(config: FirebaseAdminFunctionNestTestConfig<PI, PF, I, C>, f: PF, buildTests: JestBuildTestsWithContextFunction<C>) {
  const mergedConfig: FirebaseAdminFunctionNestTestConfig<PI, PF, I, C> = {
    makeFixture: (parent) => new FirebaseAdminFunctionNestTestContextFixture(parent) as C,
    makeInstance: (instance, nest) => new FirebaseAdminFunctionNestTestContextInstance<PI>(instance, nest) as I,
    ...config
  };

  return firebaseAdminNestContextWithFixture<PI, PF, I, C>(mergedConfig, f, buildTests);
}

export function firebaseAdminFunctionNestContextFactory<
  I extends FirebaseAdminFunctionNestTestContextInstance<FirebaseAdminFunctionTestContextInstance> = FirebaseAdminFunctionNestTestContextInstance<FirebaseAdminFunctionTestContextInstance>
>(config: FirebaseAdminFunctionNestTestConfig<FirebaseAdminFunctionTestContextInstance, JestTestContextFixture<FirebaseAdminFunctionTestContextInstance>, I>): FirebaseAdminFunctionNestTestContextFactory<FirebaseAdminFunctionTestContextInstance, JestTestContextFixture<FirebaseAdminFunctionTestContextInstance>, I> {
  return firebaseAdminFunctionNestContextFixture<FirebaseAdminFunctionTestContextInstance, JestTestContextFixture<FirebaseAdminFunctionTestContextInstance>, I>(config, firebaseAdminFunctionTestContextFactory);
}
