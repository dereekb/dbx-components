/**
 * The **dispatch tap seam** — an explicitly NON-MUTATING registry a benchmark, a live debug feed or a probe attaches
 * to so it can watch EVERY LLM call — each capability dispatch and each decision (send, reply, and each failed decode
 * attempt) — from outside the dispatcher. A decision fires `onDispatch` / `onDispatchComplete` and never
 * `onDecodeFailure`; `event.decision != null` tells a decision apart on both events.
 * {@link LlmDispatchTapRegistry.addTap} returns an IDEMPOTENT cleanup, so a probe detaches cleanly and a double-detach
 * is a no-op. {@link makeLlmDispatchCollector} is the reference accumulate-everything tap.
 *
 * **The shape rule.** The object handed to a tap IS the record handed to the host's log: each tap event is the
 * corresponding record ({@link LlmCallStartRecordBase} / {@link LlmCallRecordBase}) plus tap-only fields — never a
 * re-declared, renamed, reshaped or re-projected copy. A dispatcher builds ONE record object per seam and hands the
 * SAME object to both its recorder and the taps, so the compiler makes drift impossible. There is exactly one
 * projector of the result telemetry block — `llmCallTelemetry` — and a tap that wants that block calls it on the
 * `result` it was handed. Every event carries the host's top-level fields `H` too.
 *
 * **The six invariants this seam holds:**
 *
 * 1. **Read-only.** No callback return value is ever consulted. The mutable-control half of other hook systems
 *    (cancel, retry, rewrite the request or the result) is DELIBERATELY not offered: the one legitimate mutation —
 *    retry with feedback — is already the dispatcher's validate-and-retry loop. A mutation need should be argued for on
 *    its own merits, not smuggled in through an observation seam.
 * 2. **Never breaks a dispatch.** Every callback invocation is wrapped; a synchronous throw AND an async rejection are
 *    swallowed and TALLIED in {@link LlmDispatchTapRegistry.health}, so a broken probe is VISIBLE rather than silent
 *    (sites `llm/dispatch-taps.sync-throw` and `llm/dispatch-taps.async-reject`). A throwing tap also cannot abort the
 *    fan-out to the other taps.
 * 3. **Never feeds the work it observes.** Nothing a tap does reaches the request, the reply or what the host
 *    records.
 * 4. **No ambient state.** Registration is against a registry INSTANCE threaded explicitly into each dispatcher — no
 *    async-local storage, no module global — so two concurrent harnesses cannot cross-talk.
 * 5. **Byte-identical with no taps.** A dispatcher fires only when `taps.size > 0`, so a registry-less (or
 *    empty-registry) dispatch allocates no tap event and runs no callback.
 * 6. **Taps never alter the log.** Registering a tap changes NO recorded event. The tap-only fields
 *    ({@link LlmDispatchStartTapEventBase.estimatedPromptTokens}, `followUp`, …) ride the tap event ONLY.
 */

import { readErrorMessage, isPromiseLike, type Maybe, type Count, type DestroyFunction } from '@dereekb/util';
import type { LlmCapabilityKey, LlmModelTierKey, LlmTokenCount } from '../model/llm.value';
import type { LlmCallHostFields, LlmCallRecordBase, LlmCallStartRecordBase } from './llm.call.record';
import type { LlmDecodeFailureAttempt } from './llm.decode.failure';
import { type LlmDecisionKey } from '../decision/llm.decision.question';

/**
 * A dispatch-tap id — the probe handle an {@link LlmDispatchTap} registers under, so
 * {@link LlmDispatchTapHealth.byTap} can NAME which probe threw. Registration itself is identity-keyed (a `Set`), so
 * an id collision between two taps is harmless.
 */
export type LlmDispatchTapId = string;

/**
 * The library's fields of the send-time tap event — the SAME {@link LlmCallStartRecordBase} the start record is built
 * from, plus the send-time facts the log deliberately does not carry.
 */
export interface LlmDispatchStartTapEventBase extends LlmCallStartRecordBase {
  /**
   * The prompt this call newly sends — the fully assembled prompt on a root dispatch, the follow-up message on a
   * chained turn (its replayed history rides `LlmRequest.thread`), a decision's state and questions JSON.
   */
  readonly prompt: string;
  /**
   * A cheap token estimate of {@link prompt}. Tap-only: the start record never carries it, so attaching a probe
   * provably changes zero bytes of the log.
   */
  readonly estimatedPromptTokens: LlmTokenCount;
  /**
   * `true` on a CHAINED follow-up execution; omitted on a root dispatch.
   */
  readonly followUp?: true;
  /**
   * The declared decision key, on a DECISION send; omitted on a capability dispatch. Tap-only: it mirrors the call
   * record's `decision` (which the completion event already carries), so `event.decision != null` identifies a
   * decision on both events while the start record stays unchanged.
   */
  readonly decision?: LlmDecisionKey;
}

