import { type FirestoreSessionCredentials, type FirestoreSessionErrorFactory, type FirestoreSessionErrorInput, fetchFirestoreSession as fetchGenericFirestoreSession } from '@dereekb/oauth-resource/firebase';
import { CliError, tracedFetch } from '../util/output';

export { FIRESTORE_SESSION_API_PATH } from '@dereekb/oauth-resource/firebase';

/**
 * The credential bundle `GET <apiBaseUrl>/session/firestore` returns.
 *
 * The CLI's name for {@link FirestoreSessionCredentials}, which is the shared implementation in
 * `@dereekb/oauth-resource/firebase`.
 */
export type CliFirestoreSession = FirestoreSessionCredentials;

/**
 * `CliError` code raised for each {@link FirestoreSessionErrorCode}.
 *
 * The mapping is exhaustive rather than defaulted so a new generic code is a compile error here
 * instead of a silent `API_ERROR` in the operator's output.
 */
const CLI_FIRESTORE_SESSION_ERROR_CODES: Readonly<Record<FirestoreSessionErrorInput['code'], string>> = {
  unauthorized: 'AUTH_UNAUTHORIZED',
  forbidden: 'AUTH_FORBIDDEN',
  not_found: 'NOT_FOUND',
  unavailable: 'SERVER_ERROR',
  invalid_response: 'API_ERROR',
  invalid_config: 'INVALID_ARGUMENT'
};

/**
 * Maps a generic session failure onto a {@link CliError}, re-attaching the CLI-flavored remediation
 * an operator can act on (`<cli> auth login --env <env>` and friends).
 *
 * @param input - The generic failure.
 * @returns The `CliError` to throw.
 */
export const cliFirestoreSessionErrorFactory: FirestoreSessionErrorFactory = (input: FirestoreSessionErrorInput) => {
  // the 401/403 text is CLI-specific — it names the command an operator runs to fix it, which the
  // package-level wording deliberately cannot
  const suggestion = input.code === 'unauthorized' || input.code === 'forbidden' ? 'The direct-Firestore session endpoint is admin-only and requires the `session.firestore` scope. Run `<cli> auth login` with that scope as an admin user.' : input.suggestion;

  return new CliError({
    message: input.message,
    code: CLI_FIRESTORE_SESSION_ERROR_CODES[input.code],
    ...(suggestion == null ? {} : { suggestion })
  });
};

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
 * The thin CLI wrapper over `@dereekb/oauth-resource/firebase`'s `fetchFirestoreSession`: it binds
 * the CLI's `tracedFetch` (so `--verbose` and `--timeout` apply) and the `CliError` factory.
 *
 * @param input - The API target, access token, and optional fetch override.
 * @returns The parsed {@link CliFirestoreSession}.
 * @throws {CliError} When the endpoint answers non-2xx or returns an unusable body.
 */
export async function fetchFirestoreSession(input: FetchFirestoreSessionInput): Promise<CliFirestoreSession> {
  return fetchGenericFirestoreSession({
    apiBaseUrl: input.apiBaseUrl,
    accessToken: input.accessToken,
    fetcher: cliFirestoreSessionFetcher(input.fetcher),
    errorFactory: cliFirestoreSessionErrorFactory
  });
}

/**
 * Binds the CLI's verbose-trace + `--timeout` fetch behavior onto the supplied (or global) fetch.
 *
 * @param fetcher - The underlying fetch impl, when one was injected.
 * @returns A `fetch`-shaped function carrying the CLI's tracing.
 */
export function cliFirestoreSessionFetcher(fetcher?: typeof fetch): typeof fetch {
  return ((input: string | URL | Request, init?: RequestInit) => tracedFetch(fetcher, input, init)) as typeof fetch;
}
