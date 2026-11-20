/**
 * The **LLM strategy contract** — the one seam every model backend implements.
 *
 * An {@link LlmStrategy} turns a fully assembled prompt into raw model text. It deliberately hides HOW the model is
 * reached (an HTTP API, an in-process SDK, a scripted strategy in a spec), so a dispatcher can route to any of them
 * without knowing the transport.
 *
 * A call moves through three layers:
 *
 * 1. {@link LlmRequest} — what the caller asks: the prompt and the cross-cutting metadata a strategy may need.
 * 2. {@link LlmCompletion} — what the strategy returns: the raw text plus which strategy and model served it, its
 *    usage and timing.
 * 3. {@link LlmDispatchResult} — what a dispatcher returns: the completion plus what it added on top (attempts,
 *    validation errors, decode status, the repair it applied).
 *
 * Parsing and validation are NEVER the strategy's job: the capability owns its wire schema, so a structured-output
 * backend and a text-only one share this trivial text-in / envelope-out contract — even when a backend enforces the
 * schema at generation, the caller still validates the reply unconditionally. The response schema rides on
 * {@link LlmRequest.responseSchemaHint} as a hint a structured-output strategy uses to constrain generation; it is
 * never a parsing contract.
 *
 * **Prompt caching is additive plumbing on top of this contract, never a new handle.** Provider prompt caching is a
 * content/prefix BYTE-match on the request, not a server-side session id (the cache HIT condition is re-sending the
 * identical preamble every call). So the stateless text-in / envelope-out shape is already correct: a cache-capable
 * strategy reads the {@link LlmRequest.cacheSegments} split (the stable preamble vs the volatile live context), drops
 * a breakpoint at the prefix end (or leans on the provider's automatic prefix caching), and declares HOW it caches
 * via {@link LlmStrategy.caching}. An {@link LlmStrategy.warm} seam prefills that preamble. None of this needs a
 * handle — it is a derived view of the same prompt bytes, and a non-caching strategy ignores it entirely.
 */

import { type AbortSignalRef, type Milliseconds } from '@dereekb/util';
import { type LlmCapabilityKey, type LlmModelId, type LlmReasoningConfig, type LlmStrategyId } from '../model/llm.value';
import { type LlmPromptCacheSegments, type LlmPromptSegment } from '../prompt/llm.prompt.segment';
import { type LlmProviderStatus, type LlmProviderStatusOptions, type LlmProviderStatusProviderId } from './llm.provider.status';
import { type LlmStrategyHealth } from './llm.strategy.health';
import { type LlmUsage } from './llm.usage';

/**
 * Host-owned data riding a call untouched: the library never reads it, and strategies echo it from the request onto
 * the completion. A host narrows it by interface extension (`interface HostRequest extends LlmRequest { readonly
 * meta?: HostMeta }`). Keep it JSON-serializable, so a recorded call can carry it.
 */
export type LlmCallMeta = object;

/**
 * The role of one prior {@link LlmThreadTurn} — the user prompt sent or the assistant reply received.
 */
export type LlmThreadRole = 'user' | 'assistant';

/**
 * One PRIOR turn of a chained prompt thread ({@link LlmRequest.thread}) — replayed verbatim so a follow-up call
 * re-sends the exact bytes the earlier calls exchanged. Still content-addressed caching, never a handle (see the
 * module header): replaying the identical prior turns is exactly what makes the provider's prompt cache treat the
 * whole exchanged history as a warm prefix.
 */
export interface LlmThreadTurn {
  /**
   * Whether this turn was a sent user prompt or the assistant reply to it.
   */
  readonly role: LlmThreadRole;
  /**
   * The turn's exact text — for a `user` turn, the FINAL prompt variant that produced the accepted reply (retry
   * corrections included), so the replayed bytes match what the provider actually cached.
   */
  readonly content: string;
  /**
   * The original stable→volatile split of a `user` turn that was sent segmented — preserved so a
   * breakpoint-caching strategy replays the SAME content blocks (byte-identical block layout ⇒ the first call's
   * prefix cache entry still matches). Absent on assistant turns and on follow-up user turns (they were sent
   * unsegmented).
   */
  readonly cacheSegments?: LlmPromptCacheSegments;
}