/**
 * Fired the instant a request is about to be sent — BEFORE `strategy.complete` / `strategy.decide`.
 */
export type LlmDispatchStartTapEvent<H extends LlmCallHostFields = LlmCallHostFields> = LlmDispatchStartTapEventBase & H;

/**
 * The library's fields of the completion tap event — the SAME {@link LlmCallRecordBase} the host's recorder receives,
 * plus this dispatch's retry outcome.
 */
export interface LlmDispatchCompleteTapEventBase extends LlmCallRecordBase {
  /**
   * `true` on a CHAINED follow-up execution; omitted on a root dispatch.
   */
  readonly followUp?: true;
  /**
   * The per-attempt decode failures this dispatch collected — the SAME array that lands in the decode-failure
   * payload's `failures`. Omitted entirely when there were none (the common path).
   */
  readonly decodeFailures?: ReadonlyArray<LlmDecodeFailureAttempt>;
  /**
   * Whether a LATER attempt recovered after ≥1 decode failure. Omitted when there were none.
   */
  readonly recovered?: boolean;
}

/**
 * Fired on the reply — the call record plus the retry outcome.
 */
export type LlmDispatchCompleteTapEvent<H extends LlmCallHostFields = LlmCallHostFields> = LlmDispatchCompleteTapEventBase & H;

/**
 * The library's fields of the failed-decode-attempt tap event.
 *
 * **Known, deliberate asymmetry:** an INTERMEDIATE schema-validation failure (with attempts left) and a critic
 * rejection mint no {@link LlmDecodeFailureAttempt} — only a `validationErrors` entry — so no `onDecodeFailure` fires
 * for them; pushing one would change the recorded decode-failure payload. A probe reads EVERY rejected attempt, those
 * included, on the complete event's `failedAttempts`.
 */
export interface LlmDecodeFailureTapEventBase {
  /**
   * The capability whose dispatch failed to decode.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The resolved model-tier KEY this dispatch routed to; absent for a raw-slug override.
   */
  readonly tier?: LlmModelTierKey;
  /**
   * The attempt diagnostic — the SAME element that lands in the decode-failure payload's `failures`.
   */
  readonly attempt: LlmDecodeFailureAttempt;
  /**
   * Whether the dispatcher will issue ANOTHER attempt after this failure (`false` on an exhausted budget, a final
   * schema-invalid attempt, or an external cancellation).
   */
  readonly willRetry: boolean;
}

/**
 * Fired per FAILED decode attempt, BEFORE the retry is issued — the live view of the retry loop the aggregated
 * end-of-dispatch decode-failure record cannot give (it only lands once, after the last attempt).
 */
export type LlmDecodeFailureTapEvent<H extends LlmCallHostFields = LlmCallHostFields> = LlmDecodeFailureTapEventBase & H;

/**
 * A registered probe. EVERY callback is optional and STRICTLY READ-ONLY — a return value is ignored, and nothing a
 * callback does can change the request, the reply, or the recorded events.
 *
 * A callback may be async (it may return any thenable, not only a native `Promise`); both a synchronous throw and a
 * rejection are swallowed and counted. A tap runs INLINE on the dispatch path, so a tap doing real work should be async or queue — the registry
 * does not enforce a budget, a probe owns its own cost.
 */
export interface LlmDispatchTap<H extends LlmCallHostFields = LlmCallHostFields> {
  /**
   * The probe handle this tap is attributed under in {@link LlmDispatchTapHealth.byTap}.
   */
  readonly id: LlmDispatchTapId;
  /**
   * Observe a request about to be SENT (before `strategy.complete` / `strategy.decide`).
   *
   * @param event - The send-time event.
   */
  onDispatch?(event: LlmDispatchStartTapEvent<H>): void | PromiseLike<void>;
  /**
   * Observe a completed dispatch (the reply + the retry outcome).
   *
   * @param event - The completion event.
   */
  onDispatchComplete?(event: LlmDispatchCompleteTapEvent<H>): void | PromiseLike<void>;
  /**
   * Observe one FAILED decode attempt, before the retry is issued. Never fired by a decision.
   *
   * @param event - The failed-attempt event.
   */
  onDecodeFailure?(event: LlmDecodeFailureTapEvent<H>): void | PromiseLike<void>;
}

/**
 * The registry's swallowed-throw tally — `failures: 0` is clean, with a per-probe breakdown so a broken tap is NAMED
 * rather than merely counted.
 */
