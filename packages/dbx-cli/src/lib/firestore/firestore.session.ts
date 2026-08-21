import { type FirebaseApp, deleteApp, getApps, initializeApp } from 'firebase/app';
import { CustomProvider, initializeAppCheck } from 'firebase/app-check';
import { type Auth, connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth';
import { type Firestore, connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { type FirestoreContext, clientFirebaseFirestoreContextFactory } from '@dereekb/firebase';
import { type CliFirestoreSession, fetchFirestoreSession } from '../api/firestore-session.client';
import { type CliEnvConfig, DEFAULT_CLI_FIREBASE_EMULATOR_HOST, cliFirebaseEmulatorsInUse, isCliFirebaseConfigComplete } from '../config/env';
import { type CliFirestoreSessionCacheStore, isCliFirestoreSessionExpired } from '../config/firestore-session.cache';
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
  /**
   * True when {@link session} came from the on-disk session cache rather than a fresh
   * `GET /session/firestore`. Surfaced for `doctor` and `--verbose`, not for control flow.
   */
  readonly fromCache: boolean;
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
 * The Firebase app name a direct-Firestore session registers for a CLI + env pair.
 *
 * Deriving the name rather than tracking apps in a side registry is what makes ONE app per CLI + env
 * per process a property of the code instead of a convention: {@link createCliFirestoreSessionContext}
 * looks this name up in `getApps()` before initializing, so repeated session opens in one process —
 * a doctor probe alongside a command's own session, an action that re-resolves the accessor — all
 * share a single app, and {@link closeAllCliFirebaseApps} finds it again from the name alone.
 *
 * @param input - The CLI name and env name the session targets.
 * @returns The Firebase app name for that pair.
 * @__NO_SIDE_EFFECTS__
 */
export function cliFirebaseAppName(input: Pick<CreateCliFirestoreSessionContextInput, 'cliName' | 'envName'>): string {
  return `${input.cliName}-${input.envName}`;
}

/**
 * Opens a direct Firestore connection as the authenticated CLI user.
 *
 * Steps, in a strict order:
 *
 * 0. When a `sessionCache` is supplied, reuse the env's cached credential envelope if it is still
 *    live. Sessions are cached for up to an hour (see `CLI_FIRESTORE_SESSION_MAX_CACHE_MS`), which is
 *    the ceiling the Firebase credentials themselves sit under. A hit skips step 1 only — the
 *    Firebase app is per-process, so the sign-in in step 5 always runs.
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

  const cached = sessionCache && !refreshSession ? await sessionCache.get(envName) : undefined;
  const liveCached = isCliFirestoreSessionExpired(cached) ? undefined : cached;
  const fromCache = liveCached != null;
  const session = liveCached?.session ?? (await fetchFirestoreSession({ apiBaseUrl: env.apiBaseUrl, accessToken, fetcher }));

  if (!fromCache && sessionCache) {
    await sessionCache.set(envName, { session, cachedAt: Date.now(), uid: session.uid });
  }

  const appName = cliFirebaseAppName({ cliName, envName });
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
    // A cached custom token that the Auth backend rejects is indistinguishable here from a genuinely
    // broken config, so drop it and re-mint ONCE rather than making the operator clear the cache by
    // hand. Only a cache hit is retried — a fresh token failing is a real configuration failure.
    if (fromCache && sessionCache) {
      await sessionCache.remove(envName);
      return createCliFirestoreSessionContext({ ...input, refreshSession: true });
    }

    throw new CliError({
      message: `Failed to sign in with the minted custom token: ${e instanceof Error ? e.message : String(e)}`,
      code: 'AUTH_UNAUTHORIZED',
      suggestion: 'Verify the env `firebase.projectId`/`firebase.apiKey` match the project the API mints tokens for.'
    });
  }

  return {
    session,
    fromCache,
    app,
    auth,
    firestore,
    firestoreContext: clientFirebaseFirestoreContextFactory(firestore)
  };
}

/**
 * Tears down a session opened by {@link createCliFirestoreSessionContext}.
 *
 * Required for the CLI to EXIT. A signed-in `Auth` and a live `Firestore` both hold open handles
 * that keep the Node event loop alive indefinitely, so without this a command prints its result and
 * then hangs forever — the process never returns to the shell. Nothing in the CLI is long-lived
 * enough to want that: a session is opened for one invocation and is dead weight afterwards.
 *
 * `deleteApp` is the single call that covers it — it disposes every registered component, which for
 * Firestore runs the same shutdown `terminate()` does, and for Auth stops the token-refresh timer.
 *
 * Deliberately tolerant: teardown runs in a `finally` after the command has already produced its
 * output, so a failure here must not change the exit code or mask the real result. A session that
 * was never opened is a no-op.
 *
 * @param session - The session context to close.
 */
export async function closeCliFirestoreSessionContext(session: CliFirestoreSessionContext): Promise<void> {
  await closeCliFirebaseApp(session.app);
}

/**
 * Deletes one Firebase app, swallowing any failure.
 *
 * @param app - The app to delete.
 */
async function closeCliFirebaseApp(app: FirebaseApp): Promise<void> {
  try {
    await deleteApp(app);
  } catch {
    // an already-deleted app (or one whose components failed to dispose) leaves nothing to salvage,
    // and the command's result has already been emitted
  }
}

/**
 * Deletes every still-live Firebase app this CLI opened, whether or not a session was handed back.
 *
 * The CLI's last line of defence against a hang. `closeCliFirestoreSessionContext` covers the normal
 * path, but it needs a session to be handed to it, and three cases never produce one:
 *
 * - a handshake that fails AFTER `initializeApp` — a rejected custom token, a failed App Check
 *   registration — throws, so the caller that catches it has an initialized app and no session;
 * - a caller that opens its own session outside the context memo (the doctor probe) owns its own
 *   teardown, and forgetting it hangs the process;
 * - a {@link CliContext} orphaned mid-invocation carries the only reference to its session memo.
 *
 * Each leaves an app whose `Firestore` and signed-in `Auth` hold the Node event loop open forever.
 * `getApps()` already tracks every live app and `deleteApp` removes it from that list, so the app
 * names {@link cliFirebaseAppName} derives are enough to find them again — no side registry to keep
 * in sync, and idempotent by construction.
 *
 * Tolerant of failures for the same reason {@link closeCliFirestoreSessionContext} is: it runs after
 * the result is already on stdout.
 *
 * @param input - The function inputs.
 * @param input.cliName - The CLI whose apps should be closed. Apps belonging to other Firebase
 *   consumers in the same process are left alone.
 * @returns Resolves once every matching app has been deleted.
 */
export async function closeAllCliFirebaseApps(input: Pick<CreateCliFirestoreSessionContextInput, 'cliName'>): Promise<void> {
  // every env this process opened a session for, which is normally exactly one
  const prefix = `${input.cliName}-`;
  const apps = getApps().filter((x) => x.name.startsWith(prefix));

  await Promise.all(apps.map((app) => closeCliFirebaseApp(app)));
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