/**
 * One NON-TEXT input riding alongside the assembled prompt — an inline image.
 *
 * **The prompt is always self-sufficient.** An attachment is an ENRICHMENT of a prompt that already describes what
 * the attachment shows: the prompt text carries a description of every image, and only then are the bytes offered.
 * That is the degrade policy, stated once here rather than re-implemented per backend — a text-only transport (a
 * local model, a tape replay, a thread flattener) reads `prompt` and needs no change at all, and a vision-capable
 * one simply sends a strictly better version of the same question.
 *
 * Attachments are a SIBLING field of {@link LlmRequest.cacheSegments}, not part of it: the
 * `cachePrefix + volatileSuffix === prompt` invariant is about the TEXT, and folding bytes into it would break every
 * cache-split assertion for no gain.
 */
export interface LlmAttachment {
  /**
   * The attachment kind — `'image'` is the only one carried today.
   */
  readonly kind: 'image';
  /**
   * The image MIME type (`image/png` / `image/jpeg` / `image/webp`).
   */
  readonly mime: string;
  /**
   * The raw bytes, base64-encoded (no data-URL prefix; a backend adds whatever envelope it needs).
   */
  readonly dataBase64: string;
  /**
   * A short handle the prompt text refers to this attachment by (`img-3`), so a model can say WHICH image a detail
   * came from.
   */
  readonly label?: string;
}

/**
 * One LLM call — the fully assembled prompt plus the cross-cutting metadata a strategy may need. A dispatcher
 * builds it; a strategy only reads it.
 */
export interface LlmRequest {
  /**
   * The fully assembled prompt — the exact string the strategy sends.
   */
  readonly prompt: string;
  /**
   * The capability this call resolves (e.g. `'summarize'`) — carried for telemetry / attribution.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * Host-owned data riding the call ({@link LlmCallMeta}). The library never reads it; a strategy echoes it onto
   * its {@link LlmCompletion}.
   */
  readonly meta?: LlmCallMeta;
  /**
   * An ADVISORY description of the reply shape a structured-output strategy MAY use to constrain generation. Never
   * a parsing contract — the caller validates the reply unconditionally regardless.
   */
  readonly responseSchemaHint?: unknown;
  /**
   * An OPTIONAL per-call model id — the MODEL axis (orthogonal to {@link LlmStrategy.id}, the transport axis). A
   * dispatcher resolves the capability's named model tier to a concrete slug and threads it here; a strategy honours
   * it (routes by it) or ignores it when unset. Transport-agnostic — never bound to one backend. Unset ⇒ the
   * strategy's default model, so a default-tier call can stay byte-identical to a call made without tiers. An
   * unknown tier key should fail loud above the strategy (no silent fallback to the default — else the
   * stronger-model intent silently evaporates).
   */
  readonly model?: LlmModelId;
  /**
   * The per-call completion-length cap (the output-budget axis) — the `max_tokens` the strategy sends, resolved
   * from the capability / the resolved tier's config. A strategy honours it (`max_tokens: request.maxOutputTokens ??
   * <its default cap>`) or ignores it. Unset ⇒ the strategy's own default cap (`DEFAULT_LLM_MAX_OUTPUT_TOKENS` for
   * the stock transports), so the no-budget wire body is byte-identical. A dispatcher's bounded retry may raise it on
   * a length-truncation decode failure (a truncated reply is re-asked with a larger cap).
   */
  readonly maxOutputTokens?: number;
  /**
   * The per-call reasoning controls ({@link LlmReasoningConfig}), resolved from the resolved tier's config. A
   * strategy maps it onto its transport (OpenRouter's `reasoning` param) and sends it ONLY when set (some providers
   * reject an unknown param); unset ⇒ no reasoning param on the wire. A strategy that cannot reason ignores it.
   */
  readonly reasoning?: LlmReasoningConfig;
  /**
   * The stable→volatile cache split of {@link prompt} (`cachePrefix + volatileSuffix === prompt`). A
   * `caching: 'none'` strategy ignores it and reads {@link prompt}.
   */
  readonly cacheSegments?: LlmPromptCacheSegments;
  /**
   * The PROVENANCE breakdown of {@link prompt} — the ordered {@link LlmPromptSegment}s joined to build it. When
   * present, `joinLlmPromptSegments(segments) === prompt` and `llmPromptCacheSegmentsOf(segments)` equals
   * {@link cacheSegments} (both are DERIVED from this list, never built separately). Absent on a hand-built request.
   *
   * A transport MAY read it (a per-segment `cache_control` breakpoint is the obvious use); {@link prompt} stays the
   * canonical wire string, so a strategy that ignores this field is correct.
   */
  readonly segments?: ReadonlyArray<LlmPromptSegment>;
  /**
   * The PRIOR turns of a chained prompt thread, oldest first ({@link LlmThreadTurn}) — set when a follow-up
   * executes; {@link prompt} is then the NEW user message that follows them. A thread-capable strategy replays the
   * turns as chat messages ahead of the prompt (re-sending the identical bytes, so the provider's content-addressed
   * prompt cache serves the whole history warm); a text-only backend flattens them. Omitted / empty ⇒ single-shot.
   */
  readonly thread?: ReadonlyArray<LlmThreadTurn>;
  /**
   * OPTIONAL non-text inputs to send alongside {@link prompt} ({@link LlmAttachment}) — inline images. A strategy
   * sends them ONLY when the model it is about to call is known to accept them; otherwise it ignores the field
   * entirely and the call is byte-identical, because the prompt already carries each attachment's description.
   */
  readonly attachments?: ReadonlyArray<LlmAttachment>;
}

