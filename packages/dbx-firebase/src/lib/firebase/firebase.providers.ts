import { type EnvironmentProviders, type Provider, makeEnvironmentProviders } from '@angular/core';
import { type FirebaseApp, initializeApp } from 'firebase/app';
import { type AppCheck, initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { type Auth, getAuth, connectAuthEmulator } from 'firebase/auth';
import { type Firestore, connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type FirestoreSettings, persistentSingleTabManager } from 'firebase/firestore';
import { type FirebaseStorage, getStorage, connectStorageEmulator } from 'firebase/storage';
import { type Functions, getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { type Maybe } from '@dereekb/util';
import { FIREBASE_APP_TOKEN, FIREBASE_AUTH_TOKEN, FIREBASE_FIRESTORE_TOKEN, FIREBASE_STORAGE_TOKEN, FIREBASE_FUNCTIONS_TOKEN, FIREBASE_APP_CHECK_TOKEN } from './firebase.tokens';
import { type DbxFirebaseEmulatorConfig, type DbxFirebaseEmulatorsConfig, DbxFirebaseParsedEmulatorsConfig } from './emulators';
import { DbxFirebaseEmulatorService } from './firebase.emulator.service';
import { type DbxFirebaseAppOptions, DBX_FIREBASE_APP_OPTIONS_TOKEN } from './firebase.options';
import { enableAppCheckDebugTokenGeneration } from '../auth/appcheck/appcheck';
import { DbxFirebaseAppCheckHttpInterceptor } from '../auth/appcheck/appcheck.interceptor';

/**
 * Configuration for provideDbxFirebaseApp().
 */
export interface ProvideDbxFirebaseAppConfig {
  /**
   * DbxFirebaseAppOptions for the app.
   *
   * Is automatically configured as a provider for the DBX_FIREBASE_APP_OPTIONS_TOKEN.
   */
  readonly dbxFirebaseAppOptions: DbxFirebaseAppOptions;
  /**
   * Whether or not to provide Firestore configuration.
   *
   * True by default.
   */
  readonly provideFirestore?: Maybe<boolean>;
  /**
   * Whether or not to provide App Check configuration.
   *
   * True by default.
   */
  readonly provideAppCheck?: Maybe<boolean>;
  /**
   * Whether or not to provide Auth configuration.
   *
   * True by default.
   */
  readonly provideAuth?: Maybe<boolean>;
  /**
   * Whether or not to provide Storage configuration.
   *
   * True by default.
   */
  readonly provideStorage?: Maybe<boolean>;
  /**
   * Whether or not to provide Functions configuration.
   *
   * True by default.
   */
  readonly provideFunctions?: Maybe<boolean>;
}

/**
 * Provides EnvironmentProviders for all Firebase services.
 *
 * Initializes the FirebaseApp and each requested service synchronously at call time, so:
 * - App Check is registered before any Firebase request can fire (required for prod enforcement).
 * - Firestore is initialized with custom settings (persistentLocalCache, emulator) before
 *   anything can call `getFirestore(app)` for this app.
 *
 * Also provides the parsed emulator config and {@link DbxFirebaseEmulatorService}, which are
 * derived from `dbxFirebaseAppOptions.emulators`.
 *
 * @param config
 * @returns EnvironmentProviders
 *
 * @example
 * ```ts
 * provideDbxFirebaseApp({
 *   dbxFirebaseAppOptions: environment.firebase
 * });
 * ```
 */
export function provideDbxFirebaseApp(config: ProvideDbxFirebaseAppConfig): EnvironmentProviders {
  const { dbxFirebaseAppOptions: options } = config;
  const emulators = parseDbxFirebaseEmulatorsConfig(options.emulators);

  const app = initializeApp(options);

  const providers: Provider[] = [{ provide: DBX_FIREBASE_APP_OPTIONS_TOKEN, useValue: options }, { provide: FIREBASE_APP_TOKEN, useValue: app }, { provide: DbxFirebaseParsedEmulatorsConfig, useValue: emulators }, DbxFirebaseEmulatorService];

  // App Check must be initialized before any Firebase request goes out, otherwise
  // requests are sent without an App Check token and are rejected in production.
  if (config.provideAppCheck !== false) {
    providers.push({ provide: FIREBASE_APP_CHECK_TOKEN, useValue: createDbxFirebaseAppCheck({ app, options }) }, { provide: HTTP_INTERCEPTORS, useClass: DbxFirebaseAppCheckHttpInterceptor, multi: true });
  }

  // initializeFirestore(app, settings) must precede any other access to the Firestore for this app
  // (e.g. getFirestore(app)) or the persistentLocalCache settings are silently dropped.
  if (config.provideFirestore !== false) {
    providers.push({ provide: FIREBASE_FIRESTORE_TOKEN, useValue: createDbxFirebaseFirestore({ app, options, emulators }) });
  }

  if (config.provideAuth !== false) {
    providers.push({ provide: FIREBASE_AUTH_TOKEN, useValue: createDbxFirebaseAuth({ app, emulators }) });
  }

  if (config.provideStorage !== false) {
    providers.push({ provide: FIREBASE_STORAGE_TOKEN, useValue: createDbxFirebaseStorage({ app, emulators }) });
  }

  if (config.provideFunctions !== false) {
    providers.push({ provide: FIREBASE_FUNCTIONS_TOKEN, useValue: createDbxFirebaseFunctions({ app, options, emulators }) });
  }

  return makeEnvironmentProviders(providers);
}

// MARK: Emulators
/**
 * Parses a {@link DbxFirebaseEmulatorsConfig} into a fully-resolved {@link DbxFirebaseParsedEmulatorsConfig}.
 *
 * @param config
 * @returns DbxFirebaseParsedEmulatorsConfig
 *
 * @example
 * ```ts
 * const emulators = parseDbxFirebaseEmulatorsConfig({
 *   useEmulators: true,
 *   firestore: { port: 8080 }
 * });
 * ```
 */
export function parseDbxFirebaseEmulatorsConfig(config: DbxFirebaseEmulatorsConfig): DbxFirebaseParsedEmulatorsConfig {
  const defaultHost = config.host ?? 'localhost';

  function emulatorConfig(emulator: Maybe<DbxFirebaseEmulatorConfig>): Required<DbxFirebaseEmulatorConfig> | undefined {
    return emulator ? { host: emulator.host ?? defaultHost, port: emulator.port } : undefined;
  }

  return {
    useEmulators: config.useEmulators !== false,
    host: config.host,
    ui: emulatorConfig(config.ui),
    auth: emulatorConfig(config.auth),
    firestore: emulatorConfig(config.firestore),
    storage: emulatorConfig(config.storage),
    functions: emulatorConfig(config.functions),
    database: emulatorConfig(config.database)
  };
}

// MARK: AppCheck
/**
 * Params for {@link createDbxFirebaseAppCheck}.
 */
export interface CreateDbxFirebaseAppCheckParams {
  readonly app: FirebaseApp;
  readonly options: DbxFirebaseAppOptions;
}

/**
 * Initializes App Check for the given FirebaseApp using the provided options.
 *
 * Returns `undefined` when App Check is knowingly disabled (config flag or emulators in use)
 * or when no App Check options are configured.
 *
 * @param params
 * @returns AppCheck
 *
 * @example
 * ```ts
 * const appCheck = createDbxFirebaseAppCheck({ app, options });
 * ```
 */
export function createDbxFirebaseAppCheck(params: CreateDbxFirebaseAppCheckParams): AppCheck {
  const { app, options } = params;
  const appCheckOptions = options.appCheck;
  const appCheckKnowinglyDisabled = appCheckOptions?.disabled === true || options.emulators?.useEmulators === true;

  let appCheck: AppCheck = undefined as unknown as AppCheck;

  if (appCheckOptions && !appCheckKnowinglyDisabled) {
    if (!options.emulators?.useEmulators && appCheckOptions.allowDebugTokens) {
      enableAppCheckDebugTokenGeneration(true);
    }

    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckOptions.reCaptchaV3),
      isTokenAutoRefreshEnabled: appCheckOptions.isTokenAutoRefreshEnabled ?? true
    });

    console.log('Enabled AppCheck.');
  } else if (!appCheckKnowinglyDisabled) {
    console.error('dbx-firebase: No appcheck configuration for the app, and not specifically disabled in config either.');
  }

  return appCheck;
}

