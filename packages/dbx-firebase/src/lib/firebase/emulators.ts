export interface DbxFirebaseEmulatorConfig {
  /**
   * Port to target.
   */
  port: number;
  /**
   * Defaults to localhost if not provided.
   */
  host?: string;
}

export interface DbxFirebaseEmulatorsConfig {
  /**
   * Whether or not to enable the emulators.
   */
  useEmulators?: boolean;
  /**
   * Default host to target. Defaults to localhost if not provided.
   */
  host?: string;
  /**
   * emulator UI configuration
   */
  ui?: DbxFirebaseEmulatorConfig;
  /**
   * Auth emulator configuration
   */
  auth?: DbxFirebaseEmulatorConfig;
  /**
   * Firestore emulator configuration
   */
  firestore?: DbxFirebaseEmulatorConfig;
  /**
   * Firestore emulator configuration
   */
  storage?: DbxFirebaseEmulatorConfig;
  /**
   * Functions emulator configuration
   */
  functions?: DbxFirebaseEmulatorConfig;
  /**
   * Database emulator configuration
   */
  database?: DbxFirebaseEmulatorConfig;
}

export abstract class DbxFirebaseParsedEmulatorsConfig implements DbxFirebaseEmulatorsConfig {
  abstract useEmulators: boolean;
  host?: string;
  ui?: Required<DbxFirebaseEmulatorConfig>;
  auth?: Required<DbxFirebaseEmulatorConfig>;
  firestore?: Required<DbxFirebaseEmulatorConfig>;
  storage?: Required<DbxFirebaseEmulatorConfig>;
  functions?: Required<DbxFirebaseEmulatorConfig>;
  database?: Required<DbxFirebaseEmulatorConfig>;
}
