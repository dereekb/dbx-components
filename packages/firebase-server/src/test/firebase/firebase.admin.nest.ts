import { AbstractChildJestTestContextFixture, ArrayOrValue, asArray, ClassType, filterMaybeValues, Getter, JestBuildTestsWithContextFunction, JestTestContextFactory, JestTestContextFixture, useJestContextFixture } from "@dereekb/util";
import { AbstractFirebaseAdminTestContextInstanceChild, FirebaseAdminFunctionTestConfig, FirebaseAdminFunctionTestContext, FirebaseAdminFunctionTestContextFactory, firebaseAdminFunctionTestContextFactory, FirebaseAdminFunctionTestContextFixture, FirebaseAdminFunctionTestContextInstance, FirebaseAdminTestContext, firebaseAdminTestContextFactory, FirebaseAdminTestContextInstance, WrapCloudFunction } from './firebase.admin';
import { Abstract, DynamicModule, INestApplicationContext, Provider, Type } from '@nestjs/common/interfaces';
import { Test, TestingModule } from '@nestjs/testing';

// MARK: FirebaseAdminNestTestBuilder
export interface FirebaseAdminNestTestConfig<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance, I extends FirebaseAdminNestTestInstance<F> = FirebaseAdminNestTestInstance<F>> {
  /**
   * Root module to import.
   */
  nestModules: ArrayOrValue<ClassType>;
  /**
   * Optional providers to pass to the TestingModule initialization.
   */
  makeProviders?: (instance: F) => Provider<any>[];
  /**
   * Creates a new instance.
   */
  makeInstance?: (instance: F, nest: TestingModule) => I;
  /**
   * Optional function to initialize the instance.
   */
  initInstance?: (instance: I) => Promise<void>;
}

export class FirebaseAdminNestTestContextFixture<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance, I extends FirebaseAdminNestTestInstance<F> = FirebaseAdminNestTestInstance<F>> extends AbstractChildJestTestContextFixture<I, JestTestContextFixture<F>> {

  // MARK: Forwarded
  get nestAppPromiseGetter() {
    return this.instance.nestAppPromiseGetter;
  }

}

export class FirebaseAdminNestTestInstance<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends AbstractFirebaseAdminTestContextInstanceChild<F> {

  readonly nestAppPromiseGetter: Getter<Promise<INestApplicationContext>> = () => Promise.resolve(this.nest);

  constructor(parent: F, readonly nest: TestingModule) {
    super(parent);
  }

  get<TInput = any, TResult = TInput>(typeOrToken: Type<TInput> | Abstract<TInput> | string | symbol, options?: {
    strict: boolean;
  }): TResult {
    return this.nest.get(typeOrToken, options);
  }

}

export type FirebaseAdminNestTestContextFactory<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance, I extends FirebaseAdminNestTestInstance<F> = FirebaseAdminNestTestInstance<F>> = JestTestContextFactory<FirebaseAdminNestTestContextFixture<F, I>>;

export function firebaseAdminNestContextFixture<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance, I extends FirebaseAdminNestTestInstance<F> = FirebaseAdminNestTestInstance<F>>(config: FirebaseAdminNestTestConfig<F, I>, factory: JestTestContextFactory<JestTestContextFixture<F>>): FirebaseAdminNestTestContextFactory<F, I> {
  return (buildTests: JestBuildTestsWithContextFunction<FirebaseAdminNestTestContextFixture<F, I>>) => {
    factory((f) => firebaseAdminNestContextWithFixture<F, I>(config, f, buildTests));
  };
}

export class FirebaseAdminNestRootModule { }

export function firebaseAdminNestContextWithFixture<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance, I extends FirebaseAdminNestTestInstance<F> = FirebaseAdminNestTestInstance<F>>(config: FirebaseAdminNestTestConfig<F, I>, f: JestTestContextFixture<F>, buildTests: JestBuildTestsWithContextFunction<FirebaseAdminNestTestContextFixture<F, I>>) {
  const { nestModules, makeProviders = () => [], makeInstance = (instance, nest) => new FirebaseAdminNestTestInstance<F>(instance, nest) as I, initInstance } = config;

  useJestContextFixture({
    fixture: new FirebaseAdminNestTestContextFixture<F, I>(f),
    /**
     * Build tests by passing the fixture to the testing functions.
     * 
     * This will inject all tests and sub Jest lifecycle items.
     */
    buildTests,
    initInstance: async () => {
      const imports = asArray(nestModules);
      const providers = makeProviders(f.instance) ?? [];

      const rootModule: DynamicModule = {
        module: FirebaseAdminNestRootModule,
        providers,
        exports: providers,
        global: true
      };

      const builder = (Test.createTestingModule({
        imports: [rootModule, ...imports]
      }));

      const nest = await builder.compile();
      const instance: I = makeInstance(f.instance, nest);

      console.log('Instance: ', instance);

      if (initInstance) {
        await initInstance(instance);
      }

      return instance;
    },
    destroyInstance: async (instance) => {
      await instance.nest.close();
    }
  });
}

