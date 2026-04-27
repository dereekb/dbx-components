let adminEnvironmentInitialized = false;

/**
 * A `host:port` string used to connect to a Firebase emulator.
 *
 * @example
 * ```ts
 * const host: FirebaseAdminTestEnvironmentHost = 'localhost:8080';
 * ```
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-firebase-server:test
 */
export type FirebaseAdminTestEnvironmentHost = string;

/**
 * Configuration for Firebase emulator host addresses.
 *
 * Each emulator can be set to a {@link FirebaseAdminTestEnvironmentHost} string to enable it,
 * or `null` to skip that emulator. If the firestore emulator is non-null and another emulator
 * is left undefined (not null), {@link initFirebaseAdminTestEnvironment} will throw to prevent
 * accidental connections to production services.
 */
export interface FirebaseAdminTestEnvironmentEmulatorsConfig {
  auth: FirebaseAdminTestEnvironmentHost | null;
  storage: FirebaseAdminTestEnvironmentHost | null;
  firestore: FirebaseAdminTestEnvironmentHost | null;
}

/**
 * Top-level configuration for initializing the Firebase Admin test environment.
 *
 * Passed to {@link initFirebaseAdminTestEnvironment} to configure which emulators the test suite connects to.
 */
export interface FirebaseAdminTestEnvironmentConfig {
  emulators: FirebaseAdminTestEnvironmentEmulatorsConfig;
}

/**
 * Returns whether {@link initFirebaseAdminTestEnvironment} has already been called.
 *
 * Useful for guarding against double-initialization or verifying that setup has completed
 * before creating test contexts.
 */
export function isAdminEnvironmentInitialized() {
  return adminEnvironmentInitialized;
}

/**
 * Generates a unique GCloud project ID based on the current timestamp.
 *
 * The generated ID has the format `firebase-test-<epoch-millis>`, ensuring each test run
 * operates against an isolated project namespace in the emulators.
 *
 * @example
 * ```ts
 * const projectId = generateNewProjectId();
 * // => 'firebase-test-1710000000000'
 * ```
 */
export function generateNewProjectId() {
  const projectId = 'firebase-test-' + new Date().getTime();
  return projectId;
}

/**
 * Generates a new project ID and writes it to the `GCLOUD_PROJECT` and `GCLOUD_TEST_PROJECT`
 * environment variables. Also updates `FIREBASE_CONFIG` via {@link applyFirebaseGCloudTestProjectIdToFirebaseConfigEnv}.
 *
 * This ensures all Firebase Admin SDK calls within the current process use an isolated project,
 * preventing cross-test data contamination when running against emulators.
 *
 * @returns The newly generated project ID.
 */
export function rollNewGCloudProjectEnvironmentVariable() {
  const projectId = generateNewProjectId();
  process.env.GCLOUD_TEST_PROJECT = projectId;
  process.env.GCLOUD_PROJECT = projectId;
  applyFirebaseGCloudTestProjectIdToFirebaseConfigEnv();
  return projectId;
}

/**
 * Reads the current `GCLOUD_PROJECT` environment variable.
 *
 * This is the "active" project ID that the Firebase Admin SDK resolves at runtime.
 */
export function getGCloudProjectId() {
  return process.env.GCLOUD_PROJECT;
}

/**
 * Reads the current `GCLOUD_TEST_PROJECT` environment variable.
 *
 * This holds the canonical test project ID set during {@link rollNewGCloudProjectEnvironmentVariable},
 * and is used by {@link applyFirebaseGCloudTestProjectIdToFirebaseConfigEnv} as the source of truth
 * when re-applying the project ID after external libraries overwrite `FIREBASE_CONFIG`.
 */
export function getGCloudTestProjectId() {
  return process.env.GCLOUD_TEST_PROJECT;
}

/**
 * Applies the current GCLOUD_PROJECT to FIREBASE_CONFIG.
 *
 * This is done as some external testing libraries (firebase-functions-test) will overwrite but we want to enforce using our project id
 * so that each component can also
 */
export function applyFirebaseGCloudTestProjectIdToFirebaseConfigEnv() {
  // firebase-functions-test overwrites this each time.
  // https://github.com/firebase/firebase-functions-test/blob/acb068f4c086f3355b2960b9e9e5895716c7f8cc/src/lifecycle.ts#L37
  const testProjectId = getGCloudTestProjectId();

  // console.log('Test project: ', testProjectId);

  if (!testProjectId) {
    throw new Error('No test project id was available in the environment. Did you call initFirebaseAdminTestEnvironment() first?');
  }

  const config: any = JSON.parse(process.env.FIREBASE_CONFIG ?? '{}');
  config.projectId = testProjectId;

  process.env.FIREBASE_CONFIG = JSON.stringify(config);
  process.env.GCLOUD_PROJECT = testProjectId; // re-apply to GCLOUD_PROJECT too

  return testProjectId;
}

/**
 * Should be called before calling/using adminFirebaseTestBuilder(). This should only be called once.
 */
export function initFirebaseAdminTestEnvironment(config: FirebaseAdminTestEnvironmentConfig) {
  function crashForEmulator(emulator: string) {
    throw new Error(`Emulator for ${emulator} was not set null or to a host. Crashing to prevent contamination.`);
  }

  function configureEmulator(emulator: keyof FirebaseAdminTestEnvironmentEmulatorsConfig, envKey: string) {
    const emulatorConfig = config.emulators[emulator];

    if (emulatorConfig) {
      process.env[envKey] = emulatorConfig;
    } else if (config.emulators.firestore !== null) {
      crashForEmulator(emulator);
    }
  }

  rollNewGCloudProjectEnvironmentVariable();
  configureEmulator('auth', 'FIREBASE_AUTH_EMULATOR_HOST');
  configureEmulator('firestore', 'FIRESTORE_EMULATOR_HOST');
  configureEmulator('storage', 'FIREBASE_STORAGE_EMULATOR_HOST');

  applyFirebaseGCloudTestProjectIdToFirebaseConfigEnv();

  adminEnvironmentInitialized = true;
}
