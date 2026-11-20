/**
 * The **swallow vocabulary**: a swallow is a DECLARED `catch` that keeps a never-throw guarantee — an observer that
 * must never break the work it observes, a probe that must report rather than throw. Each one is declared once as an
 * {@link LlmSwallowSiteDeclaration} (the reasoning that would otherwise live only in a comment, moved into fields)
 * and, where a sink reaches it, reported through an {@link LlmSwallowSink} when it fires.
 *
 * Site ids are `<area>/<module>.<reason>`, kebab-case; the library's area is `llm`. {@link LLM_SWALLOW_SITES} lists
 * every swallow whose code is in this library, so a host merges them into its own registry with
 * {@link makeLlmSwallowSiteRegistry} and passes its own sinks straight in: the types are plain structural shapes, so
 * a host's own registry and sink types fit without adapters.
 *
 * What a host does with a fired swallow (a tally, a leveled breadcrumb, a warning) is the host log's job; the library
 * only names the site and forwards the cause.
 */

import { arrayToObject, readErrorMessage, type Maybe } from '@dereekb/util';

/**
 * A declared swallow site's stable id — `<area>/<module>.<reason>`, kebab-case throughout (e.g.
 * `llm/dispatch-taps.sync-throw`).
 */
export type LlmSwallowSiteId = string;

/**
 * The shape every {@link LlmSwallowSiteId} must match — `<area>/<module>.<reason>`, kebab-case throughout.
 */
export const LLM_SWALLOW_SITE_ID_PATTERN = /^[a-z0-9-]+\/[a-z0-9-]+\.[a-z0-9-]+$/;

/**
 * The declared fail-open / fail-closed policy at a swallow site.
 *
 * - `proceed` — continue as if the failed work had not been attempted; NOTHING degrades for the caller (an observer
 *   notify, a best-effort stamp).
 * - `degrade` — continue on a DOCUMENTED lesser path (a raw error body instead of a parsed one, a deterministic
 *   fallback instead of the LLM answer).
 * - `report` — the failure becomes the return value and the caller decides. NOT a swallow (the failure IS visible);
 *   declared so a registry can cover a whole module without holes.
 * - `throw` — declared for a seam that deliberately does NOT swallow, so a reader can see the choice was made rather
 *   than missed.
 */
export type LlmSwallowPolicy = 'proceed' | 'degrade' | 'report' | 'throw';

/**
 * How SURPRISING a firing is — the field that keeps a host's report usable (a host typically maps it to a log level,
 * so a default run shows only the rows a human should look at).
 *
 * - `expected` — fires on every run of a given configuration: a keyless run's fallback, an absent optional input.
 * - `degraded` — an LLM / transport / timeout failure taking a documented fallback.
 * - `fault` — deterministic in-process code threw and should not have. A run carrying one of these is a bug report.
 */
export type LlmSwallowExpectation = 'expected' | 'degraded' | 'fault';

/**
 * Which surface carries the occurrence, so a registry doubles as the audit table.
 *
 * - `diag` — the site calls an {@link LlmSwallowSink}; its ONLY surface is the breadcrumb a host writes for it.
 * - `gap` / `event` — a recorded gap or a dedicated event carries it.
 * - `result` — the return value carries it.
 * - `health` — a verdict or a health counter carries it.
 * - `warn` — a direct warning carries it.
 * - `none` — no reachable surface at all (a terminal catch, or a pure helper called without a sink). Legal ONLY with
 *   a {@link LlmSwallowSiteDeclaration.why}: it is the explicit admission that this one is declared but not counted.
 *
 * When a site reaches MORE than one surface, declare the highest tier an operator reads — `channel` answers "where
 * would somebody see this?", not how it gets there.
 */
export type LlmSwallowChannel = 'diag' | 'gap' | 'event' | 'result' | 'health' | 'warn' | 'none';

/**
 * One declared swallow site — the reasoning that used to live only in a comment, moved into fields.
 */
