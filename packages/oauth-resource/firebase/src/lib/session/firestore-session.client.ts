import { type CodedError, type ISO8601DateString, type Maybe, type WebsiteUrl } from '@dereekb/util';
import { type FirebaseAuthUserId } from '@dereekb/firebase';
import { type OAuthResourceErrorCode } from '@dereekb/oauth-resource';
import { BaseError } from 'make-error';

/**
 * Path (relative to the API base URL) of the user-scoped Firestore session endpoint served by
 * `@dereekb/firebase-server`'s `SessionApiController`.
 *
 * Duplicated here rather than imported because importing it from `@dereekb/firebase-server` would be
 * a dependency CYCLE: `firebase-server` already depends on `@dereekb/oauth-resource`
 * (`packages/firebase-server/oidc/src/lib/service/oidc.service.ts`). The source of truth is
 * `packages/firebase-server/src/lib/nest/controller/session/session.api.config.ts`.
 */
export const FIRESTORE_SESSION_API_PATH = `/session/firestore`;

/**
 * The credential bundle `GET <apiBaseUrl>/session/firestore` returns.
 *
 * Mirrors `FirestoreSessionResult` in `@dereekb/firebase-server`'s `session.api.service.ts`.
 *
 * SECURITY: this is a bearer credential for the user it names. The custom token is exchangeable for
 * a signed-in Firebase session as that uid by anyone holding it.
 */
export interface FirestoreSessionCredentials {
  /**
   * The uid the session was minted for.
   */
  readonly uid: FirebaseAuthUserId;
  /**
   * A Firebase Auth custom token to exchange via `signInWithCustomToken`.
   */
  readonly customToken: string;
  /**
   * An App Check attestation minted server-side for the project's registered web app. Absent when
   * the API has no `appCheckAppId` configured (a project that does not enforce App Check).
   */
  readonly appCheckToken?: string;
  /**
   * ISO timestamp at which the session's shortest-lived credential expires.
   */
  readonly expiresAt: ISO8601DateString;
}

// MARK: Error
/**
 * Stable error code raised while obtaining a user-scoped Firestore session.
 *
 * Widens {@link OAuthResourceErrorCode} rather than forking a parallel union (DG-2). The 401/403
 * members mean exactly what they mean there; the rest describe a failure of the OUTBOUND mint call,
 * which is a different domain from an inbound token check — which is why they are NOT pushed back
 * into `OAuthResourceErrorCode`: `bearerChallengeErrorForCode` would silently map them to
 * `invalid_token`, and `OAUTH_RESOURCE_ERROR_STATUS_CODES` is a total `Record`.
 */
export type FirestoreSessionErrorCode = OAuthResourceErrorCode | 'not_found' | 'unavailable' | 'invalid_response' | 'invalid_config';

export interface FirestoreSessionErrorInput {
  readonly code: FirestoreSessionErrorCode;
  readonly message: string;
  /**
   * HTTP status of the failed mint call, when the failure came from one.
   */
  readonly status?: Maybe<number>;
  /**
   * The actionable next step for an operator.
   */
  readonly suggestion?: Maybe<string>;
  /**
   * Extra machine-readable context carried onto the error.
   */
  readonly details?: Maybe<Record<string, unknown>>;
}

/**
 * Error raised when a user-scoped Firestore session cannot be obtained.
 *
 * Consumers that already have their own error type do not have to catch and re-wrap this one: pass a
 * {@link FirestoreSessionErrorFactory} and the session functions throw that type instead — the same
 * seam `OAuthResourceErrorFactory` provides for verification.
 */
export class FirestoreSessionError extends BaseError implements CodedError {
  readonly code: FirestoreSessionErrorCode;
  readonly status?: number;
  readonly suggestion?: string;
  readonly details?: Record<string, unknown>;

  constructor(input: FirestoreSessionErrorInput) {
    super(input.message);
    this.code = input.code;

    if (input.status != null) {
      this.status = input.status;
    }

    if (input.suggestion != null) {
      this.suggestion = input.suggestion;
    }

    if (input.details != null) {
      this.details = input.details;
    }
  }
}

/**
 * Creates the error thrown when a session cannot be obtained.
 *
 * The seam that keeps this package error-type agnostic.
 */
export type FirestoreSessionErrorFactory = (input: FirestoreSessionErrorInput) => Error;

/**
 * Default {@link FirestoreSessionErrorFactory}, producing a {@link FirestoreSessionError}.
 *
 * @param input - The code, message, status, suggestion, and details of the failure.
 * @returns The error to throw.
 */
export const defaultFirestoreSessionErrorFactory: FirestoreSessionErrorFactory = (input: FirestoreSessionErrorInput) => new FirestoreSessionError(input);

/**
 * Returns true when the input is a {@link FirestoreSessionError}.
 *
 * @param error - The value to test.
 * @returns Whether the value is a {@link FirestoreSessionError}.
 */
