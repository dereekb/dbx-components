import { type Maybe } from '@dereekb/util';
import { MAX_MODEL_ACCESS_MULTI_READ_KEYS, type GetModelOverHttpResult, type GetMultipleModelsOverHttpResult } from '../api/call-model.client';
import { isCliFirebaseConfigComplete } from '../config/env';
import { type CliContext } from '../context/cli.context';
import { type CliModelManifest } from '../manifest/types';
import { CliError, verboseLog } from '../util/output';
import { type CliFirestoreModels } from './firestore.models';

// MARK: Via
/**
 * Transport selection for a read.
 *
 * - `auto` — go direct when the whole chain is present, fall back to the API on a CAPABILITY failure.
 * - `firestore` / `api` — hard selections. They error rather than switching, so a script that means
 *   "prove the direct path works" cannot silently pass on the API path instead.
 */
export type CliReadVia = 'auto' | 'firestore' | 'api';

/**
 * Every accepted `--via` value, for yargs `choices`.
 */
export const CLI_READ_VIA_VALUES: readonly CliReadVia[] = ['auto', 'firestore', 'api'];

/**
 * Default `--via` value.
 */
export const DEFAULT_CLI_READ_VIA: CliReadVia = 'auto';

/**
 * Coerces a raw `--via` argv value, rejecting anything outside {@link CLI_READ_VIA_VALUES}.
 *
 * yargs `choices` already rejects a bad value on the command line, but the same helper is reached
 * from programmatic callers (and from `buildPerModelGetCommand`, whose argv is untyped), so the
 * validation lives here rather than only in the builder.
 *
 * @param value - The raw argv value.
 * @returns The coerced via value, defaulting to `auto` when absent.
 * @throws {CliError} When the value is a non-empty string outside the accepted set.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function coerceCliReadVia(value: unknown): CliReadVia {
  let result: CliReadVia = DEFAULT_CLI_READ_VIA;

  if (typeof value === 'string' && value.length > 0) {
    if (!CLI_READ_VIA_VALUES.includes(value as CliReadVia)) {
      throw new CliError({
        message: `Unknown --via value "${value}".`,
        code: 'INVALID_ARGUMENT',
        suggestion: `Use one of: ${CLI_READ_VIA_VALUES.join(', ')}.`
      });
    }

    result = value as CliReadVia;
  }

  return result;
}

// MARK: Server-only
/**
 * Error code used when a read is refused because the model is server-only.
 */
export const MODEL_IS_SERVER_ONLY_CODE = 'MODEL_IS_SERVER_ONLY';

/**
 * Refuses a read of a `@dbxModelServerOnly` model BEFORE any transport is chosen.
 *
 * The refusal is deliberately transport-independent: the model has no client read grant in
 * `firestore.rules` at all, so the direct path would be rejected by the rules and the API path is
 * refused by `ModelApiGetService`. Answering locally makes the reason legible (and free) instead of
 * surfacing as a permission error from whichever transport happened to run.
 *
 * @param input - The manifest and the model type being read.
 * @param input.manifest - The generated model manifest, when the CLI was wired with one.
 * @param input.modelType - The model type being read.
 * @throws {CliError} `MODEL_IS_SERVER_ONLY` when the manifest marks the model server-only.
 */
export function assertCliModelIsNotServerOnly(input: { readonly manifest: Maybe<CliModelManifest>; readonly modelType: string }): void {
  const entry = input.manifest?.find((e) => e.modelType === input.modelType);

  if (entry?.serverOnly === true) {
    throw new CliError({
      message: `Model "${input.modelType}" is server-only — no client may read it, on any transport.`,
      code: MODEL_IS_SERVER_ONLY_CODE,
      suggestion: `\`firestore.rules\` grants no client read for \`${entry.collectionPrefix}\`, so both the direct-Firestore path and the model API refuse it. Read it from server code (a Cloud Function or a server action) instead — \`--via\` cannot change this.`
    });
  }
}

// MARK: Resolve source
/**
 * Why {@link resolveCliReadSource} chose the source it chose.
 */
export type CliReadSourceReason =
  /**
   * `--via` named the source explicitly.
   */
  | 'explicit'
  /**
   * Under `auto`: the whole direct chain resolved.
   */
  | 'session-available'
  /**
   * Under `auto`: the CLI has no `firestore` binding.
   */
  | 'no-firestore-binding'
  /**
   * Under `auto`: the env carries no complete Firebase client config.
   */
  | 'firebase-config-incomplete'
  /**
   * Under `auto`: the chain is wired but the session could not be opened.
   */
  | 'session-unavailable';

/**
 * The resolved transport for one read.
 */
export interface CliReadSource {
  readonly source: 'firestore' | 'api';
  readonly reason: CliReadSourceReason;
  /**
   * The `--via` value that produced this resolution, so `meta.via` can report what was asked for
   * alongside what ran.
   */
  readonly via: CliReadVia;
  /**
   * The opened session-bound models view. Present only when {@link source} is `firestore`.
   */
  readonly models?: CliFirestoreModels;
  /**
   * Set when `auto` fell back: why the direct path was not usable, verbatim from the underlying error.
   */
  readonly fallbackError?: string;
}

