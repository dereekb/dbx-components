import { AbstractChildJestTestContextFixture, ArrayOrValue, asArray, ClassType, Getter, JestBuildTestsWithContextFunction, JestTestContextFactory, JestTestContextFixture, useJestContextFixture } from "@dereekb/util";
import { AbstractFirebaseAdminTestContextInstanceChild, firebaseAdminTestContextFactory, FirebaseAdminTestContextInstance } from './firebase.admin';
import { Abstract, DynamicModule, INestApplicationContext, Provider, Type } from '@nestjs/common/interfaces';
import { Test, TestingModule } from '@nestjs/testing';

// MARK: FirebaseAdminNestTestBuilder
export interface FirebaseAdminNestTestConfig<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance, I extends FirebaseAdminNestTestContextInstance<F> = FirebaseAdminNestTestContextInstance<F>, C extends FirebaseAdminNestTestContextFixture<F, I> = FirebaseAdminNestTestContextFixture<F, I>> {
  /**
   * Creates a new fixture.
   */
  makeFixture?: (f: JestTestContextFixture<F>) => C;
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

export interface FirebaseAdminNestTestContext {
  readonly nest: TestingModule;
  readonly nestAppPromiseGetter: Getter<Promise<INestApplicationContext>>;
  get<TInput = any, TResult = TInput>(typeOrToken: Type<TInput> | Abstract<TInput> | string | symbol, options?: { strict: boolean; }): TResult;
}

export class FirebaseAdminNestTestContextFixture<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance, I extends FirebaseAdminNestTestContextInstance<F> = FirebaseAdminNestTestContextInstance<F>> extends AbstractChildJestTestContextFixture<I, JestTestContextFixture<F>> implements FirebaseAdminNestTestContext {

  // MARK: Forwarded
  get nest() {
    return this.instance.nest;
  }

  get nestAppPromiseGetter() {
    return this.instance.nestAppPromiseGetter;
  }

  get<TInput = any, TResult = TInput>(typeOrToken: Type<TInput> | Abstract<TInput> | string | symbol, options?: {
    strict: boolean;
  }): TResult {
    return this.instance.get(typeOrToken, options);
  }

}

export class FirebaseAdminNestTestContextInstance<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends AbstractFirebaseAdminTestContextInstanceChild<F> implements FirebaseAdminNestTestContext {

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

export type FirebaseAdminNestTestContextFactory<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance, I extends FirebaseAdminNestTestContextInstance<F> = FirebaseAdminNestTestContextInstance<F>> = JestTestContextFactory<FirebaseAdminNestTestContextFixture<F, I>>;

export function firebaseAdminNestContextFixture<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance, I extends FirebaseAdminNestTestContextInstance<F> = FirebaseAdminNestTestContextInstance<F>>(config: FirebaseAdminNestTestConfig<F, I>, factory: JestTestContextFactory<JestTestContextFixture<F>>): FirebaseAdminNestTestContextFactory<F, I> {
  return (buildTests: JestBuildTestsWithContextFunction<FirebaseAdminNestTestContextFixture<F, I>>) => {
    factory((f) => firebaseAdminNestContextWithFixture<F, I>(config, f, buildTests));
  };
}

export class FirebaseAdminNestRootModule { }

export function firebaseAdminNestContextWithFixture<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance, I extends FirebaseAdminNestTestContextInstance<F> = FirebaseAdminNestTestContextInstance<F>, C extends FirebaseAdminNestTestContextFixture<F, I> = FirebaseAdminNestTestContextFixture<F, I>>(config: FirebaseAdminNestTestConfig<F, I, C>, f: JestTestContextFixture<F>, buildTests: JestBuildTestsWithContextFunction<C>) {
  const {
    nestModules,
    makeProviders = () => [],
    makeFixture = (parent) => new FirebaseAdminNestTestContextFixture<F, I>(parent) as C,
    makeInstance = (instance, nest) => new FirebaseAdminNestTestContextInstance<F>(instance, nest) as I,
    initInstance
  } = config;

  useJestContextFixture({
    fixture: makeFixture(f),
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

export function firebaseAdminNestContextFactory<I extends FirebaseAdminNestTestContextInstance<FirebaseAdminTestContextInstance>>(config: FirebaseAdminNestTestConfig<FirebaseAdminTestContextInstance, I>): FirebaseAdminNestTestContextFactory<FirebaseAdminTestContextInstance, I> {
  return firebaseAdminNestContextFixture<FirebaseAdminTestContextInstance, I>(config, firebaseAdminTestContextFactory);
}
