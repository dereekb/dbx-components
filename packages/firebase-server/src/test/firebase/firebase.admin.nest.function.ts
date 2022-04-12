import { JestBuildTestsWithContextFunction, JestTestContextFactory, JestTestContextFixture } from "@dereekb/util";
import { firebaseAdminNestContextWithFixture, FirebaseAdminNestTestConfig, FirebaseAdminNestTestContext, FirebaseAdminNestTestContextFixture, FirebaseAdminNestTestContextInstance } from "./firebase.admin.nest";
import { FirebaseAdminFunctionTestContextInstance, firebaseAdminFunctionTestContextFactory } from "./firebase.admin.function";
import { WrapCloudFunction } from './firebase.admin.function';

// MARK: FirebaseAdminFunction
export interface FirebaseAdminFunctionNestTestContext extends FirebaseAdminNestTestContext {
  get wrapCloudFunction(): WrapCloudFunction;
}

export class FirebaseAdminFunctionNestTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance, I extends FirebaseAdminFunctionNestTestContextInstance<F> = FirebaseAdminFunctionNestTestContextInstance<F>> extends FirebaseAdminNestTestContextFixture<F, I> implements FirebaseAdminFunctionNestTestContext {

  // MARK: FirebaseAdminTestContext (Forwarded)
  get wrapCloudFunction(): WrapCloudFunction {
    return this.parent.instance.wrapCloudFunction;
  }

}

export class FirebaseAdminFunctionNestTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends FirebaseAdminNestTestContextInstance<F> implements FirebaseAdminFunctionNestTestContext {

  // MARK: FirebaseAdminTestContext (Forwarded)
  get wrapCloudFunction(): WrapCloudFunction {
    return this.parent.wrapCloudFunction;
  }

}

export interface FirebaseAdminFunctionNestTestConfig<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance, I extends FirebaseAdminFunctionNestTestContextInstance<F> = FirebaseAdminFunctionNestTestContextInstance<F>, C extends FirebaseAdminFunctionNestTestContextFixture<F, I> = FirebaseAdminFunctionNestTestContextFixture<F, I>> extends FirebaseAdminNestTestConfig<F, I, C> { }

export type FirebaseAdminFunctionNestTestContextFactory<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance, I extends FirebaseAdminFunctionNestTestContextInstance<F> = FirebaseAdminFunctionNestTestContextInstance<F>, C extends FirebaseAdminFunctionNestTestContextFixture<F, I> = FirebaseAdminFunctionNestTestContextFixture<F, I>> = JestTestContextFactory<C>;

export function firebaseAdminFunctionNestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance, I extends FirebaseAdminFunctionNestTestContextInstance<F> = FirebaseAdminFunctionNestTestContextInstance<F>, C extends FirebaseAdminFunctionNestTestContextFixture<F, I> = FirebaseAdminFunctionNestTestContextFixture<F, I>>(config: FirebaseAdminFunctionNestTestConfig<F, I, C>, factory: JestTestContextFactory<JestTestContextFixture<F>>): FirebaseAdminFunctionNestTestContextFactory<F, I, C> {
  return (buildTests: JestBuildTestsWithContextFunction<C>) => {
    factory((f) => firebaseAdminFunctionNestContextWithFixture<F, I, C>(config, f, buildTests));
  };
}

export class FirebaseAdminFunctionNestRootModule { }

export function firebaseAdminFunctionNestContextWithFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance, I extends FirebaseAdminFunctionNestTestContextInstance<F> = FirebaseAdminFunctionNestTestContextInstance<F>, C extends FirebaseAdminFunctionNestTestContextFixture<F, I> = FirebaseAdminFunctionNestTestContextFixture<F, I>>(config: FirebaseAdminFunctionNestTestConfig<F, I, C>, f: JestTestContextFixture<F>, buildTests: JestBuildTestsWithContextFunction<C>) {
  const mergedConfig: FirebaseAdminFunctionNestTestConfig<F, I, C> = {
    makeFixture: (parent) => new FirebaseAdminFunctionNestTestContextFixture(parent) as C,
    makeInstance: (instance, nest) => new FirebaseAdminFunctionNestTestContextInstance<F>(instance, nest) as I,
    ...config
  };

  return firebaseAdminNestContextWithFixture<F, I>(mergedConfig, f, buildTests as any);
}

export function firebaseAdminFunctionNestContextFactory<I extends FirebaseAdminFunctionNestTestContextInstance = FirebaseAdminFunctionNestTestContextInstance>(config: FirebaseAdminFunctionNestTestConfig<FirebaseAdminFunctionTestContextInstance, I>): FirebaseAdminFunctionNestTestContextFactory<FirebaseAdminFunctionTestContextInstance, I> {
  return firebaseAdminFunctionNestContextFixture<FirebaseAdminFunctionTestContextInstance, I>(config, firebaseAdminFunctionTestContextFactory);
}
