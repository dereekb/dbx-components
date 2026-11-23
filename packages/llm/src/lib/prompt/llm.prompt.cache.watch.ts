/**
 * The prompt-cache PREFIX WATCH — the one place a dispatch's cacheable prefix is hashed and compared with the previous
 * dispatch's for the same (capability, partition).
 *
 * A provider reports how many prompt tokens it served from cache, but nothing says WHEN the bytes it could have cached
 * actually moved, so a cache-read drop can be seen and never attributed. The watch closes that: every root dispatch
 * gets its prefix hash (a host stamps it on the call record), and a CHANGE between two consecutive dispatches of the
 * same partition names the first segment whose bytes differ.
 *
 * The comparison is per (capability, partition) because that pair is what a provider's prefix cache keys on in
 * practice: two partitions of one capability (two users, two documents) carry different template and context bytes and
 * are separate cache lines. Folding them would report a change on every alternation and say nothing.
 *
 * Only segment DIGESTS are retained, never the bytes — a watch runs for a whole session without holding every prompt
 * it has seen.
 *
 * The hash is {@link llmPromptCacheHash} — pure JS, browser-safe and equal to a `node:crypto` SHA-256 prefix, so a
 * `node:crypto` hash computed elsewhere compares directly.
 *
 * No log, no telemetry, no environment reads: the dispatcher owns emitting the breadcrumb, the watch owns deciding
 * there is one.
 */

import { type HexString, LimitedMap, type Maybe } from '@dereekb/util';
import { type LlmCapabilityKey } from '../model/llm.value';
import { llmPromptCacheHash } from './llm.prompt.hash';
import { joinLlmPromptSegments, type LlmPromptSegment, type LlmPromptSegmentId } from './llm.prompt.segment';

/**
 * ONE retained prefix segment — its id, the digest of its bytes and its diffing key. Not to be confused with
 * `LlmPromptCacheSegments` (the cacheable / volatile split of one prompt's bytes).
 */
export interface LlmPromptCacheSegmentDigest {
  /**
   * The segment's id.
   */
  readonly id: LlmPromptSegmentId;
  /**
   * The {@link llmPromptCacheHash} of its bytes.
   */
  readonly hash: HexString;
  /**
   * The segment's diffing key, when it has one.
   */
  readonly key?: string | undefined;
}

/**
 * What one {@link LlmPromptCachePrefixWatch.observe} saw.
 */
export interface LlmPromptCachePrefixObservation {
  /**
   * The observed capability.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The partition, echoed when the dispatch named one.
   */
  readonly partition?: string | number;
  /**
   * The cacheable prefix's hash — always present; a host stamps it on the call record.
   */
  readonly hash: HexString;
  /**
   * The cacheable prefix's length in characters.
   */
  readonly prefixChars: number;
  /**
   * The previous dispatch's prefix hash for the same (capability, partition); absent on the first dispatch of a
   * partition.
   */
  readonly previousHash?: HexString;
  /**
   * Whether a previous dispatch was seen AND its prefix hash differs. Decided on the joined bytes — a relabel that
   * moves no byte is not a change.
   */
  readonly changed: boolean;
  /**
   * When {@link changed}: the first segment whose id or bytes differ — or, when the prefix only shrank, its first
   * dropped segment.
   */
  readonly firstDifferingSegmentId?: LlmPromptSegmentId;
  /**
   * The key of {@link firstDifferingSegmentId}'s segment, when it has one (which live block moved).
   */
  readonly firstDifferingSegmentKey?: string;
  /**
   * When {@link changed} and the prefix only GREW: the first appended segment.
   */
  readonly appendedSegmentId?: LlmPromptSegmentId;
}

/**
 * Params for {@link LlmPromptCachePrefixWatch.observe}.
 */
