import { CliError, tracedFetch } from '../util/output';

/**
 * Path (relative to the API base URL) of the direct-Firestore session endpoint served by
 * `@dereekb/firebase-server`'s `SessionApiController`.
 *
 * Duplicated here rather than imported so `dbx-cli` keeps no dependency on the server package —
 * the same arrangement `CALL_MODEL_API_PATH` uses.
 */
export const FIRESTORE_SESSION_API_PATH = `/session/firestore`;

/**
 * The credential bundle `GET <apiBaseUrl>/session/firestore` returns.
 */
export interface CliFirestoreSession {
  /**
   * The uid the session was minted for.
   */
  readonly uid: string;
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
  readonly expiresAt: string;
}

export interface FetchFirestoreSessionInput {
  /**
   * The API base URL — typically `<host>/<project>/us-central1/api` or `https://<domain>/api`.
   *
   * The `/session/firestore` path is appended automatically.
   */
  readonly apiBaseUrl: string;
  readonly accessToken: string;
  /**
   * Custom fetch implementation for tests.
   */
  readonly fetcher?: typeof fetch;
}

/**
 * Fetches a direct-Firestore session from the API with the cached Bearer access token.
 *
 * The endpoint is admin-only and additionally gated on the `session.firestore` OIDC scope, so a 403
 * here usually means the logged-in user is not an admin or logged in without that scope.
 *
 * @param input - The API target, access token, and optional fetch override.
 * @returns The parsed {@link CliFirestoreSession}.
 * @throws {CliError} When the endpoint answers non-2xx or returns an unusable body.
 */
export async function fetchFirestoreSession(input: FetchFirestoreSessionInput): Promise<CliFirestoreSession> {
  const url = `${trimSlash(input.apiBaseUrl)}${FIRESTORE_SESSION_API_PATH}`;

  const res = await tracedFetch(input.fetcher, url, {
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
    throw new CliError({
      message: `firestore session request failed: ${extractMessage(body, text, res)}`,
      code: codeForStatus(res.status),
      suggestion:
        res.status === 401 || res.status === 403
          ? 'The direct-Firestore session endpoint is admin-only and requires the `session.firestore` scope. Run `<cli> auth login` with that scope as an admin user.'
          : 'Verify the API exposes `/session/firestore` (the firebase-server session module must be registered and `/api/session` added to the OIDC `protectedPaths`).'
    });
  }

  const session = body as Partial<CliFirestoreSession>;

  if (!session?.customToken) {
    throw new CliError({
      message: 'firestore session response did not include a customToken.',
      code: 'API_ERROR',
      suggestion: 'Verify the API is running a `@dereekb/firebase-server` version that serves `/session/firestore`.'
    });
  }

  return session as CliFirestoreSession;
}

function extractMessage(body: unknown, fallback: string, res: Response): string {
  const bodyMessage = typeof body === 'object' && body && 'message' in body ? (body as { message?: unknown }).message : undefined;
  const messageString = typeof bodyMessage === 'string' ? bodyMessage : undefined;
  return messageString ?? (fallback || `${res.status} ${res.statusText}`);
}

function codeForStatus(status: number): string {
  let result: string;

  if (status === 401) {
    result = 'AUTH_UNAUTHORIZED';
  } else if (status === 403) {
    result = 'AUTH_FORBIDDEN';
  } else if (status === 404) {
    result = 'NOT_FOUND';
  } else if (status >= 500) {
    result = 'SERVER_ERROR';
  } else {
    result = 'API_ERROR';
  }

  return result;
}

function trimSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