// MARK: Firestore
/**
 * Params for {@link createDbxFirebaseFirestore}.
 */
export interface CreateDbxFirebaseFirestoreParams {
  readonly app: FirebaseApp;
  readonly options: DbxFirebaseAppOptions;
  readonly emulators: DbxFirebaseParsedEmulatorsConfig;
}

/**
 * Initializes Firestore for the given FirebaseApp with persistence and emulator settings derived from options.
 *
 * @param params
 * @returns Firestore
 *
 * @example
 * ```ts
 * const firestore = createDbxFirebaseFirestore({ app, options, emulators });
 * ```
 */
export function createDbxFirebaseFirestore(params: CreateDbxFirebaseFirestoreParams): Firestore {
  const { app, options, emulators } = params;
  const { enableMultiTabIndexedDbPersistence, enableIndexedDbPersistence, persistentCacheSettings } = options;
  const firestoreSettings: FirestoreSettings = {};

  if (enableIndexedDbPersistence !== false) {
    const tabManager = enableMultiTabIndexedDbPersistence !== false ? persistentMultipleTabManager() : persistentSingleTabManager(undefined);

    firestoreSettings.localCache = persistentLocalCache({
      tabManager,
      ...persistentCacheSettings
    });
  }

  const firestore = initializeFirestore(app, firestoreSettings);

  if (emulators.useEmulators && emulators.firestore) {
    connectFirestoreEmulator(firestore, emulators.firestore.host, emulators.firestore.port, {});
  }

  return firestore;
}

