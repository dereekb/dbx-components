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
  without it throws there. Construction does not check `defaultStrategyId`. A dispatch whose selected strategy is not
  registered throws `no LLM strategy registered for '…'`, naming the registered ones, before anything is recorded.
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
  (default `makeLlmPromptCachePrefixWatch()`, 1,000 partitions) observes the prefix per capability and
  `cachePartitionOf(request)`, filing `prefix-changed` when it moves. Pass a watch sized to your partition count when
  `cachePartitionOf` keys by subject.
  `isRawJsonBlock` turns on the raw-JSON watch (skipped for a `rawJsonContext` descriptor). A follow-up is one segment
  under the layout's `follow-up` slot id, sent over the replayed `thread` with no cache split and no attachments.
- **Single-shot.** With no `validate` and no `critique`, the call is one send with no re-ask, and the strategy
  result comes back unchanged. A reply that nearly parses is repaired for free (`reply-repaired` diag, no decode
  row); the single-shot path never calls the fast fix. A failed send is recorded, then rethrown, rejected or
  dropped as [Outcomes](#outcomes-what-resolves-and-what-throws) lays out.
- **Validated.** With a `validate` (or a `critique`) the call runs the bounded retry loop (see [Retry and lanes](#retry-and-lanes)). Each
  reply is read, repaired, validated, then critiqued, and the result is stamped `attempts`, `decodeStatus`,
  `decodeOutcome`, `lengthCapped`, `valueJson` and `validationErrors`. A decline, or a `line` reply that is not JSON, is
  accepted. Each rejected attempt records a decode row (critique rejections excepted), a `failedAttempts` row and an
  `onDecodeFailure` tap event whose `willRetry` is the retry decision made when the attempt was judged. How the loop
  ends (accepted, `dropped` or rejected) is in [Outcomes](#outcomes-what-resolves-and-what-throws).
- **Follow-ups.** `preparePrompt(request)` returns an `LlmPrompt` whose `execute()` runs once and whose `followUp(…)`
  chains onto the same thread; `dispatch(request)` equals `preparePrompt(request).execute()` unwrapped. A validated
  dispatch whose replies failed to decode and never recovered replays as `degenerateThreadPlaceholder`. Every other
  reply replays as returned, cut at `threadTurnMaxChars` ([Prompt handles](prompt.md)). `makeLlmPromptChain` works over it unchanged: the root renders its
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
- **Host data.** Every hook that receives a request gets `{ lane, request }` (an `LlmDispatchLaneRequest`) — `lane: 'completion'` with the host's
  `R`, or `lane: 'decision'` with the decision request; narrow on `lane`. The dispatcher's last type parameter `E` is
  the host's decision-request fields (a scene, a tick): `decide` takes `LlmDecisionDispatchRequest<I, Q> & E`, and the
  decision branch's `request` is `LlmDecisionDispatchRequest & E`, so the hooks read them with no cast. `callAttributionOf` overrides the per-call
  context's attribution, `recordFieldsOf({ lane, request, kind })` (an `LlmDispatchRecordFieldsParams`) adds the host's top-level fields to the `start` / `call` /
  `decode-failure` records and their tap events, and `resultOf` (completion only) builds the returned `X` from the
  library result and the `callProfile` snapshot (present when the context times).
- **Call context.** A dispatch or a decision nests under `request.callContext`, else under `recorder.newCallContext`,
  else under a context that does not time and sends its swallows to `swallow`.
- **Pause and cancellation.** `pause` (`isPaused` / `waitUntilResumed`) parks a dispatch before it sends (`paused`
  span, `llm-call-parked` diag), and again before every retry. `cancellationSignal` and `request.signal` are combined
  and forwarded to the strategy; either one aborting counts as a cancellation. A cancelled dispatch sends no further
  attempt: every retry decision reads cancellation like a spent budget, and a cancel during a transport backoff or a
  park ends the loop before the resend (the last row keeps the `willRetry: true` it was judged with). Attempt 1 is
  always sent, even after a cancel during the park ([Outcomes](#outcomes-what-resolves-and-what-throws)).
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
  rows carry `errorClassification: 'unknown'`). A send error that is not resent — `permanent`, or `unknown` without
  the hook's `true` — records an `unretryable` row (with `errorClassification`), the call record, the decode-failure
  record and `onDispatchComplete`. The dispatch then rejects as `LlmDispatchFaultError`, with the original error as
  `cause`, even when cancelled. A timeout or transient error is never a fault. When the budget runs out, or the
  dispatch is cancelled, the dispatch resolves `dropped` ([Outcomes](#outcomes-what-resolves-and-what-throws)). A
  cancelled dispatch never retries.
- **Truncation.** A length-capped reply is not parsed while budget remains; `lengthCapped` is sticky on the result. A
  truncation on the last attempt that followed a `reasoning-low` retry earns one bonus attempt
  (`LLM_RETRY_INDUCED_BONUS_ATTEMPTS`), sent with `LLM_RETRY_BONUS_LEVER` (reasoning off). No other lever earns one.
- **Fast fix.** `replyFastFix` (e.g. `makeLlmReplyFastFixer()`) repairs a mangled reply with one recorded
  `RepairReplyJson` dispatch, bounded by `fastFixLimits` (`DEFAULT_LLM_REPLY_FAST_FIX_LIMITS`). It never binds on a
  `RepairReplyJson` call, a `line` call or a call with no schema hint. It fails open: a miss or a throw falls through to
  the re-ask (`reply-fast-fix-miss` diag, swallow site `llm/reply-repair.fast-fix`). A fixer's `meta` lands on
  `result.repair.meta`, on the call payload's `repair` and on the failed rows; a miss's `meta` lands on its decode row
  as `fastFixMeta`, so a host can link the miss to the fix call it paid for. A malformed, object-led reply the repair
  lane leaves alone files one `reply-repair-refused` diag naming why (`LlmReplyRepairRefusal`). The reasons:
  - `unclean-finish`: the reply did not stop cleanly
  - `truncated-looking`
  - `low-score`: scored as not JSON, or under the fast fix's `minScore`
  - `fast-fix-off`: no fixer is bound
  - `no-schema`: eligible, but no schema hint
  - `mangled`: the single-shot path, which never calls the fast fix
  - `fast-fix-spent`: the dispatch's one fix is used
  - `too-long`: past the fast fix's `maxChars`
- **Critique.** Root calls only, after `validate` passes. A rejection costs a re-ask with the critic's feedback and a
  `critique` failed row, never a decode row. A rejection with no retry left (the budget is spent, or the dispatch was
  cancelled) ships the reply: it is stamped accepted (`valueJson`, `clean` / `retried`), files no failed row, and its
  feedback files the `critique-fail` gap. A `line` reply is lifted to a value under `lineValueField` (default `line`) so the critic can read
  it.
- **Decision lane.** The optional `decisions` block (`strategies`, `strategyId`, `defaultModel`, `maxAttempts`) adds
  `decide`; no block, an empty registry or an unregistered pin leaves it absent. Absent means silent: no throw and no
  diag, and `decide?.(…)` answers `undefined` without sending. A host that needs decisions checks
  `dispatcher.decide != null` at startup.
  - **Model.** A per-call `model` / `tier`, then a capability route that names a decision model, then the descriptor's
    `model` / `tier`, then `defaultModel` (which replaces the default-tier rung). A capability's completion route never
    serves its decisions. A `defaultModel` that is not a decision model throws at construction; a slug from any other
    rung that is not a decision model throws per call, before anything is sent.
  - **Records and taps.** Each decision goes through the shared hooks (`lane: 'decision'`) and records one start and one
    call record, its state and questions as two `live`-slot segments, firing `onDispatch` / `onDispatchComplete`. A
    throwing `stamp` is swallowed at `llm/decide.stamp`. A decision that fails is recorded the same way, with
    `decodeStatus: 'dropped'` and a `failedAttempts` row per send. That covers every send spent, a send error that is
    not resent, an answer fault and a cancel. `decide` then rejects with the original error, never
    `LlmDispatchFaultError`, and files no decode-failure record
    ([Outcomes](#outcomes-what-resolves-and-what-throws)).
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

## Outcomes: what resolves and what throws

What a call hands back depends on whether it is validated (a `validate`, or a root `critique`) and on how its sends
fail. Everything below except the last list is recorded (the call record and `onDispatchComplete`) before the call
resolves or rejects.

**`dispatch()`**

| What happened | Single-shot | Validated |
|---|---|---|
| A reply is accepted | Resolves the strategy's result unchanged (a near-miss repaired for free). | Resolves, stamped `decodeStatus: 'clean'` or `'retried'`. |
| Every attempt's reply is rejected (no JSON, schema, critique) | — | Resolves `decodeStatus: 'dropped'` with the last reply's text. |
| A timeout or transient send error (408, 429, 5xx, a network failure) | Recorded, then the original error is rethrown unchanged. | Resent. Once the budget is spent, resolves `dropped` with `text: ''` and `finishReason` `__timeout__` / `__transport__`. |
| An `unknown` send error (a 409; a plain `Error`, such as a strategy's own "no model configured") | Recorded, then rejects with `LlmDispatchFaultError`. `isRetryableUnknownError` is never asked. | Resent like a transient error when `isRetryableUnknownError` answers `true`. Otherwise recorded, then rejects with `LlmDispatchFaultError`. |
| A `permanent` send error (400–404) | Recorded, then rejects with `LlmDispatchFaultError`. | The same, at whichever attempt hit it. |
| Cancelled while a send is in flight | Resolves `{ text: '', finishReason: '__timeout__' / '__transport__' }`, unstamped (no `decodeStatus`). | Resolves `dropped` with `text: ''`. |
| Cancelled between attempts (a backoff, a park, a slow critic) | — | Sends nothing more. Resolves `dropped` with the last reply's text. |
| Cancelled, and the send fails `permanent` / `unknown` | Rejects with `LlmDispatchFaultError`. | Rejects with `LlmDispatchFaultError`. |

- Attempt 1 is always sent. A dispatch cancelled while parked before it still sends it, with the aborted signal; a
  stock strategy rejects at once. It then ends as "cancelled while a send is in flight".
- `LlmDispatchFaultError` (`isLlmDispatchFaultError`) carries `fault: 'unretryable'`, `capability`, `attempt`,
  `summary`, `classification` (`permanent` / `unknown`) and the original error as `cause`.

**`decide()`**

| What happened | Outcome |
|---|---|
| Answered | Resolves an `LlmDecisionResult` (`model`, `answers`, `usage`, `provider`, `generationId`). |
| A transient send error, or an `unknown` one that `isRetryableUnknownError` approves | Resent after `transportBackoff`, up to `decisions.maxAttempts` sends (default 2). Still failing, it is recorded `dropped` and rejects with the last send's error. |
| A timeout, a `permanent` or unapproved `unknown` send error, or an answer fault (`LlmDecisionAnswerFaultError`) | Never resent. Recorded `dropped`, then rejects with the original error. An answer fault's bill is folded onto the row. |
| Cancelled while a send is in flight | Rejects with the abort reason. The System One transport rejects with `signal.reason`, never wrapped. |
| Cancelled during a backoff, or while parked before a resend | Not resent. Rejects with the last send's error (a 503, say), not the abort reason. |
| Cancelled while parked before the first send | The first send still goes out, with the aborted signal, and rejects with the abort reason. |

A failed decision is never an `LlmDispatchFaultError`, and it files no decode-failure record and no
`onDecodeFailure`.

**Thrown before anything is recorded**

These plain `Error`s, and a host hook's own throws, leave no start record, call record or tap event:

- An unregistered strategy: `llm dispatcher: no LLM strategy registered for '…' (…; registered: …).`
- An unknown tier on the request or the descriptor: `unknown model tier '…' (have: …).`
- A template resolver or contributor that throws, rethrown unchanged. Also the prompt seam's own refusals: a
  contribution to an undeclared slot, an assembly-owned slot, or a second contribution to a single slot; and bytes
  the layout has no slot for.
- A throw from a host hook that runs before the send (`renderLiveContext`, `descriptorOf`, `selectStrategy`,
  `cachePartitionOf`, `callAttributionOf`, `recorder.newCallContext`). Also a descriptor schema with no JSON form,
  and a `pause` gate that rejects.
- `decide()` only: a model that is not a decision model (`llm dispatcher: decision '…' for '…' (the … rung): …`),
  and `LlmDecisionDeclarationError` from the decision's questions.

`makeLlmDispatcher` itself throws for a tier map without the default tier, a `decodeRetryTier` the map lacks, and a
`decisions.defaultModel` that is not a decision model. A throwing `isRetryableUnknownError` or `recorder.recordCall`
propagates unchanged after the start record, before the call record.

## Config reference

Every `LlmDispatcherConfig` key, required keys first.

| Key | Default | What it does |
|---|---|---|
| `strategies`, `defaultStrategyId`, `defaultMaxOutputTokens`, `modelTiers`, `descriptorOf`, `templateResolver` | required | The registry, the provider a binding-less call routes to, the cap of last resort, the tier map, the capability lookup and the template source ([Dispatcher](#dispatcher)). |
| `defaultTier` | `fast` when blank | The tier a call names when nothing else does. |
| `capabilityRoutes` | none | `compileLlmModelRouting(…)`'s output. A route ranks above the descriptor in the model and cap ladders ([Model routing](model-config.md#model-routing)). |
| `providerByModel` | none | Slug → provider, usually `llmModelProviderBindings(file)`. |
| `selectStrategy` | none | Picks the strategy per request, replacing the provider policy (completions only). |
| `reasoningDefault` | `LLM_REASONING_OFF` | The reasoning a call gets when nothing names one. |
| `visionByModel` | none | Per-slug vision flags, read only by `dispatcher.capabilityVision`. |
| `layout`, `contributors`, `texts` | `DEFAULT_LLM_PROMPT_LAYOUT`, none, `DEFAULT_LLM_PROMPT_ASSEMBLY_TEXTS` | The prompt's slots, the host's contributors and the assembly's fixed text ([Prompt assembly](prompt.md)). |
| `defaultReplyProtocol` | `json` | The host default in `resolveLlmReplyProtocol`. The built-in judge and fixer inherit it. |
| `describeResponseSchemaHint` | off | Keeps a request hint's `description` prose instead of stripping it. |
| `replyEnvelope` | `value` / `answerable` / `rationale` | The keys a `json-envelope` reply is read with ([Replies](replies.md)). |
| `promptCacheWatch`, `cachePartitionOf`, `isRawJsonBlock` | `makeLlmPromptCachePrefixWatch()` (1,000 partitions), none, off | The prefix watch, its partition key, and the raw-JSON watch. |
| `degenerateThreadPlaceholder`, `threadTurnMaxChars` | `DEFAULT_LLM_DEGENERATE_THREAD_PLACEHOLDER`, `DEFAULT_LLM_THREAD_TURN_MAX_CHARS` (8,000) | What a validated dispatch that never decoded records as its reply turn, and where a recorded reply is cut ([Prompt handles](prompt.md)). |
| `recorder`, `taps`, `onGap`, `swallow` | none | Where records, tap events, gaps and swallowed errors go ([Records](records.md)). |
| `callAttributionOf`, `recordFieldsOf`, `resultOf` | none | The host-data hooks ([Dispatcher](#dispatcher)). |
| `decodeRetryTier` | `strong` when the tier map has it | The tier the model lever escalates to. `off` / `none` pins it off. |
| `correctionTexts`, `transportBackoff`, `isRetryableUnknownError` | `DEFAULT_LLM_DISPATCH_CORRECTION_TEXTS`, `llmTransportBackoffMs`, none (an `unknown` error is never resent) | The re-ask words, the resend delay, and the `unknown`-error resend hook ([Retry and lanes](#retry-and-lanes)). |
| `replyFastFix`, `fastFixLimits` | none, `DEFAULT_LLM_REPLY_FAST_FIX_LIMITS` | The fast fix and its bounds. |
| `decisions` | none (no `decide`) | `{ strategies, strategyId?, defaultModel, maxAttempts? }`. An unregistered `strategyId` silently removes `decide`. |
| `pause`, `cancellationSignal` | none | The host pause gate and a dispatcher-wide cancel. |

- **Per request, not config.** `maxAttempts` (default `DEFAULT_LLM_DISPATCH_MAX_ATTEMPTS`, 2), `maxPromptTokens`
  (over it, the `estimatedPromptTokens` estimate files the `prompt-over-budget` gap and the call is still sent),
  `signal`, `site`, `model` / `tier`, `validate` and `critique`.
- **`promptAddendum` needs its contributor.** A `models.json` per-slug `promptAddendum` reaches a prompt only through
  `makeLlmModelAddendumPromptContributor({ promptAddendumByModel: llmModelPromptAddenda(file) })` in `contributors`.
  The dispatcher has no addendum key of its own.
- **Register the built-in judge and fixer.** A host using a critique policy or `replyFastFix` returns
  `LLM_CRITIQUE_REPLY_DESCRIPTOR` / `LLM_REPAIR_REPLY_JSON_DESCRIPTOR` from `descriptorOf`, and adds their templates
  as the lowest tier. Missing, nothing throws, but both fail open and degrade: there is no output contract or
  must-resolve clause, the judge loses `response_format`, the caps fall to the defaults, and the instructions slot is
  empty.