/**
 * The SHAPE of one reply, classified apart from whether the call was usable — the reply-outcome taxonomy a retry
 * ladder branches on and a run record keeps.
 *
 * - `ok` — a usable reply (an accepted value, or a legitimate in-band decline).
 * - `reasoning-only` — blank visible text with billed REASONING tokens: the model thought and never answered. The
 *   always-thinking shape, whose fix is reasoning OFF rather than a different model.
 * - `empty-content` — blank (or whitespace-only) text with no reasoning to explain it. Deliberately NOT folded into
 *   `reasoning-only`: the fixes differ, and a reader cannot lift a value out of whitespace either way.
 * - `length-capped` — the provider's completion cap ended the reply (`finishReason` `length` / `max_tokens`).
 * - `malformed` — non-empty, non-truncated text the reply reader could not decode.
 * - `schema-invalid` — text that decoded into a value the capability's validator rejected.
 * - `transport` — no reply at all: the per-call abort fired (the synthetic timeout envelope).
 */
export type LlmReplyOutcomeClass = 'ok' | 'reasoning-only' | 'empty-content' | 'length-capped' | 'malformed' | 'schema-invalid' | 'transport';

/**
 * What a strategy returns — the raw model text the caller parses, plus the which-strategy / which-model telemetry
 * a call record keys off. Returning this (rather than a bare string) is the forward-compatible seam: a replay is "a
 * strategy that reads back a recorded completion", and a recorder reads `text` + `strategyId` without a contract
 * break.
 */
