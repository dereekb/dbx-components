import { type Maybe } from '@dereekb/util';

/**
 * A model slug/id as used by OpenRouter (e.g. `openai/gpt-5.1`).
 *
 * NOTE: `@dereekb/nestjs/openrouter` declares a type-identical alias of the same name. The two are
 * deliberately not shared: importing this package from there would put an edge from the `nestjs`
 * build pipeline into this one, and this package's `firebase-server` entry already depends on
 * `@dereekb/nestjs/openrouter`. They are plain string aliases, so values cross the boundary freely.
 */
export type OpenRouterModelId = string;

/**
 * A model slug naming a SYSTEM ONE model — OpenRouter's second inference surface, served by
 * `POST /systemone` rather than `/responses`.
 *
 * A System One model does not take messages and does not answer with prose. The caller declares the
 * answer space up front as typed questions and the model returns a position inside it plus a calibrated
 * distribution. See `openrouter.decision.ts`.
 */
export type OpenRouterSystemOneModelId = OpenRouterModelId;

/**
 * The namespace every System One model slug lives under.
 */
export const OPENROUTER_SYSTEM_ONE_MODEL_NAMESPACE = 'typesafe';

/**
 * Jev 1.13, the System One model this package pins by default.
 *
 * A VERSIONED slug rather than one of the moving aliases (`jev-latest`, `jev-preview`), for the same
 * reason {@link OpenRouterPromptVersionNumber} exists: a decision's answer is only reproducible against
 * the exact model that produced it, and an alias silently moves out from under a stored prompt. Point a
 * prompt at an alias deliberately, never by default.
 */
export const OPENROUTER_JEV_1_13_MODEL_ID: OpenRouterSystemOneModelId = 'typesafe/jev-1.13';

/**
 * The newest STABLE Jev. A moving alias — see {@link OPENROUTER_JEV_1_13_MODEL_ID}.
 */
export const OPENROUTER_JEV_LATEST_MODEL_ID: OpenRouterSystemOneModelId = 'typesafe/jev-latest';

/**
 * The newest Jev, stable or not. A moving alias — see {@link OPENROUTER_JEV_1_13_MODEL_ID}.
 */
export const OPENROUTER_JEV_PREVIEW_MODEL_ID: OpenRouterSystemOneModelId = 'typesafe/jev-preview';

/**
 * The System One model a decision uses when its config names none.
 */
export const DEFAULT_OPENROUTER_SYSTEM_ONE_MODEL_ID: OpenRouterSystemOneModelId = OPENROUTER_JEV_1_13_MODEL_ID;

/**
 * Matches the bare System One slugs OpenRouter maps into the `typesafe/` namespace.
 */
const OPENROUTER_BARE_SYSTEM_ONE_MODEL_REGEX = /^jev(-|$)/;

/**
 * Whether a model slug names a System One model.
 *
 * This is the ONLY discriminator available, and it is the reason this function exists rather than a
 * lookup: System One models are NOT listed by `GET /models`, so nothing can be learned about one from
 * the catalog. A caller that guessed wrong does not get an error it can read — a Jev slug sent to
 * `/responses` fails at the provider, and a chat slug sent to `/systemone` is refused by the route.
 *
 * Both forms are recognised: the namespaced slug (`typesafe/jev-1.13`) and the bare one (`jev-1.13`,
 * `jev-latest`), which the SDK documents itself as mapping onto the `typesafe/` namespace.
 *
 * @param model - The model slug to test.
 * @returns True when the slug names a System One model.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isOpenRouterSystemOneModelId(model: Maybe<OpenRouterModelId>): boolean {
  const slug = model?.trim().toLowerCase();
  return slug == null || slug === '' ? false : slug.startsWith(`${OPENROUTER_SYSTEM_ONE_MODEL_NAMESPACE}/`) || OPENROUTER_BARE_SYSTEM_ONE_MODEL_REGEX.test(slug);
}

/**
 * A generation id returned by OpenRouter for a completed request.
 *
 * See the note on {@link OpenRouterModelId} regarding the twin in `@dereekb/nestjs/openrouter`.
 */
