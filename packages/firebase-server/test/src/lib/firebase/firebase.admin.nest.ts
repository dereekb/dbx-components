import { AbstractChildTestContextFixture, type BuildTestsWithContextFunction, type TestContextFactory, type TestContextFixture, useTestContextFixture } from '@dereekb/util/test';
import { AbstractFirebaseAdminTestContextInstanceChild, firebaseAdminTestContextFactory, type FirebaseAdminTestContextInstance } from './firebase.admin';
import { INestApplication, type Abstract, type INestApplicationContext, type Provider, type Type } from '@nestjs/common';
import { type StorageBucketId } from '@dereekb/firebase';
import { type FirebaseServerEnvironmentConfig, GlobalRoutePrefixConfig, type NestAppPromiseGetter, type NestServerInstanceConfig, buildNestServerRootModule } from '@dereekb/firebase-server';
import { Test, type TestingModule } from '@nestjs/testing';
import { type ArrayOrValue, asGetter, cachedGetter, type ClassType, type Getter, Maybe } from '@dereekb/util';

export const FIREBASE_ADMIN_NEST_TEST_SERVER_INSTANCE_CONFIG_TOKEN = 'FIREBASE_ADMIN_NEST_TEST_SERVER_INSTANCE_CONFIG_TOKEN';

// MARK: FirebaseAdminNestTestBuilder
export interface FirebaseAdminNestTestContext {
  readonly nest: TestingModule;
  readonly nestAppPromiseGetter: NestAppPromiseGetter;
  /**
   * Returns the configured nest application singleton for this context.
   *
   * If it does not exist, calls `createNewNestApplication` and returns the result.
   */
  loadInitializedNestApplication(): Promise<INestApplication>;
  /**
   * Creates a new blank nest application.
   */
  createNewNestApplication(): INestApplication;
  get<TInput = any, TResult = TInput>(typeOrToken: Type<TInput> | Abstract<TInput> | string | symbol, options?: { strict: boolean }): TResult;
}

export type FirebaseAdminNestTestContextFixtureType<PI extends FirebaseAdminTestContextInstance> = FirebaseAdminNestTestContext & TestContextFixture<PI>;

export class FirebaseAdminNestTestContextFixture<PI extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance, PF extends TestContextFixture<PI> = TestContextFixture<PI>, I extends FirebaseAdminNestTestContextInstance<PI> = FirebaseAdminNestTestContextInstance<PI>> extends AbstractChildTestContextFixture<I, PF> implements FirebaseAdminNestTestContext {
  // MARK: Forwarded
  get nest() {
    return this.instance.nest;
  }

  get nestAppPromiseGetter() {
    return this.instance.nestAppPromiseGetter;
  }

  createNewNestApplication(): INestApplication {
    return this.instance.createNewNestApplication();
  }

  loadInitializedNestApplication(): Promise<INestApplication> {
    return this.instance.loadInitializedNestApplication();
  }

  get<TInput = any, TResult = TInput>(
    typeOrToken: Type<TInput> | Abstract<TInput> | string | symbol,
    options?: {
      strict: boolean;
    }
  ): TResult {
    return this.instance.get(typeOrToken, options);
  }
}

export class FirebaseAdminNestTestContextInstance<PI extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends AbstractFirebaseAdminTestContextInstanceChild<PI> implements FirebaseAdminNestTestContext {
  readonly nestAppPromiseGetter: Getter<Promise<INestApplicationContext>> = () => Promise.resolve(this.nest);

  readonly _loadInitializedNestApplication = cachedGetter(async () => {
    let app = this.createNewNestApplication();
    await app.init();
    return app;
  });

  constructor(
    parent: PI,
    readonly nest: TestingModule
  ) {
    super(parent);
  }

  createNewNestApplication(): INestApplication {
    let app = this.nest.createNestApplication();

    const globalRoutePrefixConfig = this.get(GlobalRoutePrefixConfig);
    const serverInstanceConfig = this.get(FIREBASE_ADMIN_NEST_TEST_SERVER_INSTANCE_CONFIG_TOKEN);

    if (globalRoutePrefixConfig?.globalApiRoutePrefix != null) {
      app.setGlobalPrefix(globalRoutePrefixConfig.globalApiRoutePrefix, globalRoutePrefixConfig);
    }

    if (serverInstanceConfig?.configureNestServerInstance) {
      app = serverInstanceConfig.configureNestServerInstance(app) || app;
    }

    return app;
  }

