import { type Maybe, type PortNumber } from '@dereekb/util';

/**
 * Local Firebase emulator targets for a Firebase client config.
 *
 * Mirrors the semantics of `DbxFirebaseEmulatorsConfig` in `@dereekb/dbx-firebase` (whose parse
 * helper is Angular-bound and not reusable here): the presence of this object means "use emulators"
 * unless {@link useEmulators} is explicitly `false`.
 *
 * App Check is auto-disabled whenever emulators are in use — the emulators do not verify
 * attestations, and `initializeAppCheck` against a fake project only gets in the way.
 */
export interface FirebaseClientEmulatorsConfig {
  /**
   * Set `false` to keep the emulator targets configured but inactive. Defaults to `true`.
   */
  readonly useEmulators?: boolean;
  /**
   * Host the emulators are reachable at. Defaults to {@link DEFAULT_FIREBASE_CLIENT_EMULATOR_HOST}.
   */
  readonly host?: string;
  /**
   * Port of the Auth emulator. When unset, Auth is not redirected to an emulator.
   */
  readonly authPort?: PortNumber;
  /**
   * Port of the Firestore emulator. When unset, Firestore is not redirected to an emulator.
   */
  readonly firestorePort?: PortNumber;
}

/**
 * Firebase client-SDK configuration used to open a user-scoped Firestore session.
 *
 * These are the same public values the app's browser client initializes with — copy them from the
 * target app's environment file. `appId` in particular must be the registered **web** app, since the
 * server mints its App Check attestation for that app.
 */
export interface FirebaseClientConfig {
  /**
   * The Firebase web API key.
   */
  readonly apiKey?: string;
  /**
   * The project's auth domain (e.g. `my-project.firebaseapp.com`).
   */
  readonly authDomain?: string;
  /**
   * The Firebase project id.
   */
  readonly projectId?: string;
  /**
   * The registered **web** app id (e.g. `1:1234567890:web:abcdef`).
   */
  readonly appId?: string;
  /**
   * Optional emulator targets for local development.
   */
  readonly emulators?: FirebaseClientEmulatorsConfig;
}

/**
 * A {@link FirebaseClientConfig} carrying everything a session needs to initialize an app.
 */
export type CompleteFirebaseClientConfig = Required<Pick<FirebaseClientConfig, 'apiKey' | 'projectId' | 'appId'>> & FirebaseClientConfig;

/**
 * Default host used for Firebase emulator connections when a {@link FirebaseClientEmulatorsConfig}
 * omits one.
 */
export const DEFAULT_FIREBASE_CLIENT_EMULATOR_HOST = 'localhost';

/**
 * Returns true when the config carries the minimum Firebase client values needed to open a
 * user-scoped Firestore session.
 *
 * Deliberately a standalone predicate rather than a field of a wider "config is complete" check: a
 * host's Firebase config is optional, and folding it into a general completeness check would break
 * every consumer that only talks to the HTTP API.
 *
 * @param firebase - The Firebase client config, if any.
 * @returns `true` when `apiKey`, `projectId`, and `appId` are all present and non-empty.
 */
export function isFirebaseClientConfigComplete(firebase: Maybe<FirebaseClientConfig>): firebase is CompleteFirebaseClientConfig {
  return Boolean(firebase?.apiKey && firebase?.projectId && firebase?.appId);
}

/**
 * Returns true when the config's emulator targets are present and active.
 *
 * @param firebase - The Firebase client config, if any.
 * @returns `true` when emulators are configured and not explicitly disabled.
 */
export function firebaseClientEmulatorsInUse(firebase: Maybe<FirebaseClientConfig>): boolean {
  const emulators = firebase?.emulators;
  return Boolean(emulators && emulators.useEmulators !== false && (emulators.authPort != null || emulators.firestorePort != null));
}