export function firebaseAdminNestContextFactory<I extends FirebaseAdminNestTestInstance<FirebaseAdminTestContextInstance>>(config: FirebaseAdminNestTestConfig<FirebaseAdminTestContextInstance, I>): FirebaseAdminNestTestContextFactory<FirebaseAdminTestContextInstance, I> {
  return firebaseAdminNestContextFixture<FirebaseAdminTestContextInstance, I>(config, firebaseAdminTestContextFactory);
}

// MARK: FirebaseAdminFunction
export class FirebaseAdminFunctionNestTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance, I extends FirebaseAdminFunctionNestTestInstance<F> = FirebaseAdminFunctionNestTestInstance<F>> extends FirebaseAdminNestTestContextFixture<F, I> {

  // MARK: FirebaseAdminTestContext (Forwarded)
  get wrapCloudFunction(): WrapCloudFunction {
    return this.parent.instance.wrapCloudFunction;
  }

}

export class FirebaseAdminFunctionNestTestInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends FirebaseAdminNestTestInstance<F> implements FirebaseAdminFunctionTestContext {

  // MARK: FirebaseAdminTestContext (Forwarded)
  get wrapCloudFunction(): WrapCloudFunction {
    return this.parent.wrapCloudFunction;
  }

}

export interface FirebaseAdminFunctionNestTestConfig<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance, I extends FirebaseAdminFunctionNestTestInstance<F> = FirebaseAdminFunctionNestTestInstance<F>> extends FirebaseAdminNestTestConfig<F, I> { }

export type FirebaseAdminFunctionNestTestContextFactory<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance, I extends FirebaseAdminFunctionNestTestInstance<F> = FirebaseAdminFunctionNestTestInstance<F>> = JestTestContextFactory<FirebaseAdminFunctionNestTestContextFixture<F, I>>;

export function firebaseAdminFunctionNestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance, I extends FirebaseAdminFunctionNestTestInstance<F> = FirebaseAdminFunctionNestTestInstance<F>>(config: FirebaseAdminFunctionNestTestConfig<F, I>, factory: JestTestContextFactory<JestTestContextFixture<F>>): FirebaseAdminFunctionNestTestContextFactory<F, I> {
  return (buildTests: JestBuildTestsWithContextFunction<FirebaseAdminFunctionNestTestContextFixture<F, I>>) => {
    factory((f) => firebaseAdminFunctionNestContextWithFixture<F, I>(config, f, buildTests));
  };
}

export class FirebaseAdminFunctionNestRootModule { }

export function firebaseAdminFunctionNestContextWithFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance, I extends FirebaseAdminFunctionNestTestInstance<F> = FirebaseAdminFunctionNestTestInstance<F>>(config: FirebaseAdminFunctionNestTestConfig<F, I>, f: JestTestContextFixture<F>, buildTests: JestBuildTestsWithContextFunction<FirebaseAdminFunctionNestTestContextFixture<F, I>>) {
  const mergedConfig: FirebaseAdminFunctionNestTestConfig<F, I> = {
    makeInstance: (instance, nest) => new FirebaseAdminFunctionNestTestInstance<F>(instance, nest) as I,
    ...config
  };

  return firebaseAdminNestContextWithFixture<F, I>(mergedConfig, f, buildTests as any);
}

export function firebaseAdminFunctionNestContextFactory<I extends FirebaseAdminFunctionNestTestInstance = FirebaseAdminFunctionNestTestInstance>(config: FirebaseAdminFunctionNestTestConfig<FirebaseAdminFunctionTestContextInstance, I>): FirebaseAdminFunctionNestTestContextFactory<FirebaseAdminFunctionTestContextInstance, I> {
  return firebaseAdminFunctionNestContextFixture<FirebaseAdminFunctionTestContextInstance, I>(config, firebaseAdminFunctionTestContextFactory);
}