export interface LlmDispatchTapHealth {
  /**
   * How many taps are currently attached.
   */
  readonly taps: Count;
  /**
   * How many callback invocations threw / rejected (and were swallowed) over this registry's lifetime.
   */
  readonly failures: Count;
  /**
   * The message of the most recent swallowed failure. Omitted when nothing has failed.
   */
  readonly lastError?: string;
  /**
   * The swallowed-failure count per {@link LlmDispatchTap.id} — a key appears only once that probe has failed at least
   * once, so an all-clean registry reports `{}`.
   */
  readonly byTap: Readonly<Partial<Record<LlmDispatchTapId, Count>>>;
}

/**
 * The tap registry — the ONE registration handle, threaded into every dispatcher a host mints (a dispatcher may be
 * minted per call and cannot be held, so the registry is what outlives it).
 */
export interface LlmDispatchTapRegistry<H extends LlmCallHostFields = LlmCallHostFields> {
  /**
   * The live tap count — a dispatcher's `> 0` guard, so a tap-less dispatch allocates nothing and an EMPTY registry is
   * indistinguishable from no registry at all.
   */
  readonly size: Count;
  /**
   * Attach a tap.
   *
   * @param tap - The probe to attach (identity-keyed: attaching the same object twice counts once).
   * @returns The detach. IDEMPOTENT: a second call is a no-op, and (because the detach closes over its own `detached`
   * flag) a stale detach can never remove a LATER re-registration of the same tap object.
   */
  addTap(tap: LlmDispatchTap<H>): DestroyFunction;
  /**
   * The current swallowed-throw tally.
   *
   * @returns The registry health.
   */
  health(): LlmDispatchTapHealth;
  /**
   * Fan a send-time event to every tap declaring `onDispatch`. NEVER throws.
   *
   * @param event - The send-time event.
   */
  emitDispatch(event: LlmDispatchStartTapEvent<H>): void;
  /**
   * Fan a completion event to every tap declaring `onDispatchComplete`. NEVER throws.
   *
   * @param event - The completion event.
   */
  emitDispatchComplete(event: LlmDispatchCompleteTapEvent<H>): void;
  /**
   * Fan a failed-decode-attempt event to every tap declaring `onDecodeFailure`. NEVER throws.
   *
   * @param event - The failed-attempt event.
   */
  emitDecodeFailure(event: LlmDecodeFailureTapEvent<H>): void;
}

/**
 * Build an {@link LlmDispatchTapRegistry} — a `Set` of taps (O(1) detach, identity dedupe, iterated LIVE so a tap that
 * detaches itself mid-fan-out is simply skipped) plus the swallow-and-count tally.
 *
 * @returns The registry.
 *
 * @example
 * ```ts
 * const taps = makeLlmDispatchTapRegistry<AppCallHostFields>();
 * const detach = taps.addTap({ id: 'debug-feed', onDispatchComplete: (event) => feed.push(llmCallTelemetry(event.result)) });
 * ```
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmDispatchTapRegistry<H extends LlmCallHostFields = LlmCallHostFields>(): LlmDispatchTapRegistry<H> {
  const taps = new Set<LlmDispatchTap<H>>();
  const byTap: Record<string, Count> = {};
  let failures = 0;
  let lastError: Maybe<string>;

  // Swallow-AND-count: a broken probe stays attached and visible rather than being silently auto-detached, and
  // NOTHING is written to the console — `health()` is the entire surface.
  const tally = (tap: LlmDispatchTap<H>, error: unknown): void => {
    failures += 1;
    lastError = readErrorMessage(error);
    byTap[tap.id] = (byTap[tap.id] ?? 0) + 1;
  };

  // One tap, one callback — a sync throw is caught here (`llm/dispatch-taps.sync-throw`), an async rejection through
  // the attached rejection handler (`llm/dispatch-taps.async-reject`), so neither can abort the fan-out to the remaining
  // taps nor reach the dispatcher. Any thenable counts, not only a native Promise (a bare thenable has no `.catch`).
  const deliver = (tap: LlmDispatchTap<H>, run: () => void | PromiseLike<void>): void => {
    try {
      const result = run();

      if (isPromiseLike(result)) {
        result.then(undefined, (error: unknown) => tally(tap, error));
      }
    } catch (error) {
      tally(tap, error);
    }
  };

  // The shared fan-out: pick this seam's callback off each live tap, skip the taps that do not declare it, and route
  // the rest through `deliver`.
  const fanOut = <E>(event: E, callbackOf: (tap: LlmDispatchTap<H>) => Maybe<(event: E) => void | PromiseLike<void>>): void => {
    for (const tap of taps) {
      const callback = callbackOf(tap);

      if (callback != null) {
        deliver(tap, () => callback.call(tap, event));
      }
    }
  };

  return {
    get size(): Count {
      return taps.size;
    },
    addTap(tap: LlmDispatchTap<H>): DestroyFunction {
      // The `detached` flag is what makes a double-detach SAFE rather than merely idempotent: a stale cleanup cannot
      // silently remove a later re-registration of the same tap object.
      let detached = false;
      taps.add(tap);

      return () => {
        if (!detached) {
          detached = true;
          taps.delete(tap);
        }
      };
    },
    health(): LlmDispatchTapHealth {
      return { taps: taps.size, failures, ...(lastError == null ? {} : { lastError }), byTap: { ...byTap } };
    },
    emitDispatch(event: LlmDispatchStartTapEvent<H>): void {
      fanOut(event, (tap) => tap.onDispatch);
    },
    emitDispatchComplete(event: LlmDispatchCompleteTapEvent<H>): void {
      fanOut(event, (tap) => tap.onDispatchComplete);
    },
    emitDecodeFailure(event: LlmDecodeFailureTapEvent<H>): void {
      fanOut(event, (tap) => tap.onDecodeFailure);
    }
  };
}

/**
 * The default {@link LlmDispatchTap.id} a collector registers under.
 */
