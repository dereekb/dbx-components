/**
 * Provenance-tagged prompt segments: the pieces a prompt is joined from, each carrying its exact bytes, where they
 * came from, and why they were admitted, plus the helpers that derive the sent string, the provider cache split and
 * the highlight spans from one segment list.
 *
 * The types are open. {@link LlmPromptSegmentId} is a plain string (a host's layout declares its own slot ids) and
 * {@link LlmPromptSegmentOrigin} is any `{ kind }` record (a host declares its own origin arms). A host narrows both
 * by extension, e.g.:
 *
 * ```ts
 * type HostOrigin = { readonly kind: 'template'; readonly templateKey: string } | { readonly kind: 'live-context' };
 * interface HostSegment extends LlmPromptSegment<HostOrigin> {
 *   readonly id: HostSegmentId;
 * }
 * ```
 *
 * Readers treat an origin kind they do not know as opaque, so a new kind never breaks an old reader.
 */

import { type Maybe, type IndexNumber } from '@dereekb/util';

/**
 * The stable→volatile split of an assembled prompt for provider prompt caching — a DERIVED view of the same bytes
 * (computed alongside the prompt, e.g. by {@link splitLlmPromptCacheSegments}). The invariant
 * `cachePrefix + volatileSuffix === prompt` always holds, so a strategy that does not cache can ignore it and read
 * the prompt unchanged.
 */
export interface LlmPromptCacheSegments {
  /**
   * The byte-stable preamble — the part that renders identically across many calls of the same capability. A
   * breakpoint-caching strategy drops its `cache_control` breakpoint at the END of this string; an auto-prefix
   * provider caches it implicitly above its min-token bar. Any timestamp, id or non-deterministic ordering leaking
   * in here silently kills every cache hit.
   */
  readonly cachePrefix: string;
  /**
   * The volatile live context, plus any stable text placed after it — prefix caching cannot cache past the first
   * volatile byte, so stable prose that renders after the live context lands here, not in the cached prefix.
   * Changes every call; never cacheable.
   */
  readonly volatileSuffix: string;
}

/**
 * Which slot of a prompt a segment fills. A host's prompt layout declares its own ids.
 */
export type LlmPromptSegmentId = string;

/**
 * WHERE a segment's bytes came from, discriminated by `kind` (a template, generated contract text, live context,
 * a correction, …).
 *
 * Open: a host (and later library modules) declare their own arms by extension. A reader that meets a kind it does
 * not know treats the origin as opaque rather than rejecting the segment.
 */
export interface LlmPromptSegmentOrigin {
  /**
   * The origin's discriminator.
   */
  readonly kind: string;
}

/**
 * ONE provenance-tagged piece of a prompt — its exact bytes plus what minted them and why.
 *
 * The bytes are the contract: {@link joinLlmPromptSegments} is a plain concatenation, so a segment INCLUDES the
 * separator that joins it to the next one. That is deliberate — it makes the derived spans GAPLESS (every byte of
 * the sent prompt belongs to exactly one segment), which is what a highlighter needs and what a substring-matching
 * reader could never guarantee.
 */
export interface LlmPromptSegment<O extends LlmPromptSegmentOrigin = LlmPromptSegmentOrigin> {
  /**
   * WHICH slot of the prompt this is ({@link LlmPromptSegmentId}).
   */
  readonly id: LlmPromptSegmentId;
  /**
   * A stable identity for diffing the SAME slot across two calls — a template's key, a live-context block key, a
   * model slug. Absent when the slot's id is already its whole identity.
   */
  readonly key?: string;
  /**
   * The EXACT bytes this segment contributes, trailing join separator INCLUDED.
   */
  readonly promptSegment: string;
  /**
   * WHERE the bytes came from ({@link LlmPromptSegmentOrigin}).
   */
  readonly origin: O;
  /**
   * WHY it was admitted — the gate, in one sentence (e.g. `"the capability speaks and the speech block is not
   * blank"`). The half of provenance a type cannot carry: a reader looking at a prompt that is MISSING a layer
   * needs to know what would have admitted it.
   */
  readonly reason?: string;
  /**
   * Whether these bytes change call-to-call (live context, a correction, a follow-up). Everything BEFORE the first
   * volatile segment is the provider cache prefix — see {@link splitLlmPromptCacheSegments}.
   */
  readonly volatile?: boolean;
}

/**
 * One segment plus WHERE its bytes landed in the joined prompt — the derived view a highlighter reads. Spans are
 * always DERIVED ({@link llmPromptSegmentSpans}), never stored: a stored offset is a second representation of the
 * same fact and drifts the moment anything upstream of it changes length.
 */
