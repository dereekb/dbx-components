# Dispatcher, retry and lanes

Entry: `@dereekb/llm` · [← @dereekb/llm](../README.md)

## Dispatcher

`makeLlmDispatcher` is the library implementation of `LlmDispatcher`. Every call, root or chained follow-up, runs the
same stages in order: resolve, compose, send, decode, validate, record, then report the thread turn the follow-ups
replay. Hosts swap their own pieces in through hooks; the dispatcher has no host types of its own. The stage functions
are internal: `@dereekb/llm` exports the factory, its config and hooks, the request, the fault and the retry /
correction / backoff vocabulary with its constants.

- **Required config.** `strategies` (an `LlmStrategyRegistry`), `defaultStrategyId`, `defaultMaxOutputTokens`,
  `modelTiers`, `descriptorOf` and `templateResolver`. The default tier's slug is resolved at construction, so a tier map
  without it throws there. A selected strategy id that is not registered throws and names the registered ones.
- **Resolve.** Model by `request.model` › `request.tier` › route › descriptor › default tier. The wire always names the
  resolved slug (the default tier's included) and the cap: route › descriptor › tier › the selected strategy's declared
  `defaultMaxOutputTokens` › the dispatcher's `defaultMaxOutputTokens`. A strategy behind a dispatcher therefore needs
  no `defaultModel`. A stock strategy declares `defaultMaxOutputTokens` only when it was configured with
  `maxOutputTokens` (per provider: `maxOutputTokensByProvider`), so a provider's cap — and the call timeout that scales
  with it — holds behind a dispatcher, and the retry ladder raises from the cap actually sent; an unconfigured
  strategy's built-in default never applies.
  The strategy comes from `selectStrategy` when set, else route provider › `providerByModel` › `defaultStrategyId`.
  Output controls follow `resolveLlmCapabilityOutputControls` over `reasoningDefault` (off by default). Debug breadcrumbs `model-route`, `provider-route` and `reasoning-floor` fire once
  per key.
- **Compose.** The root runs `composeLlmCapabilityPrompt` over `layout` (default `DEFAULT_LLM_PROMPT_LAYOUT`),
  `contributors`, `texts` and the schema hints (none on a `line` call; an explicit request hint, or a follow-up's, is
  hardened, its `description` prose stripped unless `describeResponseSchemaHint` is set — a descriptor's own hints
  follow the flag it was defined with). It sends
  the cache split, attachments (root only) and every placement as call-record `supplements`. `promptCacheWatch`
  observes the prefix per capability and `cachePartitionOf(request)`, filing `prefix-changed` when it moves.
  `isRawJsonBlock` turns on the raw-JSON watch (skipped for a `rawJsonContext` descriptor). A follow-up is one segment
  under the layout's `follow-up` slot id, sent over the replayed `thread` with no cache split and no attachments.
- **Single-shot.** With no `validate` and no `critique` the strategy result comes back unchanged. A reply that nearly
  parses is repaired for free (`reply-repaired` diag, no decode row); the single-shot path never calls the fast fix. A
  timeout or transient send error on a cancelled dispatch is dropped quietly (the synthetic envelope, recorded). Otherwise
  it is recorded as one `timeout` / `transport` row and call record, then the original error is rethrown unchanged. A
  send error the policy does not resend (`permanent`, or `unknown`: no resend is possible here, so
  `isRetryableUnknownError` is never asked) is recorded as one `unretryable` row and call record, then rejects as
  `LlmDispatchFaultError`.
- **Validated.** With a `validate` (or a `critique`) the call runs the bounded retry loop (see [Retry and lanes](#retry-and-lanes)). Each
  reply is read, repaired, validated, then critiqued, and the result is stamped `attempts`, `decodeStatus`,
  `decodeOutcome`, `lengthCapped`, `valueJson` and `validationErrors`. A decline, or a `line` reply that is not JSON, is
  accepted. Each rejected attempt records a decode row (critique rejections excepted), a `failedAttempts` row and an
  `onDecodeFailure` tap event whose `willRetry` is the retry decision made when the attempt was judged. A send error
  the policy does not resend ends the loop at once (see the transport lane in [Retry and lanes](#retry-and-lanes)).
- **Follow-ups.** `preparePrompt(request)` returns an `LlmPrompt` whose `execute()` runs once and whose `followUp(…)`
  chains onto the same thread; `dispatch(request)` equals `preparePrompt(request).execute()` unwrapped. A degenerate
  reply replays as `degenerateThreadPlaceholder`. `makeLlmPromptChain` works over it unchanged: the root renders its
  live context once, and each follow-up sends only the lead and the changed blocks.
- **Resuming.** `resumePrompt({ request, thread })` rebuilds a chain head from a stored `thread`, so a follow-up can run
  in a later process: send a message, store `executed.thread` under the message's id, and come back to it later. A
  follow-up's composition reads only the root request, the thread and the follow-up, so the resumed call sends the
  same bytes and keeps the provider's prefix cache warm. Resuming an older message's thread branches there. What to
  store, the thread's shape and a full save / resume example are in
  [Saving and resuming a chain](prompt.md#saving-and-resuming-a-chain).
- **Records and taps.** `recorder.recordCallStart` fires before the send, `recordCall` once per execution, and
  `recordDecodeFailure` once when any decode row exists. The recorder gets the full in-memory record and owns any
  capture gate: persist `toLlmCallLogPayload(record, { keepIo, keepPhases })` (the flat row every reader and the tape
  read). A raw record nests its result, so it folds to zero usage and an empty tape.
  `taps` (held by reference) get `onDispatch`, `onDecodeFailure` and `onDispatchComplete` with the same record object.
  A decision records through the same recorder and fires `onDispatch` / `onDispatchComplete` (never
  `onDecodeFailure`); `event.decision` marks it on both events. `onGap` gets `prompt-raw-json`, `critique-fail` and
  `prompt-over-budget` (the call is still sent).
- **Host data.** Every hook that receives a request gets `{ lane, request }` — `lane: 'completion'` with the host's
  `R`, or `lane: 'decision'` with the decision request; narrow on `lane`. The dispatcher's last type parameter `E` is
  the host's decision-request fields (a scene, a tick): `decide` takes `LlmDecisionDispatchRequest<I, Q> & E`, and the
  decision branch's `request` is `LlmDecisionDispatchRequest & E`, so the hooks read them with no cast. `callAttributionOf` overrides the per-call
  context's attribution, `recordFieldsOf({ lane, kind })` adds the host's top-level fields to the `start` / `call` /
  `decode-failure` records and their tap events, and `resultOf` (completion only) builds the returned `X` from the
  library result and the `callProfile` snapshot (present when the context times).
- **Call context.** A dispatch or a decision nests under `request.callContext`, else under `recorder.newCallContext`,
  else under a context that does not time and sends its swallows to `swallow`.
- **Pause and cancellation.** `pause` (`isPaused` / `waitUntilResumed`) parks a dispatch before it sends (`paused`
  span, `llm-call-parked` diag), and again before every retry. `cancellationSignal` and `request.signal` are combined
  and forwarded to the strategy; either one aborting counts as a cancellation. A cancelled dispatch sends no further
  attempt: every retry decision reads cancellation like a spent budget, and a cancel during a transport backoff or a
  park ends the loop before the resend (the last row keeps the `willRetry: true` it was judged with).
- **Fakes.** `makeLlmDispatcherFake(fn)` (`@dereekb/llm/test`) wraps a bare dispatch function as a dispatcher whose prompts run through it.
- **Retry and lanes.** The bounded retry ladder, the fast-fix and critique lanes and the decision lane are described in
  [Retry and lanes](#retry-and-lanes) below.

A complete, runnable version is the README's [Quick start](../README.md#quick-start-define-a-capability-and-dispatch-it).

```ts
import { DEFAULT_LLM_MAX_OUTPUT_TOKENS, LLM_CALL_EVENT_TYPE, makeLlmSchemaValueValidator, makeLlmDispatcher, makeLlmStrategyRegistry, makeLlmTieredPromptTemplateResolver, toLlmCallLogPayload } from '@dereekb/llm';

const dispatcher = makeLlmDispatcher({
  strategies: makeLlmStrategyRegistry([strategy]),
  defaultStrategyId: strategy.id,
  defaultMaxOutputTokens: DEFAULT_LLM_MAX_OUTPUT_TOKENS,
  modelTiers: { fast: 'acme/fast', strong: 'acme/strong' },
  descriptorOf: (capability) => DESCRIPTORS[capability],
  templateResolver: makeLlmTieredPromptTemplateResolver({ tiers: [{ source: 'app', templates }] }),
  recorder: {
    // persist the flat row, never the record; keepIo also keeps the prompt and the reply, which a tape replays
    recordCall: (record) => log.write({ type: LLM_CALL_EVENT_TYPE, payload: toLlmCallLogPayload(record, { keepIo: true }) })
  }
});

const result = await dispatcher.dispatch({ capability: 'summarize', renderLiveContext, validate: makeLlmSchemaValueValidator(summarySchema) });

const first = await dispatcher.preparePrompt({ capability: 'summarize', renderLiveContext }).execute();
const next = await first.followUp({ content: 'Now the second item.' }).execute();

// later, in another process: resume from the thread stored under that message's id
const resumed = dispatcher.resumePrompt({ request: { capability: 'summarize', renderLiveContext }, thread: next.thread });
const last = await resumed.followUp({ content: 'Now the third item.' }).execute();
```

## Retry and lanes

A validated or critiqued dispatch runs a bounded loop: each rejected attempt is re-asked with a correction and at most
one retry lever, and a mangled JSON reply gets one cheap fast fix before any re-ask. Every rejected attempt lands on
`LlmCallRecord.failedAttempts` with its `correction` and `retry`. Decisions take their own lane on the same dispatcher.

- **Budget.** `maxAttempts` per request (or per follow-up), default `DEFAULT_LLM_DISPATCH_MAX_ATTEMPTS` (2), clamped to
  at least 1.
- **Corrections.** A re-ask carries one volatile segment under the layout's `correction` slot that holds only the latest
  failure: the validator's error, the critic's feedback or the decode class's words. `correctionTexts` overrides
  the words (merged over `DEFAULT_LLM_DISPATCH_CORRECTION_TEXTS`, `decode` per class).
- **Lever ladder.** One lever per retry, chosen by `chooseLlmRetryLever` for the failure's cause: the output budget ×4
  up to `LLM_RETRY_OUTPUT_BUDGET_CEILING` (it persists for the remaining attempts), the model to `decodeRetryTier`
  (default `strong` when the tier map has it; `off` / `none` in any case pins it off; an unknown key throws at
  construction), reasoning
  off / low, or structured output off. Each retry files a `retry-lever` diag and stamps `phases.attempts[].retry` and
  `failedAttempts[].retry`.
- **Transport lane.** A timeout re-asks at once, taking the `reasoning-off` rung when reasoning is on (otherwise the
  same bytes). Every other send error is classified by `classifyLlmError`: 408, 429, 5xx, a Node or browser network
  failure and the SDK's connection / rate-limit / server classes are `transient`; 400–404 are `permanent`; the rest is
  `unknown`. A transient error resends the identical bytes after `transportBackoff({ attempt, error })` (with a
  `transport-backoff` diag). The default, `llmTransportBackoffMs`, honors the server's wait when the thrown error carries
  one (`retry-after-ms`, else `Retry-After`, read off `error.headers` or `error.response.headers` by util/fetch
  `readFetchErrorRetryAfter`) and it is at most `LLM_TRANSPORT_RETRY_AFTER_MAX_MS` (60 s); otherwise util
  `exponentialBackoffDelay`: 500 ms doubling to 8 s, equal jitter. A host that wants to honor a longer wait passes its
  own `transportBackoff`. An `unknown`
  error goes to the dispatcher's `isRetryableUnknownError`: a `true` makes it behave exactly like a transient error (its
  rows carry `errorClassification: 'unknown'`). Anything not resent records an `unretryable` row (with
  `errorClassification`), the call record, the decode-failure record and `onDispatchComplete`, then the dispatch
  rejects with `LlmDispatchFaultError` (`cause` = the original error). A cancelled dispatch never retries.
- **Truncation.** A length-capped reply is not parsed while budget remains; `lengthCapped` is sticky on the result. A
  truncation a lever induced on the last attempt earns one bonus attempt (`LLM_RETRY_INDUCED_BONUS_ATTEMPTS`).
- **Fast fix.** `replyFastFix` (e.g. `makeLlmReplyFastFixer()`) repairs a mangled reply with one recorded
  `RepairReplyJson` dispatch, bounded by `fastFixLimits` (`DEFAULT_LLM_REPLY_FAST_FIX_LIMITS`). It never binds on a
  `RepairReplyJson` call, a `line` call or a call with no schema hint. It fails open: a miss or a throw falls through to
  the re-ask (`reply-fast-fix-miss` diag, swallow site `llm/reply-repair.fast-fix`). A fixer's `meta` lands on
  `result.repair.meta`, on the call payload's `repair` and on the failed rows; a miss's `meta` lands on its decode row
  as `fastFixMeta`, so a host can link the miss to the fix call it paid for.
- **Critique.** Root calls only, after `validate` passes. A rejection costs a re-ask with the critic's feedback and a
  `critique` failed row, never a decode row. A rejection with no retry left (the budget is spent, or the dispatch was
  cancelled) ships the reply: it is stamped accepted (`valueJson`, `clean` / `retried`), files no failed row, and its
  feedback files the `critique-fail` gap. A `line` reply is lifted to a value under `lineValueField` (default `line`) so the critic can read
  it.
- **Decision lane.** The optional `decisions` block (`strategies`, `strategyId`, `defaultModel`, `maxAttempts`) adds
  `decide`; no block, an empty registry or an unregistered pin leaves it absent.
  - **Model.** A per-call `model` / `tier`, then a capability route that names a decision model, then the descriptor's
    `model` / `tier`, then `defaultModel` (which replaces the default-tier rung). A capability's completion route never
    serves its decisions. A `defaultModel` that is not a decision model throws at construction; a slug from any other
    rung that is not a decision model throws per call, before anything is sent.
  - **Records and taps.** Each decision goes through the shared hooks (`lane: 'decision'`) and records one start and one
    call record, its state and questions as two `live`-slot segments, firing `onDispatch` / `onDispatchComplete`. A
    throwing `stamp` is swallowed at `llm/decide.stamp`.
  - **Resend.** A send that fails with an error `isRetryableLlmDecisionError` accepts (the same classifier and
    `isRetryableUnknownError` as the completion lane: a 408, a 429, a 5xx, a dropped socket, or a host-approved
    `unknown` error; never an abort, a timeout or an answer fault) is resent after `transportBackoff({ attempt, error })`
    — the same default, so a System One 429's `Retry-After` is honored (`LlmDecisionTransportError.headers`) — up to
    `maxAttempts` sends (default 2). Each failed send is a `failedAttempts` row and `result.attempts` counts the sends.
    A decision cancelled during the backoff, or while parked before the resend, is not resent.

```ts
import { resolveLlmCritiqueFields, makeLlmSchemaValueValidator, makeLlmDispatcher, makeLlmReplyFastFixer, makeLlmStrategyRegistry } from '@dereekb/llm';

const dispatcher = makeLlmDispatcher({
  ...config, // strategies, tiers, descriptors and templates as above
  replyFastFix: makeLlmReplyFastFixer(),
  decodeRetryTier: 'strong',
  decisions: { strategies: makeLlmStrategyRegistry([decisionStrategy]), defaultModel: 'typesafe/jev-1.14' }
});

const result = await dispatcher.dispatch({
  capability: 'summarize',
  renderLiveContext,
  maxAttempts: 3,
  validate: makeLlmSchemaValueValidator(summarySchema),
  ...resolveLlmCritiqueFields({ binding, capability: 'summarize', goal })
});

const routed = await dispatcher.decide?.({ capability: 'route-ticket', decision: ROUTE_TICKET, input: { ticket } });
```
