/**
 * **Call-record readers**: the ONE way to read the prompt, the prompt segments and the failed attempts out of a call
 * row, the one-line retry summary a log line prints, and the decision-row test.
 *
 * Every reader takes `unknown` on purpose: a caller holds a log payload (or an in-memory {@link LlmCallRecord}), not a
 * typed row. Each answers on a persisted payload ({@link LlmCallLogPayload}), on a legacy flat-prompt payload, and on
 * an in-memory record, so no caller needs to know which era — or which side of the recorder — a row is from.
 */

import { cutString, type Maybe } from '@dereekb/util';
import type { LlmStrategyId } from '../model/llm.value';
import { isLlmPromptSegmentArray, joinLlmPromptSegments, type LlmPromptSegment } from '../prompt/llm.prompt.segment';
import { LLM_CALL_EVENT_TYPE, type LlmCallFailedAttempt } from '../record/llm.call.record';

/**
 * Read the PROMPT out of a call row — the ONE way to do it.
 *
 * A row written while the host keeps prompts carries `promptSegments`; a row written before segments existed carries
 * a flat `prompt` string; an in-memory {@link LlmCallRecord} carries both `prompt` and `segments`. All answer here, so
 * no reader needs to know which era a log is from — and, critically, no reader keeps a
 * `typeof payload.prompt === 'string'` gate that would read "no prompt" from a segments-only row and silently report a
 * tape with ZERO turns or a lab with no captured calls.
 *
 * @param payload - The `llm_call` payload or record (or anything).
 * @returns The prompt bytes, or `undefined` when the row carries none (the host kept no prompts).
 *
 * @example
 * ```ts
 * readLlmCallPrompt({ capability: 'summarize', promptSegments }); // the joined segments
 * readLlmCallPrompt({ capability: 'summarize', prompt: 'flat' }); // 'flat'
 * ```
 */
export function readLlmCallPrompt(payload: unknown): Maybe<string> {
  const record = payload as Maybe<Record<string, unknown>>;
  const legacy = record?.['prompt'];
  let prompt: Maybe<string>;

  if (typeof legacy === 'string') {
    prompt = legacy;
  } else {
    const segments = readLlmCallPromptSegments(payload);
    prompt = segments == null ? undefined : joinLlmPromptSegments(segments);
  }

  return prompt;
}

/**
 * Read the prompt SEGMENTS out of a call row: a persisted payload's `promptSegments`, else an in-memory record's
 * `segments`. `undefined` on a legacy (flat-`prompt`) row, which is a real and permanent answer: those bytes have no
 * recoverable breakdown, and a reader that needs one must report drift rather than invent spans.
 *
 * @param payload - The `llm_call` payload or record (or anything).
 * @returns The segments (by reference), or `undefined` when the row carries none.
 *
 * @example
 * ```ts
 * const segments = readLlmCallPromptSegments(payload);
 * const spans = segments == null ? undefined : llmPromptSegmentSpans(segments);
 * ```
 */
export function readLlmCallPromptSegments(payload: unknown): Maybe<ReadonlyArray<LlmPromptSegment>> {
  const record = payload as Maybe<Record<string, unknown>>;
  const persisted = record?.['promptSegments'];
  const inMemory = record?.['segments'];
  let segments: Maybe<ReadonlyArray<LlmPromptSegment>>;

  if (isLlmPromptSegmentArray(persisted)) {
    segments = persisted;
  } else if (isLlmPromptSegmentArray(inMemory)) {
    segments = inMemory;
  }

  return segments;
}

/**
 * Whether one `failedAttempts` element is a well-formed row — the three fields every reader keys on.
 *
 * @param row - One array element off the payload.
 * @returns `true` when it carries a numeric `attempt`, a string `cause`, and a string `text`.
 */
function isLlmCallFailedAttemptRow(row: unknown): row is LlmCallFailedAttempt {
  const record = row as Maybe<Record<string, unknown>>;
  return record != null && typeof record === 'object' && typeof record['attempt'] === 'number' && typeof record['cause'] === 'string' && typeof record['text'] === 'string';
}

/**
 * Read the FAILED attempts out of a call row — the {@link readLlmCallPrompt} neighbour for the replies the retry loop
 * rejected. A log is an open best-effort sink, so a malformed row is dropped rather than trusted. The key is the same
 * on a persisted payload and on an in-memory record.
 *
 * @param payload - The `llm_call` payload or record (or anything).
 * @returns The well-formed rows, or `undefined` when the row carries none (a clean call, a host that keeps no prompts,
 *   or a row written before the attempt rows existed).
 *
 * @example
 * ```ts
 * const rows = readLlmCallFailedAttempts(payload) ?? [];
 * rows.forEach((row) => console.log(row.attempt, row.cause, row.text));
 * ```
 */
export function readLlmCallFailedAttempts(payload: unknown): Maybe<ReadonlyArray<LlmCallFailedAttempt>> {
  const record = payload as Maybe<Record<string, unknown>>;
  const rows = record?.['failedAttempts'];
  const wellFormed = Array.isArray(rows) ? rows.filter(isLlmCallFailedAttemptRow) : [];
  return wellFormed.length === 0 ? undefined : wellFormed;
}

/**
 * The most chars one failed attempt's `error` keeps in the {@link formatLlmCallAttempts} one-line summary.
 */
export const LLM_FAILED_ATTEMPT_SUMMARY_ERROR_MAX_LENGTH = 80;