export interface LlmPromptSegmentSpan<S extends LlmPromptSegment = LlmPromptSegment> {
  /**
   * The segment.
   */
  readonly segment: S;
  /**
   * The offset of {@link LlmPromptSegment.promptSegment} within the joined prompt.
   */
  readonly start: IndexNumber;
  /**
   * The end offset (exclusive).
   */
  readonly end: IndexNumber;
}

/**
 * Join a segment list into the string that is actually sent — a PLAIN concatenation, because every segment already
 * carries its own trailing separator. The ONE place a prompt becomes bytes, so the sent string and the recorded
 * breakdown can never disagree.
 *
 * @param segments - The segments, in send order.
 * @returns The joined prompt.
 */
export function joinLlmPromptSegments(segments: ReadonlyArray<LlmPromptSegment>): string {
  return segments.map((segment) => segment.promptSegment).join('');
}

/**
 * Derive the provider prompt-cache split from a segment list — everything before the FIRST `volatile: true` segment
 * is {@link LlmPromptCacheSegments.cachePrefix}, the rest is the volatile suffix.
 *
 * The split is BY POSITION, not by kind: a stable segment sitting after a volatile one lands in the suffix exactly
 * as it must (prefix caching cannot cache past the first volatile byte), with no special case. The invariant
 * `cachePrefix + volatileSuffix === joinLlmPromptSegments(segments)` holds by construction.
 *
 * @param segments - The segments, in send order.
 * @returns The stable→volatile cache split.
 */
export function splitLlmPromptCacheSegments(segments: ReadonlyArray<LlmPromptSegment>): LlmPromptCacheSegments {
  const firstVolatile = segments.findIndex((segment) => segment.volatile === true);
  const boundary = firstVolatile < 0 ? segments.length : firstVolatile;
  return { cachePrefix: joinLlmPromptSegments(segments.slice(0, boundary)), volatileSuffix: joinLlmPromptSegments(segments.slice(boundary)) };
}

/**
 * Derive each segment's span in the joined prompt — cumulative offsets over the segment bytes. GAPLESS by
 * construction (a segment carries its own separator), so the spans partition every byte of the prompt.
 *
 * Generic over the segment type, so a host that narrowed {@link LlmPromptSegment} keeps its own type on each span.
 *
 * @param segments - The segments, in send order.
 * @returns One span per segment, in the same order.
 */
export function llmPromptSegmentSpans<S extends LlmPromptSegment>(segments: ReadonlyArray<S>): ReadonlyArray<LlmPromptSegmentSpan<S>> {
  const spans: LlmPromptSegmentSpan<S>[] = [];
  let cursor = 0;

  for (const segment of segments) {
    const end = cursor + segment.promptSegment.length;
    spans.push({ segment, start: cursor, end });
    cursor = end;
  }

  return spans;
}

/**
 * Whether an untyped value is an {@link LlmPromptSegment} — the guard a reader of a PERSISTED payload needs (a log
 * record is `unknown`, and a record written before segments existed carries none).
 *
 * Deliberately structural and shallow: it checks the fields every reader dereferences (a string `id`, the
 * `promptSegment` bytes and an `origin.kind`), not the origin's arm. A payload that passes is safe to join and safe
 * to render; validating the arm would only turn a forward-compatible new origin kind into a rejected record.
 *
 * @param value - The untyped value.
 * @returns Whether it is shaped like a prompt segment.
 */
export function isLlmPromptSegment(value: unknown): value is LlmPromptSegment {
  const candidate = value as Maybe<Partial<LlmPromptSegment>>;
  return candidate != null && typeof candidate === 'object' && typeof candidate.id === 'string' && typeof candidate.promptSegment === 'string' && typeof (candidate.origin as Maybe<{ readonly kind?: unknown }>)?.kind === 'string';
}

/**
 * Whether an untyped value is a non-empty ARRAY of {@link LlmPromptSegment}s — the persisted segment-list shape.
 * Empty is rejected: a record with zero segments carries no prompt, and treating it as one would make a reader
 * answer `''` (a silent "the prompt was empty") where it must answer "unknown".
 *
 * @param value - The untyped value.
 * @returns Whether it is a non-empty prompt-segment array.
 */
export function isLlmPromptSegmentArray(value: unknown): value is ReadonlyArray<LlmPromptSegment> {
  return Array.isArray(value) && value.length > 0 && value.every(isLlmPromptSegment);
}