export type OpenRouterGenerationId = string;

/**
 * The stable, human-readable key of an OpenRouterPrompt. Doubles as the prompt's Firestore document
 * id, replacing OpenAI's opaque `pmpt_…` identifiers.
 *
 * Example: `kaia-resume-parser`.
 */
export type OpenRouterPromptKey = string;

/**
 * A published version number of an OpenRouterPrompt. Monotonically increasing from 1.
 */
export type OpenRouterPromptVersionNumber = number;

/**
 * The caller-supplied key of an OpenRouterRunTask. Doubles as the run task's Firestore document id,
 * and is the value stored wherever an OpenAI `responseId` is stored today.
 *
 * Callers are expected to derive this deterministically (e.g. from a NotificationTask's model key)
 * so re-entering the checkpoint that enqueued it reuses the same document instead of queueing a
 * duplicate run.
 */
export type OpenRouterRunTaskKey = string;

/**
 * Identifier of a deferred tool call, chosen by the system that will eventually resolve it.
 *
 * OpenRouter does not allocate these — `ctx.defer(taskId)` takes whatever the caller passes.
 */
export type OpenRouterDeferredToolTaskId = string;

/**
 * A GCS object path (no bucket, no signed query string) of a file to send with a request.
 *
 * Stored rather than a signed URL so the URL can be minted per attempt — see
 * {@link OpenRouterFileReference}.
 */
export type OpenRouterFileStoragePath = string;

/**
 * The `hash` OpenRouter returns on a `file-parser` annotation, identifying an already-parsed file.
 */
export type OpenRouterFileAnnotationHash = string;

/**
 * A reference to a file to send with a request.
 *
 * This type exists BECAUSE of the constraint, so this is where the constraint is stated: the path is
 * stored, never a signed URL. A run task can sit queued for a sweep interval, be retried, and (with
 * deferred tools) resume much later, so a URL minted at enqueue time would 403 by the time it was used.
 * The runner signs the path fresh on every attempt instead.
 */
export interface OpenRouterFileReference {
  /**
   * GCS object path of the file.
   */
  readonly storagePath: OpenRouterFileStoragePath;
  /**
   * Filename to present to the model. Its extension is what tells OpenRouter how to treat the file.
   */
  readonly filename: string;
  /**
   * Optional bucket override, for a file that does not live in the app's default bucket.
   */
  readonly bucket?: Maybe<string>;
}

/**
 * A cached `file-parser` annotation, as returned on a response and resubmitted on a later request to
 * skip re-parsing the same file.
 *
 * This is the canonical statement of what a re-parse costs, and why caching one is worth a persisted
 * field: under `mistral-ocr` it is $2/1,000 pages, and under any engine it is the latency of reading a
 * document we have already read.
 */
export interface OpenRouterFileAnnotation {
  /**
   * The file hash OpenRouter assigned to the parsed file.
   */
  readonly hash: OpenRouterFileAnnotationHash;
  /**
   * Filename the annotation is for.
   */
  readonly filename?: Maybe<string>;
  /**
   * The parsed content, verbatim as returned.
   */
  readonly content?: Maybe<unknown>;
}

/**
 * Token/cost usage of a run, flattened from OpenRouter's `usage` object.
 */
export interface OpenRouterRunUsage {
  readonly inputTokens?: Maybe<number>;
  readonly outputTokens?: Maybe<number>;
  readonly totalTokens?: Maybe<number>;
  readonly reasoningTokens?: Maybe<number>;
  readonly cachedTokens?: Maybe<number>;
  /**
   * Total cost in USD, as reported by OpenRouter.
   *
   * Finalised server-side, so a value written by the runner may be refined later by the broadcast
   * webhook.
   */
  readonly cost?: Maybe<number>;
  /**
   * Whether the generation ran on a bring-your-own-key upstream credential.
   */
  readonly isByok?: Maybe<boolean>;
}

/**
 * An error recorded on a failed run.
 */
export interface OpenRouterRunError {
  readonly code?: Maybe<string>;
  readonly message?: Maybe<string>;
}