/**
 * Capability-failure codes that make the direct path UNUSABLE for this invocation, as opposed to
 * answering "no" about a specific document.
 *
 * `INVALID_ARGUMENT` — no/incomplete firebase config, or no `firestore` binding.
 * `AUTH_FORBIDDEN` — not an admin, or missing the `session.firestore` scope.
 * `NOT_FOUND` — the API never registered the session module.
 *
 * A per-document `permission-denied` is deliberately absent: that IS the answer about that document,
 * and retrying it on the API — which authorizes via `roleMapForModel` under the Admin SDK and would
 * often succeed — would silently launder a rules refusal into a read.
 */
const CAPABILITY_FAILURE_CODES: readonly string[] = ['INVALID_ARGUMENT', 'AUTH_FORBIDDEN', 'NOT_FOUND'];

/**
 * Input for {@link resolveCliReadSource}.
 */
export interface ResolveCliReadSourceInput {
  readonly context: CliContext;
  readonly via: CliReadVia;
  /**
   * The model type being read. Checked against the manifest's `serverOnly` flag BEFORE any transport
   * is considered.
   */
  readonly modelType: string;
}

/**
 * Resolves which transport a read should use, opening the direct-Firestore session when that is the
 * answer.
 *
 * Called from the read command handlers rather than from inside `CliContext.getModel`: `getModel` is
 * a two-arg function with no room for `--via` without changing every call site including
 * `buildTestCliContext`, and hiding a transport fallback inside the context would contradict the
 * deliberate no-fallback doctrine `firestore.session.ts` and `createFirestoreSessionDoctorCheck`
 * were built around — a failure there should be loud.
 *
 * @param input - The live context, the requested `--via`, and the model type.
 * @returns The resolved source, carrying the opened models view when it is `firestore`.
 * @throws {CliError} `MODEL_IS_SERVER_ONLY` for a server-only model, or the session's own error when `--via firestore` was demanded and the session could not open.
 */
export async function resolveCliReadSource(input: ResolveCliReadSourceInput): Promise<CliReadSource> {
  const { context, via, modelType } = input;

  assertCliModelIsNotServerOnly({ manifest: context.modelManifest, modelType });

  let result: CliReadSource;

  if (via === 'api') {
    result = { source: 'api', reason: 'explicit', via };
  } else if (via === 'firestore') {
    // a hard selection must not silently degrade — let the session's own error surface
    result = { source: 'firestore', reason: 'explicit', via, models: await requireModels(context) };
  } else if (context.getFirestoreModels == null) {
    verboseLog('read: --via auto → api (this CLI has no `firestore` binding)');
    result = { source: 'api', reason: 'no-firestore-binding', via };
  } else if (isCliFirebaseConfigComplete(context.env.firebase)) {
    result = await resolveAutoReadSource(context, via);
  } else {
    verboseLog(`read: --via auto → api (env "${context.envName}" has no complete firebase client config)`);
    result = { source: 'api', reason: 'firebase-config-incomplete', via };
  }

  return result;
}

/**
 * The `auto` path with a wired chain: try to open the session, fall back to the API only on a
 * capability failure.
 *
 * @param context - The live context.
 * @param via - The requested via, carried onto the result.
 * @returns The resolved source.
 */
async function resolveAutoReadSource(context: CliContext, via: CliReadVia): Promise<CliReadSource> {
  let result: CliReadSource;

  try {
    result = { source: 'firestore', reason: 'session-available', via, models: await requireModels(context) };
  } catch (e) {
    const code = e instanceof CliError ? e.code : undefined;
    const message = e instanceof Error ? e.message : String(e);

    if (code != null && CAPABILITY_FAILURE_CODES.includes(code)) {
      verboseLog(`read: --via auto → api (direct-Firestore session unavailable: ${code} ${message})`);
      result = { source: 'api', reason: 'session-unavailable', via, fallbackError: message };
    } else {
      throw e;
    }
  }

  return result;
}

async function requireModels(context: CliContext): Promise<CliFirestoreModels> {
  const getFirestoreModels = context.getFirestoreModels;

  if (getFirestoreModels == null) {
    throw new CliError({
      message: 'This CLI is not configured for generic direct-Firestore reads.',
      code: 'INVALID_ARGUMENT',
      suggestion: 'Pass `firestore: cliFirestoreBinding({ collections, models })` to `runCli()`, or read `--via api`.'
    });
  }

  return getFirestoreModels();
}

