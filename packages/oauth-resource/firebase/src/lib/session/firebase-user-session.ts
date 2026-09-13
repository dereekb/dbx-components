import { type FirebaseApp, deleteApp, getApps, initializeApp } from 'firebase/app';
import { CustomProvider, initializeAppCheck } from 'firebase/app-check';
import { type Auth, connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth';
import { type Firestore, connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { type FirebaseAuthUserId, type FirestoreContext, clientFirebaseFirestoreContextFactory } from '@dereekb/firebase';
import { type Getter, type Maybe, type Milliseconds, type UnixDateTimeMillisecondsNumber, type WebsiteUrl } from '@dereekb/util';
import { DEFAULT_FIREBASE_CLIENT_EMULATOR_HOST, type FirebaseClientConfig, firebaseClientEmulatorsInUse, isFirebaseClientConfigComplete } from './firebase-client.config';
import { type FirestoreSessionCredentials, type FirestoreSessionErrorFactory, defaultFirestoreSessionErrorFactory, fetchFirestoreSession } from './firestore-session.client';
import { FIRESTORE_SESSION_MAX_CACHE_MS, type FirestoreSessionCredentialsCache, isFirestoreSessionExpired } from './firestore-session.cache';

// MARK: App Name
/**
 * Separator between the segments of a {@link firebaseUserSessionAppName}.
 *
 * `::` rather than `-` because a Firebase project id is `[a-z0-9-]+`, so a single `-` makes
 * `(ns='srv', scope='a-b', uid='c')` and `(ns='srv', scope='a', uid='b-c')` collide on `srv-a-b-c`.
 * `:` cannot appear in a project id, so `::` is collision-free for any namespace that does not itself
 * contain `::`.
 */
export const FIREBASE_USER_SESSION_KEY_SEPARATOR = '::';

export interface FirebaseUserSessionKeyInput {
  /**
   * The teardown-sweep key — every app this owner registered shares it as a prefix.
   *
   * Required rather than defaulted: a silent default lets two independently-configured pools in one
   * process sweep each other's apps.
   */
  readonly namespace: string;
  /**
   * Discriminates sessions that share a uid but not a target. Normally the Firebase project id.
   */
  readonly scope: string;
  readonly uid: FirebaseAuthUserId;
}

/**
 * The base Firebase app name a user-scoped session registers.
 *
 * A DERIVED name rather than a side registry is what lets {@link closeFirebaseUserSessionApps} find
 * every app this owner opened from `getApps()` alone — no registry to keep in sync, and idempotent by
 * construction.
 *
 * Note this is the BASE name: {@link openFirebaseUserSession} appends `#2`, `#3`, … when the base is
 * already taken, because a session that mints its own credentials must never reuse an existing app
 * registration (see the note on {@link openFirebaseUserSession}).
 *
 * @param input - The namespace, scope, and uid the session targets.
 * @returns The base Firebase app name.
 * @__NO_SIDE_EFFECTS__
 */
export function firebaseUserSessionAppName(input: FirebaseUserSessionKeyInput): string {
  return [input.namespace, input.scope, input.uid].join(FIREBASE_USER_SESSION_KEY_SEPARATOR);
}

/**
 * The `getApps()` name prefix every session opened under a namespace shares.
 *
 * @param namespace - The namespace to sweep.
 * @returns The app-name prefix.
 * @__NO_SIDE_EFFECTS__
 */
export function firebaseUserSessionNamespacePrefix(namespace: string): string {
  return `${namespace}${FIREBASE_USER_SESSION_KEY_SEPARATOR}`;
}

// MARK: Session
/**
 * A live user-scoped Firestore session: the Firebase client objects signed in as the user, plus the
 * `FirestoreContext` an app's collections factory consumes.
 *
 * The `firestoreContext` is built by `clientFirebaseFirestoreContextFactory`, the exact analogue of
 * the server's `googleCloudFirestoreContextFactory` — both satisfy `FirestoreContextFactory` — so an
 * app's `make<App>FirestoreCollections(context)` accepts it unchanged, and the holder runs the SAME
 * queries the Angular app runs, through the SAME security rules.
 *
 * This is deliberately NOT an Admin-SDK "act as user" path: the client SDK is the only Firestore
 * transport that carries a user ID token and is therefore rules-evaluated.
 */
export interface FirebaseUserSession {
  readonly uid: FirebaseAuthUserId;
  /**
   * The credential bundle the API minted for this session.
   */
  readonly credentials: FirestoreSessionCredentials;
  /**
   * True when {@link credentials} came from a supplied cache rather than a fresh mint. Diagnostic
   * only — never control flow.
   */
  readonly fromCache: boolean;
  readonly appName: string;
  readonly app: FirebaseApp;
  readonly auth: Auth;
  readonly firestore: Firestore;
  readonly firestoreContext: FirestoreContext;
  readonly createdAt: UnixDateTimeMillisecondsNumber;
  /**
   * `min(credentials.expiresAt, createdAt + maxSessionAgeMs)`, falling back to the ceiling when the
   * API returned an unparsable timestamp.
   */
  readonly expiresAt: UnixDateTimeMillisecondsNumber;
}

export interface OpenFirebaseUserSessionInput {
  /**
   * The teardown-sweep key. See {@link FirebaseUserSessionKeyInput.namespace}.
   */
  readonly namespace: string;
  /**
   * Discriminates sessions sharing a uid. Defaults to `firebase.projectId`.
   */
  readonly scope?: Maybe<string>;
  readonly firebase: Maybe<FirebaseClientConfig>;
  readonly apiBaseUrl: WebsiteUrl;
  readonly accessToken: string;
  /**
   * When set, asserted against the minted credentials' uid.
   *
   * This makes the mint endpoint's central security property — "the custom token is always minted
   * for `auth.uid`, with no way to name another user" — locally checkable at the CONSUME side, which
   * matters far more for a server holding N users than for a one-user CLI.
   */
  readonly uid?: Maybe<FirebaseAuthUserId>;
  readonly fetcher?: Maybe<typeof fetch>;
  readonly errorFactory?: Maybe<FirestoreSessionErrorFactory>;
  /**
   * Optional credentials cache. When supplied, a live cached envelope for {@link cacheKey} is reused
   * instead of re-minting one, and a freshly minted envelope is written back.
   */
  readonly credentialsCache?: Maybe<FirestoreSessionCredentialsCache>;
  /**
   * Key to read/write in {@link credentialsCache}. Defaults to the session's uid.
   */
  readonly cacheKey?: Maybe<string>;
  /**
   * Skips the cache read for this call and re-mints, still writing the result back. Used by
   * diagnostics and by the retry after a sign-in failure.
   */
  readonly refreshCredentials?: boolean;
  /**
   * Hard ceiling on the session's usable age. Defaults to {@link FIRESTORE_SESSION_MAX_CACHE_MS}.
   */
  readonly maxSessionAgeMs?: Maybe<Milliseconds>;
  /**
   * Clock seam, for deterministic tests.
   */
  readonly now?: Maybe<Getter<UnixDateTimeMillisecondsNumber>>;
}

/**
 * Opens a user-scoped Firestore session. The seam a pool (or a test) substitutes.
 */
export type FirebaseUserSessionOpener = (input: OpenFirebaseUserSessionInput) => Promise<FirebaseUserSession>;

/**
 * Opens a direct Firestore connection as the user the presented access token belongs to.
 *
 * Steps, in a strict order:
 *
 * 0. When a `credentialsCache` is supplied, reuse the cached credential envelope if it is still live.
 *    Sessions are cached for up to an hour (see {@link FIRESTORE_SESSION_MAX_CACHE_MS}), which is the
 *    ceiling the Firebase credentials themselves sit under. A hit skips step 1 only — the Firebase
 *    app is per-session, so the sign-in in step 5 always runs.
 * 1. `GET <apiBaseUrl>/session/firestore` for a custom token + App Check attestation.
 * 2. `initializeApp` under the first FREE name derived from {@link firebaseUserSessionAppName}.
 *
 *    **Never reuse an existing registration.** `initializeAppCheck` on an app whose App Check
 *    provider is already initialized silently returns the EXISTING instance when
 *    `CustomProvider.isEqual` matches — and `isEqual` compares `getToken.toString()`, the source text
 *    of the arrow function, which is byte-identical across two closures built at this call site over
 *    different tokens. Reusing an app therefore keeps the FIRST attestation and drops the freshly
 *    minted one on the floor, so requests go out under a stale (eventually expired) App Check token.
 *    App reuse is the POOL's responsibility, at the session-object level, never at the app-registry
 *    level.
 * 3. `initializeAppCheck` with a `CustomProvider` handing back the server-minted token. **This must
 *    happen before any other Firebase call** — `dbx-firebase`'s provider documents the same
 *    constraint: "App Check must be initialized before any Firebase request goes out, otherwise
 *    requests are sent without an App Check token and are rejected in production." Skipped when the
 *    config targets emulators (which do not verify attestations) or when the API minted no token.
 * 4. `getAuth` / `getFirestore`, connecting each to its emulator when configured.
 * 5. `signInWithCustomToken`. The user's stored custom claims land at the top level of the exchanged
 *    ID token, so `request.auth.token.<claim>` reads in security rules behave exactly as in the app.
 *
 * There is deliberately NO fallback to an Admin-SDK context — the whole point is that rules stay in
 * force, so a failure here throws.
 *
 * @param input - The namespace, Firebase client config, API target, and access token.
 * @returns The live {@link FirebaseUserSession}.
 * @throws {FirestoreSessionError} (or the `errorFactory`'s type) When the config is incomplete, or any step of the handshake fails.
 */
export async function openFirebaseUserSession(input: OpenFirebaseUserSessionInput): Promise<FirebaseUserSession> {
  const { namespace, firebase, apiBaseUrl, accessToken, fetcher, credentialsCache, cacheKey, refreshCredentials = false } = input;
  const maxSessionAgeMs = input.maxSessionAgeMs ?? FIRESTORE_SESSION_MAX_CACHE_MS;
  const errorFactory = input.errorFactory ?? defaultFirestoreSessionErrorFactory;
  const now = input.now ?? (() => Date.now());

  if (!isFirebaseClientConfigComplete(firebase)) {
    throw errorFactory({
      code: 'invalid_config',
      message: 'No complete Firebase client config was supplied, so a user-scoped Firestore session cannot be opened.',
      suggestion: "Set `apiKey`, `projectId`, and `appId` on the Firebase client config. Copy them from the app's Firebase web app config."
    });
  }

  const scope = input.scope || firebase.projectId;
  const readKey = cacheKey ?? input.uid ?? undefined;
  const cached = credentialsCache && !refreshCredentials && readKey != null ? await credentialsCache.get(readKey) : undefined;
  const liveCached = isFirestoreSessionExpired(cached, now()) ? undefined : cached;
  const fromCache = liveCached != null;
  const credentials = liveCached?.session ?? (await fetchFirestoreSession({ apiBaseUrl, accessToken, fetcher, errorFactory }));

  if (input.uid != null && credentials.uid !== input.uid) {
    throw errorFactory({
      code: 'invalid_response',
      message: `The session endpoint minted credentials for uid "${credentials.uid}" but "${input.uid}" was requested.`,
      suggestion: "The mint endpoint always mints for the presented token's own `auth.uid`. A mismatch means the access token does not belong to the requested user."
    });
  }

  const writeKey = cacheKey ?? credentials.uid;

  if (!fromCache && credentialsCache) {
    await credentialsCache.set(writeKey, { session: credentials, cachedAt: now(), uid: credentials.uid });
  }

  const appName = nextFreeFirebaseAppName(firebaseUserSessionAppName({ namespace, scope, uid: credentials.uid }));
  const app = initializeApp({ apiKey: firebase.apiKey, authDomain: firebase.authDomain, projectId: firebase.projectId, appId: firebase.appId }, appName);
  const createdAt = now();

  const useEmulators = firebaseClientEmulatorsInUse(firebase);

  // App Check must be registered on the app before any Firebase request goes out. Mirrors
  // `createDbxFirebaseAppCheck`, which likewise disables App Check whenever emulators are in use.
  if (credentials.appCheckToken && !useEmulators) {
    const appCheckToken = credentials.appCheckToken;
    const expireTimeMillis = expireTimeMillisFromCredentials(credentials, now());

    initializeAppCheck(app, {
      provider: new CustomProvider({
        getToken: async () => ({ token: appCheckToken, expireTimeMillis })
      }),
      // the token is minted per-session by the API; there is no local attestation to refresh against
      isTokenAutoRefreshEnabled: false
    });
  }

  const emulatorHost = firebase.emulators?.host || DEFAULT_FIREBASE_CLIENT_EMULATOR_HOST;
  const auth = getAuth(app);

  if (useEmulators && firebase.emulators?.authPort != null) {
    connectAuthEmulator(auth, `http://${emulatorHost}:${firebase.emulators.authPort}`, { disableWarnings: true });
  }

  const firestore = getFirestore(app);

  if (useEmulators && firebase.emulators?.firestorePort != null) {
    connectFirestoreEmulator(firestore, emulatorHost, firebase.emulators.firestorePort);
  }

  try {
    await signInWithCustomToken(auth, credentials.customToken);
  } catch (e) {
    // The app created on THIS attempt is torn down explicitly rather than left to the namespace
    // sweep: every open registers its OWN app (see step 2), so a caller that retries — or a pool
    // whose config is broken and fails once per request — would otherwise accumulate one dead app,
    // with its refresh timer and network stack, per failed attempt.
    await closeFirebaseUserSessionApp(app);

    // A cached custom token that the Auth backend rejects is indistinguishable here from a genuinely
    // broken config, so drop it and re-mint ONCE rather than making the caller clear the cache by
    // hand. Only a cache hit is retried — a fresh token failing is a real configuration failure.
    if (fromCache && credentialsCache) {
      await credentialsCache.remove(writeKey);
      return openFirebaseUserSession({ ...input, refreshCredentials: true });
    }

    throw errorFactory({
      code: 'unauthorized',
      message: `Failed to sign in with the minted custom token: ${e instanceof Error ? e.message : String(e)}`,
      suggestion: 'Verify `firebase.projectId`/`firebase.apiKey` match the project the API mints tokens for.'
    });
  }

  return {
    uid: credentials.uid,
    credentials,
    fromCache,
    appName,
    app,
    auth,
    firestore,
    firestoreContext: clientFirebaseFirestoreContextFactory(firestore),
    createdAt,
    expiresAt: firebaseUserSessionExpiresAt(credentials, createdAt, maxSessionAgeMs)
  };
}

// MARK: Teardown
/**
 * Tears down a session opened by {@link openFirebaseUserSession}.
 *
 * Required, not optional hygiene. A signed-in `Auth` runs a token-refresh timer and a live
 * `Firestore` holds open handles, so both leak per user without teardown — and in a CLI-shaped
 * process they keep the Node event loop alive indefinitely, so the process never exits.
 *
 * `deleteApp` is the single call that covers it — it disposes every registered component, which for
 * Firestore runs the same shutdown `terminate()` does, and for Auth stops the token-refresh timer.
 *
 * Deliberately tolerant: teardown normally runs after the caller's result is already produced, so a
 * failure here must not change the outcome.
 *
 * @param session - The session to close.
 */
export async function closeFirebaseUserSession(session: Pick<FirebaseUserSession, 'app'>): Promise<void> {
  await closeFirebaseUserSessionApp(session.app);
}

/**
 * Deletes one Firebase app, swallowing any failure.
 *
 * @param app - The app to delete.
 */
export async function closeFirebaseUserSessionApp(app: FirebaseApp): Promise<void> {
  try {
    await deleteApp(app);
  } catch {
    // an already-deleted app (or one whose components failed to dispose) leaves nothing to salvage,
    // and the caller's result has already been produced
  }
}

/**
 * Deletes every still-live Firebase app opened under a namespace, whether or not a session was
 * handed back.
 *
 * The last line of defence against a leak. {@link closeFirebaseUserSession} covers the normal path,
 * but it needs a session to be handed to it, and three cases never produce one:
 *
 * - a handshake that fails AFTER `initializeApp` — a rejected custom token, a failed App Check
 *   registration — throws, so the caller that catches it has an initialized app and no session;
 * - a caller that opens its own session outside a pool owns its own teardown, and forgetting it
 *   leaks;
 * - an owner orphaned mid-invocation carries the only reference to its session.
 *
 * `getApps()` already tracks every live app and `deleteApp` removes it from that list, so the app
 * names {@link firebaseUserSessionAppName} derives are enough to find them again — no side registry
 * to keep in sync, and idempotent by construction.
 *
 * @param input - The function inputs.
 * @param input.namespace - The namespace whose apps should be closed. Apps belonging to other
 *   Firebase consumers in the same process are left alone.
 * @returns Resolves once every matching app has been deleted.
 */
export async function closeFirebaseUserSessionApps(input: { readonly namespace: string }): Promise<void> {
  const prefix = firebaseUserSessionNamespacePrefix(input.namespace);
  const apps = getApps().filter((x) => x.name.startsWith(prefix));

  await Promise.all(apps.map((app) => closeFirebaseUserSessionApp(app)));
}

// MARK: Internal
/**
 * The first unregistered app name at or after `base`, trying `base`, `base#2`, `base#3`, ….
 *
 * @param base - The derived base app name.
 * @returns A name no live app currently holds.
 */
function nextFreeFirebaseAppName(base: string): string {
  const taken = new Set(getApps().map((x) => x.name));
  let result = base;
  let attempt = 1;

  while (taken.has(result)) {
    attempt += 1;
    result = `${base}#${attempt}`;
  }

  return result;
}

/**
 * The session's effective expiry: the EARLIER of the API-reported `expiresAt` and the age ceiling.
 *
 * Mirrors `firestoreSessionEntryExpiresAt` — a server reporting an over-long (or unparsable) window
 * still cannot push a session past the Firebase credential ceiling.
 *
 * @param credentials - The minted envelope.
 * @param createdAt - When the session was opened, in unix epoch milliseconds.
 * @param maxSessionAgeMs - The age ceiling.
 * @returns The effective expiry in unix epoch milliseconds.
 */
function firebaseUserSessionExpiresAt(credentials: FirestoreSessionCredentials, createdAt: UnixDateTimeMillisecondsNumber, maxSessionAgeMs: Milliseconds): UnixDateTimeMillisecondsNumber {
  const ceiling = createdAt + maxSessionAgeMs;
  const reported = Date.parse(credentials.expiresAt);
  return Number.isFinite(reported) ? Math.min(reported, ceiling) : ceiling;
}

/**
 * Resolves the App Check token's expiry from the credential envelope, falling back to a short window
 * when the API returned an unparsable `expiresAt`.
 *
 * @param credentials - The credential envelope returned by the API.
 * @param nowMs - The current time in unix epoch milliseconds.
 * @returns The epoch-millis expiry to advertise to the App Check `CustomProvider`.
 */
function expireTimeMillisFromCredentials(credentials: FirestoreSessionCredentials, nowMs: UnixDateTimeMillisecondsNumber): UnixDateTimeMillisecondsNumber {
  const parsed = Date.parse(credentials.expiresAt);
  return Number.isFinite(parsed) ? parsed : nowMs + 30 * 60 * 1000;
}
