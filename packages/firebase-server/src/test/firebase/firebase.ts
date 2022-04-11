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
  process.env.GCLOUD_PROJECT = projectId;
  return projectId;
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

  process.env.FIREBASE_CONFIG = JSON.stringify({
    projectId: process.env.GCLOUD_PROJECT
  });

  adminEnvironmentInitialized = true;
}