export interface LlmCompletion {
  /**
   * The raw model output.
   */
  readonly text: string;
  /**
   * The id of the strategy INSTANCE that produced this completion — the attribution axis (which account / which
   * keyed instance served it). Several instances may share one {@link strategyKind}.
   */
  readonly strategyId: LlmStrategyId;
  /**
   * The TRANSPORT KIND of the strategy that produced this completion ({@link LlmStrategy.kind} when it declares one,
   * else its {@link LlmStrategy.id} — `llmStrategyKind`). The LANE axis: the column a usage ledger folds by
   * strategy on, so an A/B between two lanes reads as two buckets even when the host minted one instance per lane
   * under a host-chosen id. Absent ⇒ fold by {@link strategyId}.
   */
  readonly strategyKind?: LlmStrategyId;
  /**
   * The capability this completion answers (echoed for attribution).
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The request's {@link LlmRequest.meta}, echoed untouched. Absent when the request carried none.
   */
  readonly meta?: LlmCallMeta;
  /**
   * The model that actually SERVED this call (the completion's `model`), falling back to the SENT model id
   * (`request.model ?? defaultModel`) when the provider echoes none. The cost / tier attribution telemetry. Absent on
   * a strategy with no provider completion to read (a scripted or tape strategy).
   */
  readonly model?: LlmModelId;
  /**
   * The UPSTREAM endpoint that served this call, when the transport reported one (OpenRouter's response
   * `provider`). Telemetry-only — no code branches on it. Recorded because a model slug is served by many endpoints
   * whose wire behaviour differs (some silently ignore `reasoning.enabled: false`), and without it an endpoint
   * allowlist has no evidence to stand on. Absent on a strategy with no provider completion to read (a scripted or
   * tape strategy), on a transport that reports none, and when the provider echoed none.
   */
  readonly provider?: string;
  /**
   * Token usage (plus the optional dollar cost) for this call ({@link LlmUsage}). Absent on a strategy with no
   * provider completion to read (a scripted or tape strategy), and when the provider returned no `usage`.
   */
  readonly usage?: LlmUsage;
  /**
   * Wall-clock time around the model call. Telemetry-only — absent on a strategy with no provider completion to read
   * (a scripted or tape strategy).
   */
  readonly latencyMs?: Milliseconds;
  /**
   * The provider's generation id for this call (OpenRouter's completion `id`) — the stable handle a later
   * generation-metadata lookup, bill read (`LlmCallBillReader`) or support ticket keys off. Absent on a
   * strategy with no provider completion to read (a scripted or tape strategy), and when the provider echoed none.
   */
  readonly generationId?: string;
  /**
   * Why generation stopped (the completion choice's `finish_reason`, falling back to `native_finish_reason`) —
   * `'stop'` for a clean end, `'length'` when the output cap truncated it (the runaway-guard signal). Absent on a
   * strategy with no provider completion to read (a scripted or tape strategy), and when the provider echoed none.
   */
  readonly finishReason?: string;
  /**
   * How many image parts the transport actually put ON THE WIRE for this call's {@link LlmRequest.attachments} — the
   * transport's own fact, so a picture the strategy dropped (a model not known to accept images, a retry that
   * resolved to another model) is never mistaken for one that was sent. `0` means the request carried attachments
   * and none rode. Present only when the request carried attachments; absent on a text call and on a strategy
   * with no provider completion to read (byte-stable). Read it before trusting any reply that claims to describe an image.
   */
  readonly attachmentsSent?: number;
  /**
   * Whether this call SENT `response_format` json_schema/strict (generation-time enforcement was REQUESTED). The
   * strategy sets it: `true` when a schema hint was threaded, `false` on a scripted strategy or a text-only path. NOT
   * a claim the provider honoured it — a partial-`strict` model that silently ignores it still reads `true`; a
   * reader infers "ignored" from `schemaEnforced && attempts > 1` (enforcement was requested but did not hold on the
   * first try).
   */
  readonly schemaEnforced?: boolean;
}

/**
 * How a dispatch's decode ENDED — `'clean'` (accepted on the first attempt), `'retried'` (accepted after ≥ 1
 * rejected attempt), or `'dropped'` (the attempt budget ran out on a reply that never conformed, so the caller got
 * nothing).
 */
export type LlmDecodeStatus = 'clean' | 'retried' | 'dropped';

/**
 * A completion plus what a dispatcher adds on top: the bounded validate-and-retry record, the decode verdict and the
 * reply repair it applied.
 */