export function isFirestoreSessionError(error: unknown): error is FirestoreSessionError {
  return error instanceof FirestoreSessionError;
}

/**
 * Maps an HTTP status from the mint endpoint onto a {@link FirestoreSessionErrorCode}.
 *
 * @param status - The response status.
 * @returns The matching error code.
 * @__NO_SIDE_EFFECTS__
 */
export function firestoreSessionErrorCodeForStatus(status: number): FirestoreSessionErrorCode {
  let result: FirestoreSessionErrorCode;

  if (status === 401) {
    result = 'unauthorized';
  } else if (status === 403) {
    result = 'forbidden';
  } else if (status === 404) {
    result = 'not_found';
  } else if (status >= 500) {
    result = 'unavailable';
  } else {
    result = 'invalid_response';
  }

  return result;
}

// MARK: Fetch
/**
 * Composes the session endpoint's absolute URL from an API base URL.
 *
 * @param apiBaseUrl - The API base URL, with or without a trailing slash.
 * @returns The absolute `/session/firestore` URL.
 * @__NO_SIDE_EFFECTS__
 */
export function firestoreSessionUrl(apiBaseUrl: WebsiteUrl): WebsiteUrl {
  return `${trimSlash(apiBaseUrl)}${FIRESTORE_SESSION_API_PATH}`;
}

export interface FetchFirestoreSessionInput {
  /**
   * The API base URL — typically `<host>/<project>/us-central1/api` or `https://<domain>/api`.
   *
   * The `/session/firestore` path is appended automatically.
   */
  readonly apiBaseUrl: WebsiteUrl;
  /**
   * The verified bearer access token to present. Must carry the `session.firestore` scope.
   */
  readonly accessToken: string;
  /**
   * Custom fetch implementation, for tracing or for tests.
   */
  readonly fetcher?: Maybe<typeof fetch>;
  /**
   * Maps a failure onto the consumer's own error type. Defaults to
   * {@link defaultFirestoreSessionErrorFactory}.
   */
  readonly errorFactory?: Maybe<FirestoreSessionErrorFactory>;
}

/**
 * Fetches a user-scoped Firestore session from the API with a Bearer access token.
 *
 * The endpoint is admin-only and additionally gated on the `session.firestore` OIDC scope, so a 403
 * here usually means the token's user is not an admin or the token was issued without that scope.
 *
 * @param input - The API target, access token, and optional fetch/error overrides.
 * @returns The parsed {@link FirestoreSessionCredentials}.
 * @throws {FirestoreSessionError} (or the `errorFactory`'s type) When the endpoint answers non-2xx or returns an unusable body.
 */
export async function fetchFirestoreSession(input: FetchFirestoreSessionInput): Promise<FirestoreSessionCredentials> {
  const errorFactory = input.errorFactory ?? defaultFirestoreSessionErrorFactory;
  const url = firestoreSessionUrl(input.apiBaseUrl);
  const fetchImpl = input.fetcher ?? fetch;

  const res = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${input.accessToken}`
    }
  });

  const text = await res.text();
  let body: unknown;

  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    throw errorFactory({
      message: `firestore session request failed: ${extractMessage(body, text, res)}`,
      code: firestoreSessionErrorCodeForStatus(res.status),
      status: res.status,
      suggestion:
        res.status === 401 || res.status === 403
          ? '`/session/firestore` is admin-only and additionally gated on the `session.firestore` OIDC scope. The presented access token must belong to an admin user and carry that scope.'
          : 'Verify the API exposes `/session/firestore` (the `@dereekb/firebase-server` session module must be registered and `/api/session` added to the OIDC `protectedPaths`).'
    });
  }

  const credentials = body as Partial<FirestoreSessionCredentials>;

  if (!credentials?.customToken) {
    throw errorFactory({
      message: 'firestore session response did not include a customToken.',
      code: 'invalid_response',
      status: res.status,
      suggestion: 'Verify the API is running a `@dereekb/firebase-server` version that serves `/session/firestore`.'
    });
  }

  return credentials as FirestoreSessionCredentials;
}

/**
 * The most descriptive message available for a failed response.
 *
 * @param body - The parsed body, when one parsed.
 * @param fallback - The raw response text.
 * @param res - The response, for its status line.
 * @returns The message to report.
 */
function extractMessage(body: unknown, fallback: string, res: Response): string {
  const bodyMessage = typeof body === 'object' && body && 'message' in body ? (body as { message?: unknown }).message : undefined;
  const messageString = typeof bodyMessage === 'string' ? bodyMessage : undefined;
  return messageString ?? (fallback || `${res.status} ${res.statusText}`);
}

/**
 * Removes a single trailing slash from a URL.
 *
 * @param url - The URL to trim.
 * @returns The URL with no trailing slash.
 */
function trimSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
