export interface DbxFirebaseEmulatorConfig {
  /**
   * Port to target.
   */
  readonly port: number;
  /**
   * Defaults to localhost if not provided.
   */
  readonly host?: string;
}

export interface DbxFirebaseEmulatorsConfig {
  /**
   * Whether or not to enable the emulators.
   *
   * Defaults to false.
   */
  readonly useEmulators?: boolean;
  /**
   * Default host to target. Defaults to localhost if not provided.
   */
  readonly host?: string;
  /**
   * emulator UI configuration
   */
  readonly ui?: DbxFirebaseEmulatorConfig;
  /**
   * Auth emulator configuration
   */
  readonly auth?: DbxFirebaseEmulatorConfig;
  /**
   * Firestore emulator configuration
   */
  readonly firestore?: DbxFirebaseEmulatorConfig;
  /**
   * Firestore emulator configuration
   */
  readonly storage?: DbxFirebaseEmulatorConfig;
  /**
   * Functions emulator configuration
   */
  readonly functions?: DbxFirebaseEmulatorConfig;
  /**
   * Database emulator configuration
   */
  readonly database?: DbxFirebaseEmulatorConfig;
}

export abstract class DbxFirebaseParsedEmulatorsConfig implements DbxFirebaseEmulatorsConfig {
  abstract readonly useEmulators: boolean;
  readonly host?: string;
  /**
   * Fix used by some components to allow changing 0.0.0.0 to localhost. Defaults to true.
   */
  readonly allow0000ToLocalhost?: boolean;
  readonly ui?: Required<DbxFirebaseEmulatorConfig>;
  readonly auth?: Required<DbxFirebaseEmulatorConfig>;
  readonly firestore?: Required<DbxFirebaseEmulatorConfig>;
  readonly storage?: Required<DbxFirebaseEmulatorConfig>;
  readonly functions?: Required<DbxFirebaseEmulatorConfig>;
  readonly database?: Required<DbxFirebaseEmulatorConfig>;
}