export interface LlmDispatchResult extends LlmCompletion {
  /**
   * What the caller's parser reads — the raw model output, EXCEPT when the dispatcher's reply-repair lane repaired a
   * malformed JSON reply: then this is the REPAIRED JSON and the model's own bytes ride
   * {@link LlmReplyRepair.originalText} on {@link repair} (and stay in the call record). The substitution is what
   * makes a repair reachable by every caller that re-parses `text` itself.
   */
  readonly text: string;
  /**
   * How many `strategy.complete` calls the dispatcher's bounded validate-and-retry made (initial + retries). Present
   * IFF the loop ran (a validator was supplied); a single-shot call leaves it unset. On a DECISION's call record it
   * counts the `strategy.decide` sends, and is present only when a retryable transport failure was resent.
   */
  readonly attempts?: number;
  /**
   * The validator summary of EACH schema-invalid attempt, in attempt order (incl. the final one when the loop
   * exhausted on an invalid reply). Absent when every attempt was valid / short-circuited.
   *
   * Each entry is ATTEMPT-PREFIXED (`attempt 1: …`). A flat list across attempts cannot say whether a retry
   * RECOVERED or was DROPPED — reconstructing that from a run log means re-validating the final reply text by hand;
   * with the prefix (and {@link decodeStatus}) it is a read.
   */
  readonly validationErrors?: ReadonlyArray<string>;
  /**
   * How this dispatch's decode ENDED ({@link LlmDecodeStatus}). Present IFF the bounded validate-and-retry loop ran.
   */
  readonly decodeStatus?: LlmDecodeStatus;
  /**
   * The SHAPE of the reply this dispatch ended on ({@link LlmReplyOutcomeClass}) — the sibling of
   * {@link decodeStatus}, which answers *"was the reply usable"*. The two are orthogonal and folding them makes both
   * unreadable: a `dropped` dispatch may have been dropped because the reply was truncated, or blank, or
   * unparseable, or because the transport never answered, and those want different fixes. Present IFF the bounded
   * validate-and-retry loop ran.
   */
  readonly decodeOutcome?: LlmReplyOutcomeClass;
  /**
   * STICKY: SOME attempt of this dispatch was cut off by the completion cap — `true` even when a LATER attempt
   * succeeded. A truncation that a re-ask recovered from is invisible in every other field (the accepted reply
   * finished cleanly), yet it is the signal that this capability's completion budget is too small for what it is
   * being asked for. Absent (never `false`) when nothing truncated, so an untruncated dispatch's result is
   * byte-identical.
   */
  readonly lengthCapped?: true;
  /**
   * The NORMALIZED post-parse value of an ACCEPTED reply, JSON-encoded — the reply as the caller actually read it,
   * after any envelope unwrap. Recorded beside the raw `text` so a log analysis never has to re-implement the
   * unwrap. Absent on a dropped / in-band-declined decode.
   */
  readonly lever?: string;
  /**
   * How the dispatcher REPAIRED the reply this dispatch ended on ({@link LlmReplyRepair}) — present only when the
   * final attempt's reply was a malformed JSON object the reply-repair lane fixed before any re-ask. {@link text} is
   * then the repaired JSON; the model's bytes are {@link LlmReplyRepair.originalText}. Absent otherwise (byte-stable
   * absence).
   */
  readonly repair?: LlmReplyRepair;
}

/**
 * Which tier of a dispatcher's reply-repair lane fixed a malformed JSON reply — the free `deterministic` walk, or
 * one `fast-fix` call handed only the broken reply and the reply schema.
 */
export type LlmReplyRepairTier = 'deterministic' | 'fast-fix';

/**
 * The BOUNDED summary of one reply repair — what a call record, an attempt phase and call telemetry carry (never the
 * original text). Plain string unions, so this module imports nothing for it.
 */
export interface LlmReplyRepairSummary {
  /**
   * The tier that fixed the reply.
   */
  readonly tier: LlmReplyRepairTier;
  /**
   * The 1-based attempt whose reply was repaired.
   */
  readonly attempt: number;
  /**
   * The scorer's verdict on the ORIGINAL reply (`near-miss` for a deterministic repair, `mangled` for a fast fix).
   */
  readonly verdict: string;
  /**
   * The scorer's JSON-likeness score of the original reply (0..1).
   */
  readonly score: number;
  /**
   * The deterministic repair ops applied, by kind (deterministic tier only).
   */
  readonly ops?: Readonly<Record<string, number>>;
  /**
   * Host data of the fast-fix call that produced the repair (the fixer's own `meta`, e.g. its correlation id) — set on
   * the `fast-fix` tier only, when the fixer returned one.
   */
  readonly meta?: LlmCallMeta;
}