  loadInitializedNestApplication(): Promise<INestApplication> {
    return this._loadInitializedNestApplication();
  }

  get<TInput = any, TResult = TInput>(
    typeOrToken: Type<TInput> | Abstract<TInput> | string | symbol,
    options?: {
      strict?: boolean | undefined;
      each?: undefined | false;
    }
  ): TResult {
    return options ? this.nest.get(typeOrToken, options) : this.nest.get(typeOrToken);
  }
}

export interface FirebaseAdminNestTestConfig<PI extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance, PF extends TestContextFixture<PI> = TestContextFixture<PI>, I extends FirebaseAdminNestTestContextInstance<PI> = FirebaseAdminNestTestContextInstance<PI>, C extends FirebaseAdminNestTestContextFixture<PI, PF, I> = FirebaseAdminNestTestContextFixture<PI, PF, I>> {
  /**
   * Creates a new fixture.
   */
  readonly makeFixture?: (f: PF) => C;
  /**
   * Root module to import.
   */
  readonly nestModules: ArrayOrValue<ClassType>;
  /**
   * Optional `NestServerInstanceConfig` from the production app setup.
   *
   * When provided, shared configuration (global prefix, webhooks, AppCheck, storage, etc.)
   * is derived from this config via `buildNestServerRootModule`, ensuring tests match production.
   *
   * Fields like `moduleClass` and `applicationOptions` are ignored — the test uses `nestModules` instead.
   * Test-specific overrides (e.g., `injectFirebaseServerAppTokenProvider`, `envConfig`) still take precedence.
   */
  readonly serverInstanceConfig?: Maybe<NestServerInstanceConfig<any>>;
  /**
   * Whether or not to inject the env service provider (and serverEnvTokenProvider()) by default.
   *
   * If false will affect the default envConfig value.
   */
  readonly injectServerEnvServiceProvider?: boolean;
  /**
   * (Optional) FirebaseServerEnvironmentConfig. Overrides the default which sets production=false.
   *
   * If injectFirebaseServerEnvServiceProvider is false then this requires a value to be provided in order to be injected.
   */
  readonly envConfig?: FirebaseServerEnvironmentConfig;
  /**
   * Whether or not to inject the firebase server provider (firebaseServerAppTokenProvider()).
   *
   * This makes FIREBASE_APP_TOKEN available globally and provides the app configured for this test.
   */
  readonly injectFirebaseServerAppTokenProvider?: boolean;
  /**
   * Default storage bucket to use for tests.
   */
  readonly defaultStorageBucket?: StorageBucketId;
  /**
   * Whether or not to force using the storage bucket.
   */
  readonly forceStorageBucket?: boolean;
  /**
   * Optional providers to pass to the TestingModule initialization.
   */
  readonly makeProviders?: (instance: PI) => Provider<any>[];
  /**
   * Creates a new instance.
   */
  readonly makeInstance?: (instance: PI, nest: TestingModule) => I;
  /**
   * Optional function to initialize the instance.
   */
  readonly initInstance?: (instance: I) => Promise<void>;
}

export type FirebaseAdminNestTestContextFactory<PI extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance, PF extends TestContextFixture<PI> = TestContextFixture<PI>, I extends FirebaseAdminNestTestContextInstance<PI> = FirebaseAdminNestTestContextInstance<PI>, C extends FirebaseAdminNestTestContextFixture<PI, PF, I> = FirebaseAdminNestTestContextFixture<PI, PF, I>> = TestContextFactory<C>;

export function firebaseAdminNestContextFixture<PI extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance, PF extends TestContextFixture<PI> = TestContextFixture<PI>, I extends FirebaseAdminNestTestContextInstance<PI> = FirebaseAdminNestTestContextInstance<PI>, C extends FirebaseAdminNestTestContextFixture<PI, PF, I> = FirebaseAdminNestTestContextFixture<PI, PF, I>>(
  config: FirebaseAdminNestTestConfig<PI, PF, I, C>,
  factory: TestContextFactory<PF>
): FirebaseAdminNestTestContextFactory<PI, PF, I, C> {
  return (buildTests: BuildTestsWithContextFunction<C>) => {
    factory((f) => firebaseAdminNestContextWithFixture<PI, PF, I, C>(config, f, buildTests));
  };
}

