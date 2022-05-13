let adminEnvironmentInitialized = false;

/**
 * Host url:port combo.
 * 
 * I.E. localhost:8080
 */
export type FirebaseAdminTestEnvironmentHost = string;

export interface FirebaseAdminTestEnvironmentEmulatorsConfig {
  auth: FirebaseAdminTestEnvironmentHost | null;
  storage: FirebaseAdminTestEnvironmentHost | null;
  firestore: FirebaseAdminTestEnvironmentHost | null;
}

export interface FirebaseAdminTestEnvironmentConfig {
  emulators: FirebaseAdminTestEnvironmentEmulatorsConfig;
}

export function isAdminEnvironmentInitialized() {
  return adminEnvironmentInitialized;
}

export function generateNewProjectId() {
  const projectId = 'firebase-test-' + new Date().getTime();
  return projectId;
}

export function rollNewGCloudProjectEnvironmentVariable() {
  const projectId = generateNewProjectId();
  process.env.GCLOUD_TEST_PROJECT = projectId;
  process.env.GCLOUD_PROJECT = projectId;
  applyFirebaseGCloudTestProjectIdToFirebaseConfigEnv();
  return projectId;
}

export function getGCloudProjectId() {
  return process.env.GCLOUD_PROJECT;
}

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

  let config: any = JSON.parse(process.env.FIREBASE_CONFIG ?? '{}');
  config.projectId = testProjectId;

  process.env.FIREBASE_CONFIG = JSON.stringify(config);
  process.env.GCLOUD_PROJECT = testProjectId;  // re-apply to GCLOUD_PROJECT too

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