/**
 * One reply repair as it rides {@link LlmDispatchResult.repair} — the bounded {@link LlmReplyRepairSummary} plus the
 * model's own bytes the repair replaced.
 */
export interface LlmReplyRepair extends LlmReplyRepairSummary {
  /**
   * The model's ORIGINAL reply text — what the provider actually returned, and what the call record keeps (so a
   * tape replays the model, and the repair re-runs).
   */
  readonly originalText: string;
}

/**
 * How a strategy exploits provider prompt caching of the stable {@link LlmPromptCacheSegments.cachePrefix} — a
 * static, per-strategy declaration (telemetry + self-documentation). A strategy that routes to different provider
 * families per call may later refine this to a per-call / per-model descriptor.
 */
export type LlmCacheMode =
  /**
   * No cache control at all (e.g. a text-only backend that re-sends the whole prompt every call).
   */
  | 'none'
  /**
   * Emits an explicit `cache_control` breakpoint at the {@link LlmPromptCacheSegments.cachePrefix} end (Anthropic / OpenRouter→Anthropic).
   */
  | 'breakpoint'
  /**
   * Relies on the provider's automatic prefix caching above a min-token count — no breakpoint (OpenAI / Grok / DeepSeek).
   */
  | 'auto-prefix';

/**
 * Per-call options for {@link LlmStrategy.complete} — cross-cutting concerns that are NOT part of the assembled
 * request bytes (so they never perturb the content-addressed prompt cache). Optional + additive: a strategy that
 * ignores them behaves exactly as without them.
 */
export interface LlmCompleteOptions extends AbortSignalRef {}

/**
 * The per-request timeout FLOOR of a completion transport. The stock OpenAI-compatible transports scale each call's
 * abort window up from it with the call's completion budget (`llmOpenAiCallTimeoutMs`, capped at 10 minutes).
 */
export const DEFAULT_LLM_COMPLETION_TIMEOUT_MS: Milliseconds = 60_000;

/**
 * The completion-length cap of a call that names none (`LlmRequest.maxOutputTokens` unset, no strategy override).
 *
 * Deliberately HIGH: a truncated reply is billed in full, decodes to nothing and buys a retry that bills again, and a
 * hybrid-reasoning model spends part of the cap thinking. A model with a smaller output limit (an older OpenAI model,
 * a small-context local model) needs its cap configured (`maxOutputTokens` on the strategy, provider or tier). A
 * dispatcher's `defaultMaxOutputTokens` is normally this value.
 */
export const DEFAULT_LLM_MAX_OUTPUT_TOKENS = 8_192;

/**
 * Per-call options for {@link LlmStrategy.credentialProbe} — the external cancellation seam, mirroring
 * {@link LlmCompleteOptions.signal}. A probe combines it with its own short internal timeout.
 */
export interface LlmCredentialProbeOptions extends AbortSignalRef {}

/**
 * A gateway-specific credential probe a HOST hands a provider-neutral transport (as it hands an
 * `LlmProviderStatusSource`): the transport delegates its {@link LlmStrategy.credentialProbe} to it instead of
 * running its own generic one. Same contract: free, never on the dispatch path, never throws.
 */
export type LlmCredentialProbe = (options?: LlmCredentialProbeOptions) => Promise<LlmStrategyHealth>;

/**
 * What every configured backend shares, on either lane — the completion {@link LlmStrategy} and the decision lane's
 * `LlmDecisionStrategy` both extend it: identity (`id` / `kind`), a description, and the two readiness seams.
 *
 * The strategy registry (`makeLlmStrategyRegistry`), the readiness aggregators (`verifyLlmStrategies` /
 * `probeLlmCredentials`) and `llmStrategyKind` read only this base, so each serves both lanes.
 */