/** @deprecated Use `FirebaseNestServerRootModule` from `@dereekb/firebase-server` instead. */
export { FirebaseNestServerRootModule as FirebaseAdminNestRootModule } from '@dereekb/firebase-server';

export function firebaseAdminNestContextWithFixture<PI extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance, PF extends TestContextFixture<PI> = TestContextFixture<PI>, I extends FirebaseAdminNestTestContextInstance<PI> = FirebaseAdminNestTestContextInstance<PI>, C extends FirebaseAdminNestTestContextFixture<PI, PF, I> = FirebaseAdminNestTestContextFixture<PI, PF, I>>(config: FirebaseAdminNestTestConfig<PI, PF, I, C>, f: PF, buildTests: BuildTestsWithContextFunction<C>) {
  const { nestModules, serverInstanceConfig, makeProviders = () => [], makeFixture = (parent: PF) => new FirebaseAdminNestTestContextFixture<PI, PF, I>(parent) as C, makeInstance = (instance, nest) => new FirebaseAdminNestTestContextInstance<PI>(instance, nest) as I, initInstance } = config;

  // Resolve env config: test-specific overrides take precedence, otherwise derive from serverInstanceConfig or defaults.
  const shouldInjectEnv = config.injectServerEnvServiceProvider !== false || config.envConfig != null;
  const envConfig: FirebaseServerEnvironmentConfig | undefined = shouldInjectEnv ? config.envConfig || { production: false, appUrl: 'http://localhost:4200' } : undefined;

  useTestContextFixture({
    fixture: makeFixture(f),
    /**
     * Build tests by passing the fixture to the testing functions.
     *
     * This will inject all tests and sub Jest lifecycle items.
     */
    buildTests,
    initInstance: async () => {
      const additionalProviders: Provider[] = makeProviders(f.instance) ?? [];
      const defaultStorageBucket = config.defaultStorageBucket ?? f.instance.app.options.storageBucket;

      const { rootModule } = buildNestServerRootModule({
        modules: nestModules,
        firebaseAppGetter: config.injectFirebaseServerAppTokenProvider ? asGetter(f.instance.app) : undefined,
        additionalProviders,
        envConfig,
        configureEnvService: config.injectServerEnvServiceProvider,
        defaultStorageBucket,
        forceStorageBucket: config.forceStorageBucket,
        // Shared config from production — tests pick up the same global prefix, webhooks, etc.
        globalApiRoutePrefix: serverInstanceConfig?.globalApiRoutePrefix,
        configureWebhooks: serverInstanceConfig?.configureWebhooks,
        appCheckEnabled: false // disabled in tests
      });

      const nest = await Test.createTestingModule({
        providers: [
          {
            provide: FIREBASE_ADMIN_NEST_TEST_SERVER_INSTANCE_CONFIG_TOKEN,
            useValue: serverInstanceConfig
          }
        ],
        imports: [rootModule]
      }).compile();

      try {
        const instance: I = makeInstance(f.instance, nest);

        if (initInstance) {
          await initInstance(instance);
        }

        return instance;
      } catch (e) {
        // Nest was compiled but instance creation/init failed — close the compiled module to prevent resource leaks
        await nest.close().catch(() => {});
        throw e;
      }
    },
    destroyInstance: async (instance) => {
      await instance.nest.close();
    }
  });
}

export function firebaseAdminNestContextFactory<I extends FirebaseAdminNestTestContextInstance<FirebaseAdminTestContextInstance> = FirebaseAdminNestTestContextInstance<FirebaseAdminTestContextInstance>>(config: FirebaseAdminNestTestConfig<FirebaseAdminTestContextInstance, TestContextFixture<FirebaseAdminTestContextInstance>, I>): FirebaseAdminNestTestContextFactory<FirebaseAdminTestContextInstance, TestContextFixture<FirebaseAdminTestContextInstance>, I> {
  return firebaseAdminNestContextFixture<FirebaseAdminTestContextInstance, TestContextFixture<FirebaseAdminTestContextInstance>, I>(config, firebaseAdminTestContextFactory);
}
