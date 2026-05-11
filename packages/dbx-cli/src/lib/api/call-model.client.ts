import type { OnCallTypedModelParams } from '@dereekb/firebase';
import { CliError } from '../util/output';

export const CALL_MODEL_API_PATH = `/model/call`;

export const MAX_MODEL_ACCESS_MULTI_READ_KEYS = 50;

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
 *
 * @param input - The call envelope describing the API target, access token, model params, and optional fetch override.
 * @param input.apiBaseUrl - The API base URL (the `/model/call` path is appended automatically).
 * @param input.accessToken - The Bearer access token sent in the `Authorization` header.
 * @param input.params - The {@link OnCallTypedModelParams} payload posted as JSON.
 * @param input.fetcher - Optional fetch implementation override (used by tests).
 * @returns The parsed JSON response body cast to `R`.
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
    const bodyMessage = typeof body === 'object' && body && 'message' in body ? (body as { message?: unknown }).message : undefined;
    const messageString = typeof bodyMessage === 'string' ? bodyMessage : undefined;
    const message = messageString ?? (text || `${res.status} ${res.statusText}`);
    throw new CliError({
      message: `callModel ${input.params.modelType}/${input.params.call ?? 'unknown'} failed: ${message}`,
      code: codeForStatus(res.status),
      suggestion: res.status === 401 || res.status === 403 ? 'Run `<cli> auth login` to refresh credentials.' : undefined
    });
  }

  return body as R;
}

export interface GetModelOverHttpInput {
  /**
   * The API base URL — typically `<host>/<project>/us-central1/api` or `https://<domain>/api`.
   *
   * The `/model/<modelType>/get` path is appended automatically.
   */
  readonly apiBaseUrl: string;
  readonly accessToken: string;
  readonly modelType: string;
  readonly key: string;
  /**
   * Custom fetch implementation for tests.
   */
  readonly fetcher?: typeof fetch;
}

export interface GetModelOverHttpResult<T = unknown> {
  readonly key: string;
  readonly data: T;
}

/**
 * GETs a single Firestore document by key via the typed model-access endpoint.
 *
 * Calls `<apiBaseUrl>/model/<modelType>/get?key=<encoded key>` with a Bearer access token and
 * returns the parsed `{ key, data }` envelope. Non-2xx responses are mapped to a {@link CliError}
 * with a stable code derived from the status — matching {@link callModelOverHttp}'s error shape.
 *
 * The backend route is implemented by `ModelApiController.getOne` (packages/firebase-server) and
 * enforces `roles: 'read'` via `useModel(...)` so Firestore security rules still apply.
 *
 * @param input - The request envelope describing the API target, access token, model + key, and optional fetch override.
 * @returns The parsed `{ key, data }` envelope.
 */
export async function getModelOverHttp<T = unknown>(input: GetModelOverHttpInput): Promise<GetModelOverHttpResult<T>> {
  const fetcher = input.fetcher ?? fetch;
  const url = `${trimSlash(input.apiBaseUrl)}/model/${encodeURIComponent(input.modelType)}/get?key=${encodeURIComponent(input.key)}`;

  const res = await fetcher(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${input.accessToken}`
    }
  });

  const { ok, body, fallbackMessage } = await readJsonResponse(res);

  if (!ok) {
    throw new CliError({
      message: `get ${input.modelType}/${input.key} failed: ${extractMessage(body, fallbackMessage, res)}`,
      code: codeForStatus(res.status),
      suggestion: res.status === 401 || res.status === 403 ? 'Run `<cli> auth login` to refresh credentials.' : undefined
    });
  }

  return body as GetModelOverHttpResult<T>;
}

export interface GetMultipleModelsOverHttpInput {
  /**
   * The API base URL — typically `<host>/<project>/us-central1/api` or `https://<domain>/api`.
   *
   * The `/model/<modelType>/get` path is appended automatically.
   */
  readonly apiBaseUrl: string;
  readonly accessToken: string;
  readonly modelType: string;
  readonly keys: ReadonlyArray<string>;
  /**
   * Custom fetch implementation for tests.
   */
  readonly fetcher?: typeof fetch;
}

export interface GetMultipleModelsOverHttpResultEntry<T = unknown> {
  readonly key: string;
  readonly data: T;
}

export interface GetMultipleModelsOverHttpErrorEntry {
  readonly key: string;
  readonly error: string;
  readonly code?: string;
}

export interface GetMultipleModelsOverHttpResult<T = unknown> {
  readonly results: ReadonlyArray<GetMultipleModelsOverHttpResultEntry<T>>;
  readonly errors: ReadonlyArray<GetMultipleModelsOverHttpErrorEntry>;
}

/**
 * Batch-reads up to {@link MAX_MODEL_ACCESS_MULTI_READ_KEYS} Firestore documents in a single request.
 *
 * Calls `POST <apiBaseUrl>/model/<modelType>/get` with body `{ keys }` and returns the
 * `{ results, errors }` envelope. The 50-key cap is enforced client-side so the error surfaces
 * with a clear `INVALID_ARGUMENT` code before the request is made.
 *
 * Backend route: `ModelApiController.getMany` (packages/firebase-server). Same `'read'` role enforcement.
 *
 * @param input - The request envelope describing the API target, access token, model, keys, and optional fetch override.
 * @returns The parsed `{ results, errors }` envelope.
 */
export async function getMultipleModelsOverHttp<T = unknown>(input: GetMultipleModelsOverHttpInput): Promise<GetMultipleModelsOverHttpResult<T>> {
  if (input.keys.length === 0) {
    throw new CliError({
      message: 'get-many requires at least one key.',
      code: 'INVALID_ARGUMENT'
    });
  }

  if (input.keys.length > MAX_MODEL_ACCESS_MULTI_READ_KEYS) {
    throw new CliError({
      message: `get-many supports at most ${MAX_MODEL_ACCESS_MULTI_READ_KEYS} keys (got ${input.keys.length}).`,
      code: 'INVALID_ARGUMENT'
    });
  }

  const fetcher = input.fetcher ?? fetch;
  const url = `${trimSlash(input.apiBaseUrl)}/model/${encodeURIComponent(input.modelType)}/get`;

  const res = await fetcher(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${input.accessToken}`
    },
    body: JSON.stringify({ keys: input.keys })
  });

  const { ok, body, fallbackMessage } = await readJsonResponse(res);

  if (!ok) {
    throw new CliError({
      message: `get-many ${input.modelType} failed: ${extractMessage(body, fallbackMessage, res)}`,
      code: codeForStatus(res.status),
      suggestion: res.status === 401 || res.status === 403 ? 'Run `<cli> auth login` to refresh credentials.' : undefined
    });
  }

  return body as GetMultipleModelsOverHttpResult<T>;
}

interface ReadJsonResponse {
  readonly ok: boolean;
  readonly body: unknown;
  readonly fallbackMessage: string;
}

async function readJsonResponse(res: Response): Promise<ReadJsonResponse> {
  const text = await res.text();
  let body: unknown;

  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { ok: res.ok, body, fallbackMessage: text };
}

function extractMessage(body: unknown, fallback: string, res: Response): string {
  const bodyMessage = typeof body === 'object' && body && 'message' in body ? (body as { message?: unknown }).message : undefined;
  const messageString = typeof bodyMessage === 'string' ? bodyMessage : undefined;
  return messageString ?? (fallback || `${res.status} ${res.statusText}`);
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

export { CALL_MODEL_APP_FUNCTION_KEY } from '@dereekb/firebase';
