import { AbstractChildJestTestContextFixture, ArrayOrValue, asArray, asGetter, ClassType, Getter, JestBuildTestsWithContextFunction, JestTestContextFactory, JestTestContextFixture, useJestContextFixture } from "@dereekb/util";
import { AbstractFirebaseAdminTestContextInstanceChild, FirebaseAdminCloudFunctionWrapper, firebaseAdminTestContextFactory, FirebaseAdminTestContextInstance, wrapCloudFunctionForTests, WrapCloudFunctionInput, WrappedCloudFunction } from './firebase.admin';
import { Abstract, DynamicModule, INestApplicationContext, Provider, Type } from '@nestjs/common/interfaces';
import { NestAppPromiseGetter } from "../../lib/nest/app";
import { Test, TestingModule } from '@nestjs/testing';
import { firebaseServerAppTokenProvider } from "../../lib/firebase/firebase.nest";

// MARK: FirebaseAdminNestTestBuilder
export interface FirebaseAdminNestTestContext {
  readonly nest: TestingModule;
  readonly nestAppPromiseGetter: NestAppPromiseGetter;
  get<TInput = any, TResult = TInput>(typeOrToken: Type<TInput> | Abstract<TInput> | string | symbol, options?: { strict: boolean; }): TResult;
}

export type FirebaseAdminNestTestContextFixtureType<PI extends FirebaseAdminTestContextInstance> = FirebaseAdminNestTestContext & JestTestContextFixture<PI>;

export class FirebaseAdminNestTestContextFixture<
  PI extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance,
  PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>,
  I extends FirebaseAdminNestTestContextInstance<PI> = FirebaseAdminNestTestContextInstance<PI>
  > extends AbstractChildJestTestContextFixture<I, PF> implements FirebaseAdminNestTestContext {

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

export class FirebaseAdminNestTestContextInstance<
  PI extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance
  > extends AbstractFirebaseAdminTestContextInstanceChild<PI> implements FirebaseAdminNestTestContext {

  readonly nestAppPromiseGetter: Getter<Promise<INestApplicationContext>> = () => Promise.resolve(this.nest);

  constructor(parent: PI, readonly nest: TestingModule) {
    super(parent);
  }

  get<TInput = any, TResult = TInput>(typeOrToken: Type<TInput> | Abstract<TInput> | string | symbol, options?: {
    strict: boolean;
  }): TResult {
    return this.nest.get(typeOrToken, options);
  }

}

export interface FirebaseAdminNestTestConfig<
  PI extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance,
  PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>,
  I extends FirebaseAdminNestTestContextInstance<PI> = FirebaseAdminNestTestContextInstance<PI>,
  C extends FirebaseAdminNestTestContextFixture<PI, PF, I> = FirebaseAdminNestTestContextFixture<PI, PF, I>
  > {
  /**
   * Creates a new fixture.
   */
  makeFixture?: (f: PF) => C;
  /**
   * Root module to import.
   */
  nestModules: ArrayOrValue<ClassType>;
  /**
   * Whether or not to inject the firebase server provider (firebaseServerAppTokenProvider()).
   * 
   * This makes FIREBASE_APP_TOKEN available globally and provides the app configured for this test.
   */
  injectFirebaseServerAppTokenProvider?: boolean;
  /**
   * Optional providers to pass to the TestingModule initialization.
   */
  makeProviders?: (instance: PI) => Provider<any>[];
  /**
   * Creates a new instance.
   */
  makeInstance?: (instance: PI, nest: TestingModule) => I;
  /**
   * Optional function to initialize the instance.
   */
  initInstance?: (instance: I) => Promise<void>;
}

export type FirebaseAdminNestTestContextFactory<
  PI extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance,
  PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>,
  I extends FirebaseAdminNestTestContextInstance<PI> = FirebaseAdminNestTestContextInstance<PI>,
  C extends FirebaseAdminNestTestContextFixture<PI, PF, I> = FirebaseAdminNestTestContextFixture<PI, PF, I>
  > = JestTestContextFactory<C>;

export function firebaseAdminNestContextFixture<
  PI extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance,
  PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>,
  I extends FirebaseAdminNestTestContextInstance<PI> = FirebaseAdminNestTestContextInstance<PI>,
  C extends FirebaseAdminNestTestContextFixture<PI, PF, I> = FirebaseAdminNestTestContextFixture<PI, PF, I>
>(config: FirebaseAdminNestTestConfig<PI, PF, I, C>, factory: JestTestContextFactory<PF>): FirebaseAdminNestTestContextFactory<PI, PF, I, C> {
  return (buildTests: JestBuildTestsWithContextFunction<C>) => {
    factory((f) => firebaseAdminNestContextWithFixture<PI, PF, I, C>(config, f, buildTests));
  };
}

export class FirebaseAdminNestRootModule { }

export function firebaseAdminNestContextWithFixture<
  PI extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance,
  PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>,
  I extends FirebaseAdminNestTestContextInstance<PI> = FirebaseAdminNestTestContextInstance<PI>,
  C extends FirebaseAdminNestTestContextFixture<PI, PF, I> = FirebaseAdminNestTestContextFixture<PI, PF, I>
>(config: FirebaseAdminNestTestConfig<PI, PF, I, C>, f: PF, buildTests: JestBuildTestsWithContextFunction<C>) {
  const {
    nestModules,
    makeProviders = () => [],
    injectFirebaseServerAppTokenProvider,
    makeFixture = (parent: PF) => new FirebaseAdminNestTestContextFixture<PI, PF, I>(parent) as C,
    makeInstance = (instance, nest) => new FirebaseAdminNestTestContextInstance<PI>(instance, nest) as I,
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

      // Inject the firebaseServerAppTokenProvider
      if (injectFirebaseServerAppTokenProvider) {
        providers.push(firebaseServerAppTokenProvider(asGetter(f.instance.app)));
      }

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

export function firebaseAdminNestContextFactory<
  I extends FirebaseAdminNestTestContextInstance<FirebaseAdminTestContextInstance> = FirebaseAdminNestTestContextInstance<FirebaseAdminTestContextInstance>
>(config: FirebaseAdminNestTestConfig<FirebaseAdminTestContextInstance, JestTestContextFixture<FirebaseAdminTestContextInstance>, I>): FirebaseAdminNestTestContextFactory<FirebaseAdminTestContextInstance, JestTestContextFixture<FirebaseAdminTestContextInstance>, I> {
  return firebaseAdminNestContextFixture<FirebaseAdminTestContextInstance, JestTestContextFixture<FirebaseAdminTestContextInstance>, I>(config, firebaseAdminTestContextFactory);
}