export interface LlmPromptCachePrefixObserveParams {
  /**
   * The dispatched capability.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * WHOSE prompt this is — a host's user / document / agent id; nullish ⇒ the capability's one shared partition. A
   * number and its decimal string name the same partition.
   */
  readonly partition?: Maybe<string | number>;
  /**
   * The dispatch's assembled segments, in send order — the cacheable half is derived here by
   * the same split as `splitLlmPromptCacheSegments`, so it never disagrees with the bytes the transport splits on.
   */
  readonly segments: ReadonlyArray<LlmPromptSegment>;
}

/**
 * The prefix watch — a per-(capability, partition) baseline table. One watch per dispatcher by default, or one SHARED
 * across dispatchers by a host that mints one per workspace.
 */
export interface LlmPromptCachePrefixWatch {
  /**
   * Hash a dispatch's cacheable prefix, compare it with the partition's baseline, and REPLACE the baseline.
   *
   * @param params - The capability, the partition and the assembled segments.
   * @returns What changed, if anything.
   */
  observe(params: LlmPromptCachePrefixObserveParams): LlmPromptCachePrefixObservation;
  /**
   * Clear every baseline.
   */
  reset(): void;
}

/**
 * The watch's per-partition key — the capability and the partition with a NUL between them, so no pair is spelled two
 * ways.
 *
 * @param capability - The capability.
 * @param partition - The partition, when named.
 * @returns The map key.
 */
function partitionKey(capability: LlmCapabilityKey, partition: Maybe<string | number>): string {
  return `${capability}\u0000${partition ?? ''}`;
}

/**
 * Digest each segment of a prefix — the retained baseline.
 *
 * @param segments - The prefix segments, in send order.
 * @returns One digest per segment.
 */
function digestSegments(segments: ReadonlyArray<LlmPromptSegment>): ReadonlyArray<LlmPromptCacheSegmentDigest> {
  return segments.map((segment) => ({ id: segment.id, hash: llmPromptCacheHash(segment.promptSegment), key: segment.key }));
}

/**
 * The SEGMENTS of a dispatch's cacheable prefix — everything before the first `volatile` segment (all of them when
 * none is), the same split `splitLlmPromptCacheSegments` derives its joined `cachePrefix` from. The watch needs
 * the segments themselves so it can name the one that moved.
 *
 * @param segments - The dispatch's segments, in send order.
 * @returns The stable prefix segments.
 *
 * @typeParam S - The segment type.
 *
 * @example
 * ```ts
 * const prefix = llmPromptCachePrefixSegments(composed.segments);
 * joinLlmPromptSegments(prefix) === splitLlmPromptCacheSegments(composed.segments).cachePrefix; // true
 * ```
 */
export function llmPromptCachePrefixSegments<S extends LlmPromptSegment>(segments: ReadonlyArray<S>): ReadonlyArray<S> {
  const firstVolatile = segments.findIndex((segment) => segment.volatile === true);
  return firstVolatile < 0 ? segments : segments.slice(0, firstVolatile);
}

/**
 * The difference fields of a changed observation.
 */
type LlmPromptCachePrefixDifference = Pick<LlmPromptCachePrefixObservation, 'firstDifferingSegmentId' | 'firstDifferingSegmentKey' | 'appendedSegmentId'>;

/**
 * Locate the first segment that differs between a previous prefix and the current one — by id (a reordered or
 * replaced slot) or by bytes (the same slot, rewritten). A prefix that only SHRANK names its first dropped segment; one
 * that matches position for position and only GREW names its first appended segment instead.
 *
 * @param previous - The previous dispatch's segment digests.
 * @param current - This dispatch's segment digests.
 * @returns The differing / appended segment, whichever applies.
 */