// MARK: Auth
/**
 * Params for {@link createDbxFirebaseAuth}.
 */
export interface CreateDbxFirebaseAuthParams {
  readonly app: FirebaseApp;
  readonly emulators: DbxFirebaseParsedEmulatorsConfig;
}

/**
 * Returns the Firebase Auth instance for the given app, wired up to the auth emulator if configured.
 *
 * @param params
 * @returns Auth
 *
 * @example
 * ```ts
 * const auth = createDbxFirebaseAuth({ app, emulators });
 * ```
 */
export function createDbxFirebaseAuth(params: CreateDbxFirebaseAuthParams): Auth {
  const { app, emulators } = params;
  const auth = getAuth(app);

  if (emulators.useEmulators && emulators.auth) {
    connectAuthEmulator(auth, `http://${emulators.auth.host}:${emulators.auth.port}`);
  }

  return auth;
}

// MARK: Storage
/**
 * Params for {@link createDbxFirebaseStorage}.
 */
export interface CreateDbxFirebaseStorageParams {
  readonly app: FirebaseApp;
  readonly emulators: DbxFirebaseParsedEmulatorsConfig;
}

/**
 * Returns the Firebase Storage instance for the given app, wired up to the storage emulator if configured.
 *
 * @param params
 * @returns FirebaseStorage
 *
 * @example
 * ```ts
 * const storage = createDbxFirebaseStorage({ app, emulators });
 * ```
 */
export function createDbxFirebaseStorage(params: CreateDbxFirebaseStorageParams): FirebaseStorage {
  const { app, emulators } = params;
  const storage = getStorage(app);

  if (emulators.useEmulators && emulators.storage) {
    connectStorageEmulator(storage, emulators.storage.host, emulators.storage.port, {});
  }

  return storage;
}

// MARK: Functions
/**
 * Params for {@link createDbxFirebaseFunctions}.
 */
export interface CreateDbxFirebaseFunctionsParams {
  readonly app: FirebaseApp;
  readonly options: DbxFirebaseAppOptions;
  readonly emulators: DbxFirebaseParsedEmulatorsConfig;
}

/**
 * Returns the Firebase Functions instance for the given app, wired up to the functions emulator if configured.
 *
 * @param params
 * @returns Functions
 *
 * @example
 * ```ts
 * const functions = createDbxFirebaseFunctions({ app, options, emulators });
 * ```
 */
export function createDbxFirebaseFunctions(params: CreateDbxFirebaseFunctionsParams): Functions {
  const { app, options, emulators } = params;
  const functions = getFunctions(app, options.functionsRegionOrCustomDomain);

  if (emulators.useEmulators && emulators.functions) {
    connectFunctionsEmulator(functions, emulators.functions.host, emulators.functions.port);
  }

  return functions;
}
