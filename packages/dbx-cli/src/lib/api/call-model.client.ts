import type { OnCallTypedModelParams } from '@dereekb/firebase';
import { CALL_MODEL_APP_FUNCTION_KEY } from '@dereekb/firebase';
import { CliError } from '../util/output';

export const CALL_MODEL_API_PATH = `/model/call`;

export interface CallModelOverHttpInput<T = unknown> {
  /**
   * The API base URL — typically `<host>/<project>/us-central1/api` or `https://<domain>/api`.
   *
   * The `/model/call` path is appended automatically.
   */
  readonly apiBaseUrl: string;
  readonly accessToken: string;
  readonly params: OnCallTypedModelParams<T>;
  /**
   * Custom fetch implementation for tests.
   */
  readonly fetcher?: typeof fetch;
}

export interface CallModelOverHttpResponse<R = unknown> {
  readonly status: number;
  readonly body: R;
}

/**
 * Posts a typed model call to `<apiBaseUrl>/model/call` with a Bearer access token and parses the JSON response.
 *
 * Maps non-2xx responses to a {@link CliError} with a stable code derived from the status — this lets the
 * error envelope downstream emit a sensible suggestion.
 *
 * The function name is referenced via {@link CALL_MODEL_APP_FUNCTION_KEY} for consistency with the demo's wiring.
 */
export async function callModelOverHttp<T = unknown, R = unknown>(input: CallModelOverHttpInput<T>): Promise<R> {
  const fetcher = input.fetcher ?? fetch;
  const url = `${trimSlash(input.apiBaseUrl)}${CALL_MODEL_API_PATH}`;

  const res = await fetcher(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${input.accessToken}`
    },
    body: JSON.stringify(input.params)
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
    const message = typeof body === 'object' && body && 'message' in body ? String((body as { message?: unknown }).message ?? text) : text || `${res.status} ${res.statusText}`;
    throw new CliError({
      message: `callModel ${input.params.modelType}/${input.params.call ?? 'unknown'} failed: ${message}`,
      code: codeForStatus(res.status),
      suggestion: res.status === 401 || res.status === 403 ? 'Run `<cli> auth login` to refresh credentials.' : undefined
    });
  }

  return body as R;
}

function codeForStatus(status: number): string {
  if (status === 401) return 'AUTH_UNAUTHORIZED';
  if (status === 403) return 'AUTH_FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 422) return 'VALIDATION_ERROR';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVER_ERROR';
  return 'API_ERROR';
}

function trimSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export { CALL_MODEL_APP_FUNCTION_KEY };