export interface LlmStrategyBase {
  /**
   * The INSTANCE id — the name of this one configured backend (the dispatcher routes to it; the registry keys on
   * it), e.g. `'openrouter'`, or `'local'` / `'gateway-payg'` for two separately-configured `openai` transports.
   *
   * It is not the transport-KIND label: {@link kind} carries the transport and this carries identity, so a host may
   * mint N instances of one transport as long as each names itself.
   */
  readonly id: LlmStrategyId;
  /**
   * The TRANSPORT this instance is served by — the wire protocol / SDK, e.g. `'openai'` / `'openrouter'`. Several
   * instances may share one kind; each still has its own {@link id}.
   *
   * OPTIONAL, and absent means *"{@link id} is also the kind"* — which is exactly true of a single-instance strategy
   * and of every hand-built fake. Read it through `llmStrategyKind` rather than directly, so that default lives in
   * one place.
   */
  readonly kind?: LlmStrategyId;
  /**
   * A one-line description (surfaced when listing strategies / on an unknown-id error).
   */
  readonly describe: string;
  /**
   * OPTIONAL startup readiness probe — does THIS backend have what it needs to serve a real call? Provider-agnostic:
   * each strategy checks ITS OWN deps (a key is present, its client is constructible, a client was injected). MUST be
   * cheap and side-effect-light — construct/validate, do NOT make a billable network round-trip — and MUST NEVER
   * throw (report unreadiness as `ready:false` + an `'error'` issue). MUST no-op to `{ ready:true }` when an
   * injection seam (an injected client) is present, so a fake never triggers a real key/SDK check. A
   * strategy that omits this member is treated as ready by `verifyLlmStrategies` (the seam is opt-in). Invoked once
   * at bootstrap by the host via `verifyLlmStrategies` — the dispatcher NEVER calls it.
   *
   * @returns This backend's readiness verdict.
   */
  healthCheck?(): Promise<LlmStrategyHealth>;
  /**
   * OPTIONAL live CREDENTIAL probe — the deliberately-NETWORKED sibling of {@link healthCheck}. It answers the one
   * question `healthCheck` structurally cannot: does the configured key still WORK? A well-formed but REVOKED key
   * passes every non-network check and every constructibility check, then fails at the provider on the first real
   * call — which, behind a fail-open host, silently degrades a whole run to fallbacks instead of failing it.
   *
   * Contract, mirroring {@link healthCheck} except on the network axis:
   * - It MAKES A REAL NETWORK ROUND-TRIP, against a FREE, non-billable auth-scoped endpoint (e.g. OpenRouter
   *   `GET /key`; an OpenAI-compatible `GET /models`). Never a completion or a decision.
   * - It is OPT-IN and is NEVER called by the dispatcher nor by `verifyLlmStrategies` — a caller that wants it asks
   *   for it (`probeLlmCredentials`, a launch gate).
   * - It MUST NEVER throw: an unreachable provider / a rejected key is reported as `ready:false` + an `'error'`
   *   issue carrying the provider's OWN message verbatim.
   * - It MUST no-op to `{ ready:true }` when an injection seam (e.g. an injected client) is present, so a fake
   *   never opens a socket — unless the host supplied an explicit credential probe source, which outranks the
   *   injected seam and is always delegated to.
   *
   * @param options - Optional external cancellation.
   * @returns This backend's credential verdict.
   */
  credentialProbe?(options?: LlmCredentialProbeOptions): Promise<LlmStrategyHealth>;
}

/**
 * A pluggable LLM backend, keyed by a stable {@link LlmStrategyBase.id}. Hides subprocess vs in-process SDK vs HTTP
 * behind one async text-in / envelope-out call.
 */
