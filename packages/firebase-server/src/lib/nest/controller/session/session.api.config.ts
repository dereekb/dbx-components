import { type Maybe, type Milliseconds, type PromiseOrValue } from '@dereekb/util';
import { type OidcScopeTerm, FIRESTORE_SESSION_OIDC_SCOPE } from '@dereekb/firebase';
import { type FirebaseServerAuthData } from '../auth.context.server';

// MARK: Paths
/**
 * Route prefix the session API controller is mounted at. Under the `/api` global route prefix the
 * routes become `/api/session/*`.
 */
export const SESSION_API_ROUTE_PREFIX = 'session';

/**
 * Path (relative to the API base URL) of the direct-Firestore session endpoint.
 *
 * The `@dereekb/dbx-cli` client posts to `<apiBaseUrl>${FIRESTORE_SESSION_API_PATH}`.
 */
export const FIRESTORE_SESSION_API_PATH = '/session/firestore';

/**
 * Path prefix apps must add to their OIDC `protectedPaths` so the bearer-token middleware
 * authenticates the session endpoint (today typically `['/api/model', '/mcp']`).
 *
 * Without this the endpoint is reachable unauthenticated — `req.auth` would be `undefined` and the
 * request rejected as unauthenticated, but the gate belongs at the middleware, not the handler.
 */
export const FIREBASE_SERVER_SESSION_API_PROTECTED_PATH = '/api/session';

// MARK: TTL
/**
 * Default lifetime requested for the minted App Check token. Matches the Admin SDK's own default.
 */
export const DEFAULT_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS: Milliseconds = 60 * 60 * 1000;

/**
 * Minimum lifetime the Admin SDK accepts for an App Check token (30 minutes).
 */
export const MIN_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS: Milliseconds = 30 * 60 * 1000;

/**
 * Maximum lifetime the Admin SDK accepts for an App Check token (7 days).
 *
 * Deliberately NOT the default: this endpoint mints a valid web-app App Check attestation for
 * whoever calls it, so the shortest workable lifetime is the right one.
 */
export const MAX_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS: Milliseconds = 7 * 24 * 60 * 60 * 1000;

/**
 * Window a Firebase Auth custom token may be exchanged for an ID token within (1 hour, fixed by
 * Firebase). The exchanged ID token then lives its own hour from sign-in.
 */
export const FIREBASE_CUSTOM_TOKEN_EXCHANGE_WINDOW_MILLIS: Milliseconds = 60 * 60 * 1000;

// MARK: Admin Predicate
/**
 * Signature for the predicate that authorizes a caller to open a direct-Firestore session.
 *
 * Receives the calling request's auth data (`undefined` for an unauthenticated request) and returns
 * true when that caller may be handed a custom token + App Check attestation. Typically an admin
 * check, e.g. `(auth) => authRoleClaimsService.toRoles(auth?.token ?? {}).has('admin')`.
 *
 * This is the LOAD-BEARING gate. `assertIsAdminInRequest` cannot be used here — it needs a
 * `NestContextCallableRequestWithOptionalAuth` with `.nest` attached, and a plain Nest controller
 * only has an Express request carrying `req.auth` — so the check is delegated to the app, keeping
 * `@dereekb/firebase-server` app-agnostic about what "admin" means.
 *
 * When no predicate is provided the endpoint fails closed for EVERY caller.
 */
export type FirestoreSessionAdminPredicate = (auth: Maybe<FirebaseServerAuthData>) => PromiseOrValue<boolean>;

/**
 * NestJS injection token for the {@link FirestoreSessionAdminPredicate} provider.
 */
export const FIRESTORE_SESSION_ADMIN_PREDICATE = 'FIRESTORE_SESSION_ADMIN_PREDICATE';

// MARK: Config
/**
 * Optional configuration for the session API module, supplied by the app via its dependency module.
 *
 * Everything here is optional — with no config provided the endpoint still mints custom tokens, just
 * without an App Check attestation (correct for a project that does not enforce App Check, and for
 * emulator-backed local development).
 */
export abstract class SessionApiModuleConfig {
  /**
   * The Firebase `appId` of the registered **web** app to mint App Check tokens for. This is the same
   * `appId` the browser client initializes with — the attestation must match an app the project's
   * App Check enforcement recognizes.
   *
   * When unset, no App Check token is minted and the response's `appCheckToken` is omitted.
   */
  readonly appCheckAppId?: string;
  /**
   * Lifetime to request for the minted App Check token. Clamped to
   * [{@link MIN_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS}, {@link MAX_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS}].
   *
   * Defaults to {@link DEFAULT_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS}.
   */
  readonly appCheckTokenTtlMillis?: Milliseconds;
  /**
   * OIDC scope term an OIDC caller must hold to open a session. Defaults to
   * {@link FIRESTORE_SESSION_OIDC_SCOPE}. Pass `null` to disable scope enforcement entirely (the admin
   * predicate remains the real gate either way).
   */
  readonly requiredScope?: Maybe<OidcScopeTerm>;
}

/**
 * Resolves the effective App Check TTL from the module config, clamped to the Admin SDK's accepted range.
 *
 * @param ttlMillis - The configured TTL, or `undefined` to use the default.
 * @returns The TTL to request, in milliseconds.
 * @__NO_SIDE_EFFECTS__
 */
export function firestoreSessionAppCheckTtlMillis(ttlMillis: Maybe<Milliseconds>): Milliseconds {
  const requested = ttlMillis ?? DEFAULT_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS;
  return Math.min(Math.max(requested, MIN_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS), MAX_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS);
}

/**
 * The default {@link SessionApiModuleConfig.requiredScope}, re-exported for apps that want to widen it
 * into an OR-group rather than replace it.
 */
export const DEFAULT_FIRESTORE_SESSION_REQUIRED_OIDC_SCOPE: OidcScopeTerm = FIRESTORE_SESSION_OIDC_SCOPE;
