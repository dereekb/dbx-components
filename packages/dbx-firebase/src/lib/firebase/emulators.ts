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
  readonly useEmulators?: boolean | undefined;
  /**
   * Default host to target. Defaults to localhost if not provided.
   */
  readonly host?: string | undefined;
  /**
   * emulator UI configuration
   */
  readonly ui?: DbxFirebaseEmulatorConfig | undefined;
  /**
   * Auth emulator configuration
   */
  readonly auth?: DbxFirebaseEmulatorConfig | undefined;
  /**
   * Firestore emulator configuration
   */
  readonly firestore?: DbxFirebaseEmulatorConfig | undefined;
  /**
   * Firestore emulator configuration
   */
  readonly storage?: DbxFirebaseEmulatorConfig | undefined;
  /**
   * Functions emulator configuration
   */
  readonly functions?: DbxFirebaseEmulatorConfig | undefined;
  /**
   * Database emulator configuration
   */
  readonly database?: DbxFirebaseEmulatorConfig | undefined;
}

export abstract class DbxFirebaseParsedEmulatorsConfig implements DbxFirebaseEmulatorsConfig {
  abstract readonly useEmulators: boolean;
  readonly host?: string | undefined;
  /**
   * Fix used by some components to allow changing 0.0.0.0 to localhost. Defaults to true.
   */
  readonly allow0000ToLocalhost?: boolean | undefined;
  readonly ui?: Required<DbxFirebaseEmulatorConfig> | undefined;
  readonly auth?: Required<DbxFirebaseEmulatorConfig> | undefined;
  readonly firestore?: Required<DbxFirebaseEmulatorConfig> | undefined;
  readonly storage?: Required<DbxFirebaseEmulatorConfig> | undefined;
  readonly functions?: Required<DbxFirebaseEmulatorConfig> | undefined;
  readonly database?: Required<DbxFirebaseEmulatorConfig> | undefined;
}