function firstDifference(previous: ReadonlyArray<LlmPromptCacheSegmentDigest>, current: ReadonlyArray<LlmPromptCacheSegmentDigest>): LlmPromptCachePrefixDifference {
  const shared = Math.min(previous.length, current.length);
  let differing: Maybe<LlmPromptCacheSegmentDigest>;

  for (let index = 0; index < shared && differing == null; index += 1) {
    const before = previous[index];
    const after = current[index];

    if (before.id !== after.id || before.hash !== after.hash) {
      differing = after;
    }
  }

  const dropped = differing == null && current.length < previous.length ? previous[current.length] : undefined;
  const appended = differing == null && dropped == null && current.length > previous.length ? current[previous.length].id : undefined;
  const named = differing ?? dropped;
  return { ...(named == null ? {} : { firstDifferingSegmentId: named.id }), ...(named?.key == null ? {} : { firstDifferingSegmentKey: named.key }), ...(appended == null ? {} : { appendedSegmentId: appended }) };
}

/**
 * The most (capability, partition) baselines a {@link makeLlmPromptCachePrefixWatch} watch keeps by default.
 */
export const DEFAULT_LLM_PROMPT_CACHE_PREFIX_WATCH_MAX_PARTITIONS = 1000;

/**
 * Configuration for {@link makeLlmPromptCachePrefixWatch}.
 */
export interface LlmPromptCachePrefixWatchConfig {
  /**
   * The most (capability, partition) baselines the watch keeps. Past it the least-recently-observed baseline is
   * dropped, so a host that partitions by user id holds a bounded table on a long-lived server. A dropped partition
   * seen again is observed as its FIRST dispatch: no `previousHash` and never `changed` — its prefix hash is still
   * computed, returned and recorded as the new baseline. Must be a positive integer. Defaults to
   * {@link DEFAULT_LLM_PROMPT_CACHE_PREFIX_WATCH_MAX_PARTITIONS}.
   */
  readonly maxPartitions?: Maybe<number>;
}

/**
 * Mint a {@link LlmPromptCachePrefixWatch} — an empty per-(capability, partition) baseline table, holding at most
 * `maxPartitions` baselines (least-recently-observed dropped first).
 *
 * @param config - The partition cap.
 * @returns The watch.
 * @throws {RangeError} When `maxPartitions` is not a positive integer.
 *
 * @example
 * ```ts
 * const watch = makeLlmPromptCachePrefixWatch();
 * const observation = watch.observe({ capability: 'summarize', partition: userId, segments: composed.segments });
 * if (observation.changed) log.debug('prefix changed', observation);
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmPromptCachePrefixWatch(config?: Maybe<LlmPromptCachePrefixWatchConfig>): LlmPromptCachePrefixWatch {
  // 'recent': observe() re-sets the partition's baseline, so an active partition stays and an idle one is dropped first
  const baselines = new LimitedMap<string, { readonly hash: HexString; readonly digests: ReadonlyArray<LlmPromptCacheSegmentDigest> }>({ limit: config?.maxPartitions ?? DEFAULT_LLM_PROMPT_CACHE_PREFIX_WATCH_MAX_PARTITIONS, order: 'recent' });

  return {
    observe(params: LlmPromptCachePrefixObserveParams): LlmPromptCachePrefixObservation {
      const { capability, partition, segments } = params;
      const prefixSegments = llmPromptCachePrefixSegments(segments);
      // joined ONCE: the same bytes `splitLlmPromptCacheSegments(segments).cachePrefix` holds, without re-scanning for
      // the boundary or joining the volatile suffix; its length is `prefixChars`
      const cachePrefix = joinLlmPromptSegments(prefixSegments);
      const hash = llmPromptCacheHash(cachePrefix);
      const digests = digestSegments(prefixSegments);
      const key = partitionKey(capability, partition);
      const previous = baselines.get(key);
      baselines.set(key, { hash, digests });

      const changed = previous != null && previous.hash !== hash;
      const difference = changed ? firstDifference(previous.digests, digests) : {};
      return {
        capability,
        ...(partition == null ? {} : { partition }),
        hash,
        prefixChars: cachePrefix.length,
        ...(previous == null ? {} : { previousHash: previous.hash }),
        changed,
        ...difference
      };
    },
    reset(): void {
      baselines.clear();
    }
  };
}