export interface LlmStrategy extends LlmStrategyBase {
  /**
   * How this strategy caches the stable preamble ({@link LlmCacheMode}) — self-documentation / telemetry; a
   * dispatcher's behaviour does not branch on it.
   */
  readonly caching: LlmCacheMode;
  /**
   * Run the call. Raw assembled prompt in (on the request), the raw model text out (in the completion).
   *
   * @param request - The assembled prompt + cross-cutting metadata.
   * @param options - Optional per-call, non-request concerns (e.g. an external cancellation {@link LlmCompleteOptions.signal}).
   * @returns The raw completion.
   */
  complete(request: LlmRequest, options?: LlmCompleteOptions): Promise<LlmCompletion>;
  /**
   * Whether this backend accepts a REASONING parameter on the wire at all. Defaults to `true` when absent (every
   * hand-built fake reads correctly with no edit).
   *
   * It exists for one reader: a retry ladder's reasoning rungs. A gateway strict enough to reject an unknown
   * `reasoning_effort` would answer a reasoning-changed retry with a 400, which (being a non-abort throw) escapes a
   * bounded retry loop and turns a recoverable re-ask into a thrown dispatch. Declaring the capability here keeps
   * the dispatcher from having to learn any transport's encoding rules.
   */
  readonly supportsReasoningParam?: boolean;
  /**
   * OPTIONAL warm-up — prefill the stable {@link LlmPromptCacheSegments.cachePrefix} so the FIRST real
   * {@link complete} call hits a warm cache. A breakpoint strategy implements this as a `max_tokens: 0` request over
   * `request.cacheSegments.cachePrefix` (same model + same prefix bytes the real call sends), which writes the
   * provider cache BY CONTENT and returns nothing reusable (caching is content-addressed, not a handle). The warm
   * call must omit format enforcement / `thinking` / `stream` / forced `tool_choice` (all reject `max_tokens: 0`).
   *
   * It lives OUTSIDE the dispatcher's single-shot {@link complete}: an orchestrator fires it once before a burst of
   * calls against a preamble it is about to hammer, gated on the cost/benefit test (interactive + large prefix +
   * traffic gaps longer than the cache TTL) and re-fired under the TTL — the dispatcher never calls it.
   *
   * @param request - The request whose {@link LlmRequest.cacheSegments} prefix to prefill.
   */
  warm?(request: LlmRequest): Promise<void>;
  /**
   * OPTIONAL live ACCOUNT-STATUS read — the THIRD networked sibling, answering the question the other two cannot: how
   * much of the current period's entitlement is already spent?
   *
   * `healthCheck` says the transport is constructible, `credentialProbe` says the key is live — and a run can pass
   * both and still be refused on its first call by a spent quota (`402`). Neither the completion response nor the
   * refusal carries a remaining-quota or `retry-after` field, so the only way to know before spending is to ask the
   * provider's account endpoints, which is what this does.
   *
   * Contract, mirroring {@link LlmStrategyBase.credentialProbe}:
   * - It MAKES REAL NETWORK ROUND-TRIPS against free, non-billable account endpoints. Never a completion.
   * - It is OPT-IN, and is NEVER called by the dispatcher, `verifyLlmStrategies`, or `probeLlmCredentials` — a
   *   caller that wants it asks (`readLlmProviderStatus`).
   * - It MUST NEVER throw: an unreachable endpoint / a missing management credential is reported as
   *   `available: false` plus an issue.
   * - Absence of the member means "this backend does not meter an account", NOT "the account is fine".
   *
   * A transport implements this by DELEGATING to a host-injected `LlmProviderStatusSource`, so the
   * provider-specific endpoints stay out of a transport that is contractually provider-neutral.
   *
   * @param options - Optional external cancellation.
   * @returns What the provider says about the current period.
   */
  providerStatus?(options?: LlmProviderStatusOptions): Promise<LlmProviderStatus>;
  /**
   * WHICH ACCOUNT {@link providerStatus} reads — the `providerId` its source will stamp, exposed BEFORE the read.
   *
   * It is the fold key for an aggregator over several instances, and it has to be readable ahead of the call:
   * several instances routinely share one account (two instances on one gateway account, differing only in which
   * inference key pays), and a report that discovered that only from the answers has already made the redundant
   * network round-trip. Absent whenever {@link providerStatus} is.
   */
  readonly providerStatusId?: LlmProviderStatusProviderId;
}