export interface LlmSwallowSiteDeclaration {
  /**
   * The site's stable id; equals its key in the owning {@link LlmSwallowSiteRegistry}.
   */
  readonly id: LlmSwallowSiteId;
  /**
   * The never-throw guarantee this catch defends, in one lowercase clause — "an observer must never break the work
   * that notified it".
   */
  readonly protects: string;
  /**
   * The declared fail-open / fail-closed choice.
   */
  readonly onError: LlmSwallowPolicy;
  /**
   * How surprising a firing is.
   */
  readonly expectation: LlmSwallowExpectation;
  /**
   * The surface the occurrence reaches. `diag` means this site calls an {@link LlmSwallowSink}; every other value
   * means it is already visible elsewhere (or, for `none`, that it cannot be).
   */
  readonly channel: LlmSwallowChannel;
  /**
   * Report the site only ONCE per log (a host still counts EVERY occurrence) — for a hot-path site whose cause is
   * invariant.
   */
  readonly once?: boolean;
  /**
   * REQUIRED when {@link channel} is `none` — why the occurrence cannot be counted.
   */
  readonly why?: string;
}

/**
 * A swallow registry — every {@link LlmSwallowSiteId} it declares, keyed by that id.
 */
export type LlmSwallowSiteRegistry = Readonly<Record<LlmSwallowSiteId, LlmSwallowSiteDeclaration>>;

/**
 * The one-call reporter handed to a swallow site. A host's implementation must NEVER throw — a counting mechanism that
 * could fault would re-break every never-throw guarantee it exists to document.
 *
 * @param site - The declared {@link LlmSwallowSiteId} that fired.
 * @param cause - The caught value, when the catch binds one (a bare `catch {}` genuinely has nothing to report).
 */
export type LlmSwallowSink = (site: LlmSwallowSiteId, cause?: unknown) => void;

/**
 * The no-op sink — the default for a helper called without one, so an un-threaded call site behaves exactly as if no
 * sink existed.
 *
 * @returns Nothing; every report is dropped.
 */
export const noopLlmSwallowSink: LlmSwallowSink = () => undefined;

/**
 * The cap a swallow's cause text is cut to, so one pathological error message cannot dominate a log.
 */
export const LLM_SWALLOW_CAUSE_MAX_LENGTH = 200;

/**
 * Render a caught value as a swallow's cause text — the error message (or its `String` form), cut to
 * {@link LLM_SWALLOW_CAUSE_MAX_LENGTH}. Nullish or empty ⇒ `undefined`, so a bare `catch {}` reports no cause at all
 * (byte-stable absence).
 *
 * Idempotent on its own output, so a host that re-derives the text from the forwarded raw cause gets the same bytes.
 *
 * @param cause - The caught value.
 * @returns The cut cause text, or `undefined` when there is nothing to report.
 */
export function llmSwallowCauseText(cause: unknown): Maybe<string> {
  const text = cause == null ? undefined : readErrorMessage(cause);
  return text == null || text.length === 0 ? undefined : text.slice(0, LLM_SWALLOW_CAUSE_MAX_LENGTH);
}

/**
 * Build an {@link LlmSwallowSiteRegistry} from its declarations, keyed by each declaration's own `id` in input order —
 * so a key and its `id` can never drift (a hand-keyed object literal drifts on the first copy-paste).
 *
 * Throws on a repeated id: a merged registry (a host's sites plus {@link LLM_SWALLOW_SITES}) must not let one
 * package's declaration silently shadow another's.
 *
 * @param declarations - The declared sites.
 * @returns The registry keyed by id.
 * @throws {Error} When two declarations share an id.
 *
 * @example
 * ```ts
 * const sites = makeLlmSwallowSiteRegistry([...Object.values(LLM_SWALLOW_SITES), ...APP_SWALLOW_SITE_DECLARATIONS]);
 * ```
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmSwallowSiteRegistry(declarations: ReadonlyArray<LlmSwallowSiteDeclaration>): LlmSwallowSiteRegistry {
  return arrayToObject(declarations, { readKey: (declaration) => declaration.id, throwOnDuplicateKey: (id) => new Error(`llm-swallow-sites: duplicate site id '${id}'`) });
}

/**
 * Every declared swallow site whose code is in this library. A host registers them beside its own
 * (`makeLlmSwallowSiteRegistry([...Object.values(LLM_SWALLOW_SITES), …])`) so a site id the library forwards to the
 * host's sink resolves to its declaration.
 */
