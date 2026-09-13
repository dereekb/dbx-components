import { type FirebaseUserSession, closeFirebaseUserSession, closeFirebaseUserSessionApps, openFirebaseUserSession } from '@dereekb/oauth-resource/firebase';
import { cliFirestoreSessionErrorFactory, cliFirestoreSessionFetcher, type CliFirestoreSession } from '../api/firestore-session.client';
import { type CliEnvConfig, isCliFirebaseConfigComplete } from '../config/env';
import { type CliFirestoreSessionCacheStore } from '../config/firestore-session.cache';
import { CliError } from '../util/output';

/**
 * A live direct-Firestore session: the Firebase client objects the CLI signed in with, plus the
 * `FirestoreContext` an app's collections factory consumes.
 *
 * The CLI's view of {@link FirebaseUserSession}, whose implementation lives in
 * `@dereekb/oauth-resource/firebase` so any resource server that verified a bearer token carrying the
 * `session.firestore` scope gets the same bridge.
 *
 * The `firestoreContext` is built by `clientFirebaseFirestoreContextFactory`, the exact analogue of
 * the server's `googleCloudFirestoreContextFactory` — both satisfy `FirestoreContextFactory` — so an
 * app's `make<App>FirestoreCollections(context)` accepts it unchanged, and the CLI runs the SAME
 * queries the Angular app runs, through the SAME security rules.
 */
export interface CliFirestoreSessionContext extends FirebaseUserSession {
  /**
   * The credential bundle the API minted for this session.
   *
   * The CLI's long-standing name for {@link FirebaseUserSession.credentials}; both name the same
   * object.
   */
  readonly session: CliFirestoreSession;
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
  /**
   * Optional on-disk session cache. When supplied, a live cached envelope for {@link envName} is
   * reused instead of re-minting one, and a freshly minted envelope is written back.
   */
  readonly sessionCache?: CliFirestoreSessionCacheStore;
  /**
   * Skips the cache read for this call and re-mints, still writing the result back. Used by
   * `doctor` and by a retry after a sign-in failure.
   */
  readonly refreshSession?: boolean;
}

/**
 * Opens a direct Firestore connection as the authenticated CLI user.
 *
 * A thin wrapper over `openFirebaseUserSession`: it validates the env's Firebase client config with
 * the CLI's own env-var-naming remediation, then delegates. The strict step ORDER (mint → fresh app →
 * App Check FIRST → emulator wiring → sign-in) and its reasoning live with the implementation.
 *
 * The session's Firebase app is named `<cliName>::<envName>::<uid>`, so
 * {@link closeAllCliFirebaseApps} finds every app this CLI opened from the name alone.
 *
 * There is deliberately NO fallback to the HTTP model API — a failure here throws so the operator
 * sees it. `createFirestoreSessionDoctorCheck` is the diagnostic surface for why.
 *
 * @param input - The CLI name, env, access token, and optional session cache.
 * @returns The live {@link CliFirestoreSessionContext}.
 * @throws {CliError} When the env lacks Firebase client config, or any step of the handshake fails.
 */
export async function createCliFirestoreSessionContext(input: CreateCliFirestoreSessionContextInput): Promise<CliFirestoreSessionContext> {
  const { cliName, envName, env, accessToken, fetcher, sessionCache, refreshSession = false } = input;
  const firebase = env.firebase;

  if (!isCliFirebaseConfigComplete(firebase)) {
    throw new CliError({
      message: `Env "${envName}" has no complete Firebase client config, so a direct Firestore session cannot be opened.`,
      code: 'INVALID_ARGUMENT',
      suggestion: `Set \`firebase.apiKey\`, \`firebase.projectId\`, and \`firebase.appId\` on the env (or via ${cliName.replaceAll('-', '_').toUpperCase()}_FIREBASE_* environment variables). Copy them from the app's Firebase web app config.`
    });
  }

  const session = await openFirebaseUserSession({
    namespace: cliName,
    scope: envName,
    firebase,
    apiBaseUrl: env.apiBaseUrl,
    accessToken,
    fetcher: cliFirestoreSessionFetcher(fetcher),
    errorFactory: cliFirestoreSessionErrorFactory,
    // the CLI's cache is keyed by ENV name, not uid: one CLI process serves one user, and the env is
    // what its on-disk `~/.<cli>/.firestore-sessions.json` has always been keyed by
    credentialsCache: sessionCache,
    cacheKey: envName,
    refreshCredentials: refreshSession
  });

  return { ...session, session: session.credentials };
}

/**
 * Tears down a session opened by {@link createCliFirestoreSessionContext}.
 *
 * Required for the CLI to EXIT. A signed-in `Auth` and a live `Firestore` both hold open handles
 * that keep the Node event loop alive indefinitely, so without this a command prints its result and
 * then hangs forever — the process never returns to the shell.
 *
 * @param session - The session context to close.
 */
export async function closeCliFirestoreSessionContext(session: CliFirestoreSessionContext): Promise<void> {
  await closeFirebaseUserSession(session);
}

/**
 * Deletes every still-live Firebase app this CLI opened, whether or not a session was handed back.
 *
 * The CLI's last line of defence against a hang. {@link closeCliFirestoreSessionContext} covers the
 * normal path, but it needs a session to be handed to it, and three cases never produce one:
 *
 * - a handshake that fails AFTER `initializeApp` — a failed App Check registration, a broken emulator
 *   connection — throws, so the caller that catches it has an initialized app and no session;
 * - a caller that opens its own session outside the context memo (the doctor probe) owns its own
 *   teardown, and forgetting it hangs the process;
 * - a {@link CliContext} orphaned mid-invocation carries the only reference to its session memo.
 *
 * @param input - The function inputs.
 * @param input.cliName - The CLI whose apps should be closed. Apps belonging to other Firebase
 *   consumers in the same process are left alone.
 * @returns Resolves once every matching app has been deleted.
 */
export async function closeAllCliFirebaseApps(input: Pick<CreateCliFirestoreSessionContextInput, 'cliName'>): Promise<void> {
  await closeFirebaseUserSessionApps({ namespace: input.cliName });
}
