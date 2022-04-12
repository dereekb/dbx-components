import { JestBuildTestsWithContextFunction, JestTestContextFactory, JestTestContextFixture } from "@dereekb/util";
import { firebaseAdminNestContextWithFixture, FirebaseAdminNestTestConfig, FirebaseAdminNestTestContext, FirebaseAdminNestTestContextFixture, FirebaseAdminNestTestContextInstance } from "./firebase.admin.nest";
import { FirebaseAdminFunctionTestContextInstance, firebaseAdminFunctionTestContextFactory } from "./firebase.admin.function";
import { WrapCloudFunction } from './firebase.admin';

// MARK: FirebaseAdminFunction
export interface FirebaseAdminFunctionNestTestContext extends FirebaseAdminNestTestContext {
  get wrapCloudFunction(): WrapCloudFunction;
}

export class FirebaseAdminFunctionNestTestContextFixture<
  PI extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance,
  PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>,
  I extends FirebaseAdminFunctionNestTestContextInstance<PI> = FirebaseAdminFunctionNestTestContextInstance<PI>
  > extends FirebaseAdminNestTestContextFixture<PI, PF, I> implements FirebaseAdminFunctionNestTestContext {

  // MARK: FirebaseAdminTestContext (Forwarded)
  get wrapCloudFunction(): WrapCloudFunction {
    return this.parent.instance.wrapCloudFunction;
  }

}

export class FirebaseAdminFunctionNestTestContextInstance<
  PI extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance
  > extends FirebaseAdminNestTestContextInstance<PI> implements FirebaseAdminFunctionNestTestContext {

  // MARK: FirebaseAdminTestContext (Forwarded)
  get wrapCloudFunction(): WrapCloudFunction {
    return this.parent.wrapCloudFunction;
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
