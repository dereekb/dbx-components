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
 * The path is stored, NOT a signed URL: a run task can sit queued for a sweep interval, be retried,
 * and (with deferred tools) resume much later, so a URL minted at enqueue time would 403 by the time
 * it was used. The runner signs the path fresh on every attempt instead.
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
 * Worth persisting: under `mistral-ocr` a re-parse costs $2/1,000 pages, and under any engine it
 * costs the latency of parsing a document we have already parsed.
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
