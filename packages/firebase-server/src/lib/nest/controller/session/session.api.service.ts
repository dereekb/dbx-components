import type * as admin from 'firebase-admin';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { type ISO8601DateString, type Maybe, type Milliseconds } from '@dereekb/util';
import { type FirebaseAuthUserId } from '@dereekb/firebase';
import { FIREBASE_APP_TOKEN } from '../../firebase/firebase.module';
import { forbiddenError, unauthenticatedError } from '../../../function/error';
import { type FirebaseServerAuthData } from '../auth.context.server';
import { assertEndpointOidcScope, oidcScopesFromRequestAuth } from '../api.scope';
import { DEFAULT_FIRESTORE_SESSION_REQUIRED_OIDC_SCOPE, FIREBASE_CUSTOM_TOKEN_EXCHANGE_WINDOW_MILLIS, FIRESTORE_SESSION_ADMIN_PREDICATE, FIRESTORE_SESSION_API_PATH, type FirestoreSessionAdminPredicate, SessionApiModuleConfig, firestoreSessionAppCheckTtlMillis } from './session.api.config';

/**
 * Error code thrown when the caller is not authorized to open a direct-Firestore session.
 */
export const FIRESTORE_SESSION_FORBIDDEN_ERROR_CODE = 'FIRESTORE_SESSION_FORBIDDEN_ERROR';

/**
 * A short-lived credential bundle that lets a headless client connect directly to Firestore as the
 * authenticated user, through the app's security rules.
 */
export interface FirestoreSessionResult {
  /**
   * The uid the session was minted for — the calling user's real Firebase Auth uid.
   */
  readonly uid: FirebaseAuthUserId;
  /**
   * A Firebase Auth custom token to exchange via `signInWithCustomToken`. The user's stored
   * `setCustomUserClaims` claims are spread at the TOP LEVEL of the exchanged ID token, so security
   * rules reading `request.auth.token.<claim>` behave exactly as they do for the browser app.
   */
  readonly customToken: string;
  /**
   * An App Check attestation minted for the project's registered web app, for clients that cannot run
   * a browser-only attestation provider (reCAPTCHA v3). Feed it to `initializeAppCheck` through a
   * `CustomProvider`.
   *
   * Omitted when the app did not configure {@link SessionApiModuleConfig.appCheckAppId}.
   */
  readonly appCheckToken?: string;
  /**
   * When the session as a whole stops being usable — the earliest expiry among its credentials.
   * A long-running client should re-fetch rather than assume one session covers the whole job.
   */
  readonly expiresAt: ISO8601DateString;
}

/**
 * Mints the direct-Firestore session credential bundle returned by `SessionApiController`.
 *
 * ## Security
 *
 * This service hands out a valid web-app App Check token and a custom token for the caller's own uid.
 * Two gates apply, in order:
 *
 * 1. The app-supplied {@link FirestoreSessionAdminPredicate} — the load-bearing check. **Fails closed**
 *    when the app provides no predicate.
 * 2. The OIDC scope requirement (default {@link FIRESTORE_SESSION_OIDC_SCOPE}) — defence in depth only.
 *    It cannot stand alone: a non-OIDC caller carries no `scope` claim and every enforcement site in
 *    this codebase treats that as "skip".
 *
 * The custom token is ALWAYS minted for `auth.uid`; there is no way to ask for someone else's session,
 * so a granted session is exactly as privileged as the caller already is under Firestore rules.
 */
@Injectable()
export class FirestoreSessionApiService {
  private readonly _logger = new Logger(FirestoreSessionApiService.name);

  private readonly _app: admin.app.App;
  private readonly _config: Maybe<SessionApiModuleConfig>;
  private readonly _adminPredicate: Maybe<FirestoreSessionAdminPredicate>;

  constructor(@Inject(FIREBASE_APP_TOKEN) app: admin.app.App, @Optional() @Inject(SessionApiModuleConfig) config?: SessionApiModuleConfig, @Optional() @Inject(FIRESTORE_SESSION_ADMIN_PREDICATE) adminPredicate?: FirestoreSessionAdminPredicate) {
    this._app = app;
    this._config = config;
    this._adminPredicate = adminPredicate;

    if (!adminPredicate) {
      this._logger.warn(`No ${FIRESTORE_SESSION_ADMIN_PREDICATE} provided — ${FIRESTORE_SESSION_API_PATH} will reject every caller. Provide one from the session module's dependency module.`);
    }

    if (!config?.appCheckAppId) {
      this._logger.warn(`No SessionApiModuleConfig.appCheckAppId configured — ${FIRESTORE_SESSION_API_PATH} will issue sessions without an App Check attestation. Direct Firestore access will be rejected wherever App Check is enforced.`);
    }
  }

  /**
   * Mints a direct-Firestore session for the calling user after enforcing the admin predicate and the
   * OIDC scope requirement.
   *
   * @param auth - The authenticated request's auth data (`req.auth`).
   * @returns The credential bundle the client needs to connect to Firestore as this user.
   * @throws {HttpsError} A `401` when the request carries no uid, or a `403` when either gate rejects the caller.
   */
  async createFirestoreSession(auth: Maybe<FirebaseServerAuthData>): Promise<FirestoreSessionResult> {
    const uid = auth?.uid;

    if (!uid) {
      throw unauthenticatedError({ message: 'A direct-Firestore session requires an authenticated caller.' });
    }

    const isAllowed = this._adminPredicate ? await this._adminPredicate(auth) : false;

    if (!isAllowed) {
      throw forbiddenError({
        status: 403,
        code: FIRESTORE_SESSION_FORBIDDEN_ERROR_CODE,
        message: 'Not authorized to open a direct-Firestore session.'
      });
    }

    // an explicit `null` disables scope enforcement; only an ABSENT value falls back to the default
    const configuredScope = this._config?.requiredScope;

    assertEndpointOidcScope({
      requiredScope: configuredScope === undefined ? DEFAULT_FIRESTORE_SESSION_REQUIRED_OIDC_SCOPE : configuredScope,
      grantedScopes: oidcScopesFromRequestAuth(auth),
      endpoint: FIRESTORE_SESSION_API_PATH
    });

    const now = Date.now();
    const customToken = await this._app.auth().createCustomToken(uid);

    let appCheckToken: Maybe<string>;
    let appCheckTtlMillis: Maybe<Milliseconds>;

    const appCheckAppId = this._config?.appCheckAppId;

    if (appCheckAppId) {
      const ttlMillis = firestoreSessionAppCheckTtlMillis(this._config?.appCheckTokenTtlMillis);
      const created = await this._app.appCheck().createToken(appCheckAppId, { ttlMillis });
      appCheckToken = created.token;
      appCheckTtlMillis = created.ttlMillis ?? ttlMillis;
    }

    // the session lives only as long as its shortest-lived credential
    const expiresAtMillis = Math.min(now + FIREBASE_CUSTOM_TOKEN_EXCHANGE_WINDOW_MILLIS, ...(appCheckTtlMillis == null ? [] : [now + appCheckTtlMillis]));

    return {
      uid,
      customToken,
      ...(appCheckToken ? { appCheckToken } : undefined),
      expiresAt: new Date(expiresAtMillis).toISOString()
    };
  }
}
