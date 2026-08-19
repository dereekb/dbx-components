import { type FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { CustomProvider, initializeAppCheck } from 'firebase/app-check';
import { type Auth, connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth';
import { type Firestore, connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { type FirestoreContext, clientFirebaseFirestoreContextFactory } from '@dereekb/firebase';
import { type CliFirestoreSession, fetchFirestoreSession } from '../api/firestore-session.client';
import { type CliEnvConfig, DEFAULT_CLI_FIREBASE_EMULATOR_HOST, cliFirebaseEmulatorsInUse, isCliFirebaseConfigComplete } from '../config/env';
import { CliError } from '../util/output';

/**
 * A live direct-Firestore session: the Firebase client objects the CLI signed in with, plus the
 * `FirestoreContext` an app's collections factory consumes.
 *
 * The `firestoreContext` is built by `clientFirebaseFirestoreContextFactory`, the exact analogue of
 * the server's `googleCloudFirestoreContextFactory` — both satisfy `FirestoreContextFactory` — so an
 * app's `make<App>FirestoreCollections(context)` accepts it unchanged, and the CLI runs the SAME
 * queries the Angular app runs, through the SAME security rules.
 */
export interface CliFirestoreSessionContext {
  /**
   * The credential bundle the API minted for this session.
   */
  readonly session: CliFirestoreSession;
  readonly app: FirebaseApp;
  readonly auth: Auth;
  readonly firestore: Firestore;
  readonly firestoreContext: FirestoreContext;
}

export interface CreateCliFirestoreSessionContextInput {
  readonly cliName: string;
  readonly envName: string;
  readonly env: CliEnvConfig;
  readonly accessToken: string;
  /**
   * Custom fetch implementation for tests.
   */
  readonly fetcher?: typeof fetch;
}

/**
 * Opens a direct Firestore connection as the authenticated CLI user.
 *
 * Steps, in a strict order:
 *
 * 1. `GET <apiBaseUrl>/session/firestore` for a custom token + App Check attestation.
 * 2. `initializeApp` with the env's Firebase client config.
 * 3. `initializeAppCheck` with a `CustomProvider` handing back the server-minted token. **This must
 *    happen before any other Firebase call** — `dbx-firebase`'s provider documents the same
 *    constraint: "App Check must be initialized before any Firebase request goes out, otherwise
 *    requests are sent without an App Check token and are rejected in production." Skipped when the
 *    env targets emulators (which do not verify attestations) or when the API minted no token.
 * 4. `getAuth` / `getFirestore`, connecting each to its emulator when configured.
 * 5. `signInWithCustomToken`. The user's stored custom claims land at the top level of the exchanged
 *    ID token, so `request.auth.token.<claim>` reads in security rules behave exactly as in the app.
 *
 * There is deliberately NO fallback to the HTTP model API — a failure here throws so the operator
 * sees it. `createFirestoreSessionDoctorCheck` is the diagnostic surface for why.
 *
 * @param input - The CLI name, env, and access token to authenticate the session request with.
 * @returns The live {@link CliFirestoreSessionContext}.
 * @throws {CliError} When the env lacks Firebase client config, or any step of the handshake fails.
 */
export async function createCliFirestoreSessionContext(input: CreateCliFirestoreSessionContextInput): Promise<CliFirestoreSessionContext> {
  const { cliName, envName, env, accessToken, fetcher } = input;
  const firebase = env.firebase;

  if (!isCliFirebaseConfigComplete(firebase)) {
    throw new CliError({
      message: `Env "${envName}" has no complete Firebase client config, so a direct Firestore session cannot be opened.`,
      code: 'INVALID_ARGUMENT',
      suggestion: `Set \`firebase.apiKey\`, \`firebase.projectId\`, and \`firebase.appId\` on the env (or via ${cliName.replaceAll('-', '_').toUpperCase()}_FIREBASE_* environment variables). Copy them from the app's Firebase web app config.`
    });
  }

  const session = await fetchFirestoreSession({ apiBaseUrl: env.apiBaseUrl, accessToken, fetcher });

  const appName = `${cliName}-${envName}`;
  const app = getApps().find((x) => x.name === appName) ?? initializeApp({ apiKey: firebase.apiKey, authDomain: firebase.authDomain, projectId: firebase.projectId, appId: firebase.appId }, appName);

  const useEmulators = cliFirebaseEmulatorsInUse(firebase);

  // App Check must be registered on the app before any Firebase request goes out. Mirrors
  // `createDbxFirebaseAppCheck`, which likewise disables App Check whenever emulators are in use.
  if (session.appCheckToken && !useEmulators) {
    const appCheckToken = session.appCheckToken;
    const expireTimeMillis = expireTimeMillisFromSession(session);

    initializeAppCheck(app, {
      provider: new CustomProvider({
        getToken: async () => ({ token: appCheckToken, expireTimeMillis })
      }),
      // the token is minted per-session by the API; there is no local attestation to refresh against
      isTokenAutoRefreshEnabled: false
    });
  }

  const emulatorHost = firebase.emulators?.host || DEFAULT_CLI_FIREBASE_EMULATOR_HOST;
  const auth = getAuth(app);

  if (useEmulators && firebase.emulators?.authPort != null) {
    connectAuthEmulator(auth, `http://${emulatorHost}:${firebase.emulators.authPort}`, { disableWarnings: true });
  }

  const firestore = getFirestore(app);

  if (useEmulators && firebase.emulators?.firestorePort != null) {
    connectFirestoreEmulator(firestore, emulatorHost, firebase.emulators.firestorePort);
  }

  try {
    await signInWithCustomToken(auth, session.customToken);
  } catch (e) {
    throw new CliError({
      message: `Failed to sign in with the minted custom token: ${e instanceof Error ? e.message : String(e)}`,
      code: 'AUTH_UNAUTHORIZED',
      suggestion: 'Verify the env `firebase.projectId`/`firebase.apiKey` match the project the API mints tokens for.'
    });
  }

  return {
    session,
    app,
    auth,
    firestore,
    firestoreContext: clientFirebaseFirestoreContextFactory(firestore)
  };
}

/**
 * Resolves the App Check token's expiry from the session envelope, falling back to a short window
 * when the API returned an unparsable `expiresAt`.
 *
 * @param session - The session envelope returned by the API.
 * @returns The epoch-millis expiry to advertise to the App Check `CustomProvider`.
 */
function expireTimeMillisFromSession(session: CliFirestoreSession): number {
  const parsed = Date.parse(session.expiresAt);
  return Number.isFinite(parsed) ? parsed : Date.now() + 30 * 60 * 1000;
}