export const LLM_SWALLOW_SITES: LlmSwallowSiteRegistry = makeLlmSwallowSiteRegistry([
  // THE TERMINAL CASE: `LlmCallContext.swallow` forwards to the host's `onSwallow`, and every swallow lands there.
  { id: 'llm/call-context.swallow-sink', protects: 'a host swallow sink that throws must never escape the catch block that reported to it', onError: 'proceed', expectation: 'fault', channel: 'none', why: 'terminal: every swallow lands here, so its own failure cannot be recorded as one' },
  // The two catches of `makeLlmDispatchTapRegistry` — counted in the registry's `health()`.
  { id: 'llm/dispatch-taps.sync-throw', protects: 'a tap that throws must never abort the fan-out to the remaining taps, nor reach the dispatcher', onError: 'proceed', expectation: 'fault', channel: 'health' },
  { id: 'llm/dispatch-taps.async-reject', protects: 'a tap whose promise rejects must never reach the dispatcher', onError: 'proceed', expectation: 'fault', channel: 'health' },
  // `llm.credential.probe.ts` — the verdict carries both (the body is decoded by `@dereekb/util/fetch` `readFetchJsonText`).
  { id: 'llm/credential-probe.transport', protects: 'an unreachable provider reports an unready CREDENTIAL rather than throwing out of the launch gate that asked', onError: 'report', expectation: 'degraded', channel: 'health' },
  { id: 'llm/credential-probe.error-body', protects: 'a non-JSON provider error body degrades to its raw text; the verdict still names what the provider answered', onError: 'degrade', expectation: 'expected', channel: 'health' },
  // `llm.strategy.readiness.ts` — the readiness verdict carries all three.
  { id: 'llm/strategy-readiness.health-check', protects: 'a `healthCheck` that threw (a contract violation) is reported as an issue, never propagated', onError: 'report', expectation: 'fault', channel: 'health' },
  { id: 'llm/strategy-readiness.credential-probe', protects: 'a `credentialProbe` that threw (a contract violation) is reported as an issue, never propagated', onError: 'report', expectation: 'fault', channel: 'health' },
  { id: 'llm/strategy-readiness.provider-status', protects: 'a `providerStatus` that threw (a contract violation) is reported as an UNAVAILABLE status, never propagated, and unavailable can never read as spare quota', onError: 'report', expectation: 'fault', channel: 'health' },
  // makeLlmCraftJudge — the decide call's catch.
  { id: 'llm/craft-judge.decide', protects: 'a faulted or unreachable craft judge answers nothing, so every asked note takes its own unserved posture rather than failing the dispatch', onError: 'degrade', expectation: 'degraded', channel: 'diag' },
  // readLlmReplyValue / readLlmReply / readLlmReplyRationale / readLlmLineReplyValue — the one report when no candidate block parsed.
  { id: 'llm/reply-envelope.decode', protects: 'a reply whose JSON block does not parse reads as a degenerate decode (no-json / parse-error) the caller retries or drops; the reader never throws', onError: 'degrade', expectation: 'expected', channel: 'diag' },
  // repairLlmReplyJson — the parse of a rebuilt text; the verdict carries it, no sink is called.
  { id: 'llm/reply-repair.rebuilt-parse', protects: 'a rebuilt text that does not parse is never a near-miss; the shape says so and the reply falls through to the fast fix or a re-ask', onError: 'degrade', expectation: 'expected', channel: 'result' },
  // makeLlmReplyFastFixer — the fixer dispatch's catch; the dispatcher's fast-fix tier — a bound fixer that throws.
  { id: 'llm/reply-repair.fast-fix', protects: 'a fast fix that throws costs the subject nothing but the call; the subject falls through to its ordinary re-ask or drop', onError: 'proceed', expectation: 'degraded', channel: 'diag' },
  // makeLlmSemanticCritic — the judge dispatch's catch.
  { id: 'llm/critique-reply.judge', protects: 'a judge that throws accepts the reply unjudged rather than taking the subject dispatch down with it', onError: 'proceed', expectation: 'degraded', channel: 'diag' },
  // makeLlmDispatcher's decision lane — a consumer's `stamp` that throws.
  { id: 'llm/decide.stamp', protects: 'a host stamp that throws never costs the decision: the answers return and the call is recorded without a stamp', onError: 'proceed', expectation: 'fault', channel: 'diag' }
]);
