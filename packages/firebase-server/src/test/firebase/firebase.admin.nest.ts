import { AbstractChildJestTestContextFixture, ArrayOrValue, asArray, ClassType, filterMaybeValues, Getter, JestBuildTestsWithContextFunction, JestTestContextFactory, JestTestContextFixture, useJestContextFixture } from "@dereekb/util";
import { firebaseAdminFunctionTestContextFactory, FirebaseAdminFunctionTestInstance, firebaseAdminTestContextFactory, FirebaseAdminTestInstance } from './firebase.admin';
import { Abstract, DynamicModule, INestApplicationContext, Provider, Type } from '@nestjs/common/interfaces';
import { Test, TestingModule } from '@nestjs/testing';

// MARK: FirebaseAdminNestTestBuilder
export interface FirebaseAdminNestTestConfig<F extends FirebaseAdminTestInstance, I extends FirebaseAdminNestTestInstance<F>> {
  /**
   * Root module to import.
   */
  nestModules: ArrayOrValue<ClassType>;
  makeInstance?: (instance: F, nest: TestingModule) => I;
  /**
   * Optional providers to pass to the TestingModule initialization.
   */
  makeProviders?: (instance: F) => Provider<any>[];
}

export class FirebaseAdminNestTestContextFixture<F extends FirebaseAdminTestInstance, I extends FirebaseAdminNestTestInstance<F>> extends AbstractChildJestTestContextFixture<I, JestTestContextFixture<F>> { }

export class FirebaseAdminNestTestInstance<F extends FirebaseAdminTestInstance = FirebaseAdminTestInstance> {

  readonly nestGetter: Getter<Promise<INestApplicationContext>> = () => Promise.resolve(this.nest);

  constructor(readonly instance: F, readonly nest: TestingModule) { }

  get<TInput = any, TResult = TInput>(typeOrToken: Type<TInput> | Abstract<TInput> | string | symbol, options?: {
    strict: boolean;
  }): TResult {
    return this.nest.get(typeOrToken, options);
  }

}

export type FirebaseAdminNestTestContextFactory<F extends FirebaseAdminTestInstance, I extends FirebaseAdminNestTestInstance<F>> = JestTestContextFactory<FirebaseAdminNestTestContextFixture<F, I>>;

export function firebaseAdminNestContextFixture<F extends FirebaseAdminTestInstance, I extends FirebaseAdminNestTestInstance<F>>(config: FirebaseAdminNestTestConfig<F, I>, factory: JestTestContextFactory<JestTestContextFixture<F>>): FirebaseAdminNestTestContextFactory<F, I> {
  return (buildTests: JestBuildTestsWithContextFunction<FirebaseAdminNestTestContextFixture<F, I>>) => {
    factory((f) => firebaseAdminNestContextWithFixture<F, I>(config, f, buildTests));
  };
}

export class FirebaseAdminNestRootModule { }

export function firebaseAdminNestContextWithFixture<F extends FirebaseAdminTestInstance, I extends FirebaseAdminNestTestInstance<F>>(config: FirebaseAdminNestTestConfig<F, I>, f: JestTestContextFixture<F>, buildTests: JestBuildTestsWithContextFunction<FirebaseAdminNestTestContextFixture<F, I>>) {
  const { nestModules, makeProviders = () => [], makeInstance = (instance, nest) => new FirebaseAdminNestTestInstance<F>(instance, nest) } = config;

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
      return makeInstance(f.instance, nest);
    },
    destroyInstance: async (instance) => {
      await instance.nest.close();
    }
  });
}

export function firebaseAdminNestContextFactory<I extends FirebaseAdminNestTestInstance<FirebaseAdminTestInstance>>(config: FirebaseAdminNestTestConfig<FirebaseAdminTestInstance, I>): FirebaseAdminNestTestContextFactory<FirebaseAdminTestInstance, I> {
  return firebaseAdminNestContextFixture<FirebaseAdminTestInstance, I>(config, firebaseAdminTestContextFactory);
}

export function firebaseAdminFunctionNestContextFactory<I extends FirebaseAdminNestTestInstance<FirebaseAdminFunctionTestInstance>>(config: FirebaseAdminNestTestConfig<FirebaseAdminFunctionTestInstance, I>): FirebaseAdminNestTestContextFactory<FirebaseAdminFunctionTestInstance, I> {
  return firebaseAdminNestContextFixture<FirebaseAdminFunctionTestInstance, I>(config, firebaseAdminFunctionTestContextFactory);
}