export const DEFAULT_LLM_DISPATCH_COLLECTOR_ID: LlmDispatchTapId = 'collector';

/**
 * An accumulating dispatch tap plus the read accessors over what it collected.
 */
export interface LlmDispatchCollector<H extends LlmCallHostFields = LlmCallHostFields> {
  /**
   * The tap to hand {@link LlmDispatchTapRegistry.addTap}.
   */
  readonly tap: LlmDispatchTap<H>;
  /**
   * Every send-time event seen so far, in order.
   *
   * @returns The collected send-time events.
   */
  dispatches(): ReadonlyArray<LlmDispatchStartTapEvent<H>>;
  /**
   * Every completion event seen so far, in order.
   *
   * @returns The collected completion events.
   */
  completions(): ReadonlyArray<LlmDispatchCompleteTapEvent<H>>;
  /**
   * Every failed-decode-attempt event seen so far, in order.
   *
   * @returns The collected decode-failure events.
   */
  decodeFailures(): ReadonlyArray<LlmDecodeFailureTapEvent<H>>;
  /**
   * Drop everything collected so far (the between-phases retention control).
   */
  reset(): void;
}

/**
 * Config for {@link makeLlmDispatchCollector}.
 */
export interface LlmDispatchCollectorConfig {
  /**
   * The id the collector's tap registers under; defaults to {@link DEFAULT_LLM_DISPATCH_COLLECTOR_ID}.
   */
  readonly id?: LlmDispatchTapId;
}

/**
 * Build an {@link LlmDispatchCollector} — the reference tap that simply keeps every event it is handed, so a benchmark
 * or debug probe gets a one-line instrument instead of re-writing the same three arrays per probe.
 *
 * Retention is UNBOUNDED by design — a probe owns its own retention policy; call {@link LlmDispatchCollector.reset}
 * between phases. Read-only like every tap: it stores the events it is handed and does nothing else.
 *
 * @param config - The optional tap id override.
 * @returns The collector.
 *
 * @example
 * ```ts
 * const collector = makeLlmDispatchCollector();
 * const detach = taps.addTap(collector.tap);
 * ```
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmDispatchCollector<H extends LlmCallHostFields = LlmCallHostFields>(config: LlmDispatchCollectorConfig = {}): LlmDispatchCollector<H> {
  const id = config.id ?? DEFAULT_LLM_DISPATCH_COLLECTOR_ID;
  let dispatches: LlmDispatchStartTapEvent<H>[] = [];
  let completions: LlmDispatchCompleteTapEvent<H>[] = [];
  let decodeFailures: LlmDecodeFailureTapEvent<H>[] = [];

  return {
    tap: {
      id,
      onDispatch(event: LlmDispatchStartTapEvent<H>): void {
        dispatches.push(event);
      },
      onDispatchComplete(event: LlmDispatchCompleteTapEvent<H>): void {
        completions.push(event);
      },
      onDecodeFailure(event: LlmDecodeFailureTapEvent<H>): void {
        decodeFailures.push(event);
      }
    },
    dispatches(): ReadonlyArray<LlmDispatchStartTapEvent<H>> {
      return dispatches;
    },
    completions(): ReadonlyArray<LlmDispatchCompleteTapEvent<H>> {
      return completions;
    },
    decodeFailures(): ReadonlyArray<LlmDecodeFailureTapEvent<H>> {
      return decodeFailures;
    },
    reset(): void {
      dispatches = [];
      completions = [];
      decodeFailures = [];
    }
  };
}
