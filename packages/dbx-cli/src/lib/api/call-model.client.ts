import type { OnCallTypedModelParams } from '@dereekb/firebase';
import { CliError, tracedFetch } from '../util/output';

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
 * @returns The parsed JSON response body cast to `R`.
 */
export async function callModelOverHttp<T = unknown, R = unknown>(input: CallModelOverHttpInput<T>): Promise<R> {
  return requestJson<R>({
    method: 'POST',
    url: `${trimSlash(input.apiBaseUrl)}${CALL_MODEL_API_PATH}`,
    accessToken: input.accessToken,
    jsonBody: input.params,
    fetcher: input.fetcher,
    errorPrefix: `callModel ${input.params.modelType}/${input.params.call ?? 'unknown'} failed`
  });
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
  return requestJson<GetModelOverHttpResult<T>>({
    method: 'GET',
    url: `${trimSlash(input.apiBaseUrl)}/model/${encodeURIComponent(input.modelType)}/get?key=${encodeURIComponent(input.key)}`,
    accessToken: input.accessToken,
    fetcher: input.fetcher,
    errorPrefix: `get ${input.modelType}/${input.key} failed`
  });
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
 * For >50 keys, use {@link getMultipleModelsOverHttpChunked} to auto-batch and merge.
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
      message: `get-many supports at most ${MAX_MODEL_ACCESS_MULTI_READ_KEYS} keys (got ${input.keys.length}). Use getMultipleModelsOverHttpChunked to auto-batch.`,
      code: 'INVALID_ARGUMENT'
    });
  }

  return requestJson<GetMultipleModelsOverHttpResult<T>>({
    method: 'POST',
    url: `${trimSlash(input.apiBaseUrl)}/model/${encodeURIComponent(input.modelType)}/get`,
    accessToken: input.accessToken,
    jsonBody: { keys: input.keys },
    fetcher: input.fetcher,
    errorPrefix: `get-many ${input.modelType} failed`
  });
}

/**
 * Batch-reads any number of keys by chunking into requests of {@link MAX_MODEL_ACCESS_MULTI_READ_KEYS}
 * keys each and merging the `{ results, errors }` envelopes across batches.
 *
 * Chunks are sent sequentially so a single env doesn't see a burst of concurrent connections.
 *
 * @param input - Same shape as {@link GetMultipleModelsOverHttpInput} but without the 50-key cap.
 * @returns The merged `{ results, errors }` envelope across all chunks.
 */
export async function getMultipleModelsOverHttpChunked<T = unknown>(input: GetMultipleModelsOverHttpInput): Promise<GetMultipleModelsOverHttpResult<T>> {
  if (input.keys.length === 0) {
    throw new CliError({
      message: 'get-many requires at least one key.',
      code: 'INVALID_ARGUMENT'
    });
  }

  const chunks: string[][] = [];
  for (let i = 0; i < input.keys.length; i += MAX_MODEL_ACCESS_MULTI_READ_KEYS) {
    chunks.push(input.keys.slice(i, i + MAX_MODEL_ACCESS_MULTI_READ_KEYS));
  }

  const mergedResults: GetMultipleModelsOverHttpResultEntry<T>[] = [];
  const mergedErrors: GetMultipleModelsOverHttpErrorEntry[] = [];

  for (const chunk of chunks) {
    const batch = await getMultipleModelsOverHttp<T>({ ...input, keys: chunk });
    mergedResults.push(...batch.results);
    mergedErrors.push(...batch.errors);
  }

  return { results: mergedResults, errors: mergedErrors };
}

interface RequestJsonInput {
  readonly method: 'GET' | 'POST';
  readonly url: string;
  readonly accessToken: string;
  readonly jsonBody?: unknown;
  readonly fetcher?: typeof fetch;
  readonly errorPrefix: string;
}

async function requestJson<R>(input: RequestJsonInput): Promise<R> {
  const hasJsonBody = input.jsonBody !== undefined;
  const init: RequestInit = {
    method: input.method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${input.accessToken}`,
      ...(hasJsonBody ? { 'Content-Type': 'application/json' } : null)
    },
    ...(hasJsonBody ? { body: JSON.stringify(input.jsonBody) } : null)
  };

  const res = await tracedFetch(input.fetcher, input.url, init);
  const { ok, body, fallbackMessage } = await readJsonResponse(res);

  if (!ok) {
    throw new CliError({
      message: `${input.errorPrefix}: ${extractMessage(body, fallbackMessage, res)}`,
      code: codeForStatus(res.status),
      suggestion: res.status === 401 || res.status === 403 ? 'Run `<cli> auth login` to refresh credentials.' : undefined
    });
  }

  return body as R;
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
  let result: string;
  if (status === 401) {
    result = 'AUTH_UNAUTHORIZED';
  } else if (status === 403) {
    result = 'AUTH_FORBIDDEN';
  } else if (status === 404) {
    result = 'NOT_FOUND';
  } else if (status === 422) {
    result = 'VALIDATION_ERROR';
  } else if (status === 429) {
    result = 'RATE_LIMITED';
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

export { CALL_MODEL_APP_FUNCTION_KEY } from '@dereekb/firebase';