/**
 * The minimal logged-event shape {@link formatLlmCallAttempts} reads: the event type tag and its payload.
 */
export interface LlmCallLogEvent {
  /**
   * The event type; only {@link LLM_CALL_EVENT_TYPE} is summarized.
   */
  readonly type: string;
  /**
   * The event's payload (a persisted {@link LlmCallLogPayload}, or anything).
   */
  readonly payload?: unknown;
}

/**
 * Config for {@link formatLlmCallAttempts}.
 */
export interface FormatLlmCallAttemptsConfig {
  /**
   * Where to read the full replies, e.g. a log-dump command naming the call. Rendered as ` (<pointer>)` after the
   * failed-attempt parts; absent ⇒ no pointer.
   */
  readonly repliesPointer?: Maybe<string>;
}

/**
 * The ONE one-line summary of a retried / dropped `llm_call` a raw-line log renderer prints — each failed attempt's
 * ordinal, cause, cut error and the lever it bought, plus an optional pointer to where the replies can be read. A
 * dropped call reads as below.
 *
 *   `attempts 2 dropped · #1 schema-validation: summary.title must be … → reasoning-low · #2 parse-error (replies: …)`
 *
 * A row with no attempt rows (the host kept no prompts, or the row was written before the rows existed) says so
 * instead: `attempts 2 retried · 1 failed reply not captured`.
 *
 * An absent `attempts` is read as `1`, so a single-shot call stays silent.
 *
 * @param event - The logged event.
 * @param config - Optional rendering config (the replies pointer).
 * @returns The summary, or `undefined` unless the event is an `llm_call` that retried or dropped — so a clean line
 *   stays byte-identical.
 *
 * @example
 * ```ts
 * const summary = formatLlmCallAttempts(event, { repliesPointer: `replies: dump call ${event.id}` });
 * ```
 */
export function formatLlmCallAttempts(event: LlmCallLogEvent, config?: Maybe<FormatLlmCallAttemptsConfig>): Maybe<string> {
  const payload = event.type === LLM_CALL_EVENT_TYPE && event.payload != null && typeof event.payload === 'object' ? (event.payload as { readonly attempts?: unknown; readonly decodeStatus?: unknown }) : undefined;
  const attempts = typeof payload?.attempts === 'number' ? payload.attempts : 1;
  const dropped = payload?.decodeStatus === 'dropped';
  let summary: Maybe<string>;

  if (payload != null && (attempts > 1 || dropped)) {
    const status = typeof payload.decodeStatus === 'string' ? payload.decodeStatus : 'retried';
    const rows = readLlmCallFailedAttempts(payload);
    const head = `attempts ${attempts} ${status}`;

    if (rows == null) {
      const missing = attempts - (dropped ? 0 : 1);
      summary = `${head} · ${missing} failed ${missing === 1 ? 'reply' : 'replies'} not captured`;
    } else {
      const parts = rows.map((row) => {
        const error = row.error == null ? '' : `: ${cutString(row.error.replaceAll(/\s+/g, ' ').trim(), LLM_FAILED_ATTEMPT_SUMMARY_ERROR_MAX_LENGTH)}`;
        const lever = row.retry == null ? '' : ` → ${row.retry.lever}`;
        return `#${row.attempt} ${row.cause}${error}${lever}`;
      });
      const pointer = config?.repliesPointer == null ? '' : ` (${config.repliesPointer})`;
      summary = `${[head, ...parts].join(' · ')}${pointer}`;
    }
  }

  return summary;
}

/**
 * Whether one recorded `llm_call` is a DECISION-lane row rather than a completion — never a text tape turn.
 *
 * A decision row carries a prompt and a `text` too (its state / questions segments and its JSON answers), so a naive
 * read turns every one into a turn; a text tape would then serve a decision's JSON answer set to whichever completion
 * hashed next. The row is read on BOTH axes: the LANE — `strategyKind` when it is a string, which is what a current row
 * names, else `strategyId` on a row from before the two were split — and the declared `decision` id, which a row
 * written since decisions were recorded carries whatever its lane is called.
 *
 * Unlike `isUncacheableLlmCall`, which reads `strategyKind` only, the lane here falls back to `strategyId`.
 *
 * Build `decisionStrategyKinds` once with `readLlmDecisionStrategyKinds(adapters)`. It can be omitted when every row came
 * from this library's dispatcher, because its decision lane stamps `decision` on every row; the set only matters for
 * rows written before a host recorded decision ids.
 *
 * @param payload - The `llm_call` payload (or anything; a non-object answers `false`).
 * @param decisionStrategyKinds - The decision transports' strategy kinds.
 * @returns `true` for a decision-lane row.
 *
 * @example
 * ```ts
 * const kinds = readLlmDecisionStrategyKinds(adapters);
 * const completions = rows.filter((row) => !isDecisionLlmCallRow(row, kinds));
 * ```
 */
export function isDecisionLlmCallRow(payload: unknown, decisionStrategyKinds?: Maybe<ReadonlySet<LlmStrategyId>>): boolean {
  let result = false;

  if (payload != null && typeof payload === 'object') {
    const record = payload as Readonly<Record<string, unknown>>;
    const kind = record['strategyKind'];
    const lane = typeof kind === 'string' ? kind : record['strategyId'];
    result = (typeof lane === 'string' && decisionStrategyKinds?.has(lane) === true) || typeof record['decision'] === 'string';
  }

  return result;
}