/**
 * Builds the `meta` block every read emits, so which transport ran is always observable.
 *
 * @param source - The resolved source.
 * @returns The meta record for `outputResult`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function cliReadResultMeta(source: CliReadSource): Record<string, unknown> {
  return {
    source: source.source,
    via: source.via,
    reason: source.reason,
    ...(source.fallbackError === undefined ? {} : { fallbackError: source.fallbackError }),
    ...(source.models === undefined ? {} : { sessionFromCache: source.models.session.fromCache })
  };
}

// MARK: Reads
/**
 * Reads one document directly from Firestore by model key.
 *
 * Returns the exact `GetModelOverHttpResult` envelope `GET /model/<type>/get` returns, so `--via`
 * never changes the output shape.
 *
 * @param input - The read inputs.
 * @param input.models - The session-bound models view.
 * @param input.modelType - The model type to load through.
 * @param input.key - The document key to read.
 * @returns `{ key, data }`, with `data: null` when the document does not exist.
 * @throws {CliError} When the key does not match the model's path shape.
 */
export async function getModelOverFirestore<T = unknown>(input: { readonly models: CliFirestoreModels; readonly modelType: string; readonly key: string }): Promise<GetModelOverHttpResult<Maybe<T>>> {
  const { models, modelType, key } = input;
  const service = models.serviceFor(modelType);
  let data: Maybe<T>;

  try {
    data = ((await service.loadModelForKey(key).snapshotData()) ?? null) as Maybe<T>;
  } catch (e) {
    throw asKeyShapeError(e, modelType, key);
  }

  return { key, data };
}

type DirectReadOutcome<T> = { readonly key: string; readonly data: Maybe<T> } | { readonly key: string; readonly error: string; readonly code?: string };

/**
 * Batch-reads documents directly from Firestore by model key.
 *
 * Mirrors the API's `{ results, errors }` partition rather than failing the whole batch on one bad
 * key: a rules refusal or a malformed key for one document lands in `errors` and the rest still come
 * back, which is the behaviour `get-many` callers already handle.
 *
 * Reads within a batch are issued concurrently (each is an independent single-document fetch through
 * the same session, so serializing them would make a batch as deep as it is wide), but the batch
 * width is capped at {@link MAX_MODEL_ACCESS_MULTI_READ_KEYS} — the same chunk size the API path
 * uses. `get-many -` reads its keys from stdin and is unbounded, so one `Promise.all` over the whole
 * list would open thousands of concurrent reads on a large input.
 *
 * @param input - The read inputs.
 * @param input.models - The session-bound models view.
 * @param input.modelType - The model type to load through.
 * @param input.keys - The document keys to read.
 * @returns `{ results, errors }`, key order preserved within each partition.
 */
export async function getMultipleModelsOverFirestore<T = unknown>(input: { readonly models: CliFirestoreModels; readonly modelType: string; readonly keys: ReadonlyArray<string> }): Promise<GetMultipleModelsOverHttpResult<Maybe<T>>> {
  const { models, modelType, keys } = input;
  const service = models.serviceFor(modelType);
  const settled: DirectReadOutcome<T>[] = [];

  for (let offset = 0; offset < keys.length; offset += MAX_MODEL_ACCESS_MULTI_READ_KEYS) {
    const batch = await Promise.all(
      keys.slice(offset, offset + MAX_MODEL_ACCESS_MULTI_READ_KEYS).map(async (key): Promise<DirectReadOutcome<T>> => {
        let outcome: DirectReadOutcome<T>;

        try {
          outcome = { key, data: ((await service.loadModelForKey(key).snapshotData()) ?? null) as Maybe<T> };
        } catch (e) {
          const mapped = asKeyShapeError(e, modelType, key);
          outcome = { key, error: mapped.message, ...(mapped instanceof CliError ? { code: mapped.code } : {}) };
        }

        return outcome;
      })
    );

    settled.push(...batch);
  }

  return {
    results: settled.filter((x): x is { readonly key: string; readonly data: Maybe<T> } => 'data' in x),
    errors: settled.filter((x): x is { readonly key: string; readonly error: string; readonly code?: string } => 'error' in x)
  };
}

/**
 * Wraps `documentRefForKey`'s bare `Error` into a `CliError` the CLI can render.
 *
 * `documentRefForKey` throws `unexpected key/path "…" for expected type …` on a mismatched path,
 * which would otherwise reach the user as a generic `ERROR` envelope with no hint that the key shape
 * is the problem.
 *
 * @param error - The thrown value.
 * @param modelType - The model type the read was dispatched through.
 * @param key - The key that was read.
 * @returns A `CliError` for a key-shape mismatch, otherwise the original error.
 */
function asKeyShapeError(error: unknown, modelType: string, key: string): Error {
  let result: Error;

  if (error instanceof Error && /unexpected key\/path/i.test(error.message)) {
    result = new CliError({
      message: `Key "${key}" does not match the path shape for model "${modelType}": ${error.message}`,
      code: 'INVALID_ARGUMENT',
      suggestion: 'Nested models need their full parent path, e.g. "gb/<guestbookId>/gbe/<entryId>".'
    });
  } else {
    result = error instanceof Error ? error : new Error(String(error));
  }

  return result;
}
