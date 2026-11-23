# Decisions

Entry: `@dereekb/llm/decision` (re-exported by `@dereekb/llm` from the same modules) · [← @dereekb/llm](../README.md)

A decision is `(state, questions) → answers`: the caller declares the answer space up front as typed questions and
a decision model (TypeSafe's Jev, served by OpenRouter and ZenMux) returns a position inside it plus a calibrated
distribution — no prompt string and no reply text. Three primitives:

| Builder | Asks | Answer |
|---|---|---|
| `llmChoiceQuestion(instructions, options)` | which of these options? | `choice`, one of the declared options; `probabilities` over every option summing to 1; `confidence` |
| `llmScoreQuestion(instructions, levels)` | which level on this rubric? | a `score` that may land between two levels, the distribution, `confidence` |
| `llmNoulQuestion(instructions, means?)` | is this true? | `noul` 0..1 — the probability is the uncertainty |

A Choice is RELATIVE (something always wins, even when two options are indistinguishable); a Noul is ABSOLUTE. Ask
"none of these fits" as a Noul beside the Choice. The question map is both the batching unit and the cost unit: the
state is ingested once and every question is evaluated against it independently, so declare every question an input
could need in one map.

## Declaring

- Every declaration surface takes a string, an object or an array (structured entries — `{ question, inspect }`,
  `{ what, not_for, examples }`, `{ what, signals }`), carried to the wire verbatim.
- Name state fields in backticks (`` `ticket.body` ``); `llmDecisionStatePaths` reads them back so a spec can pin
  them.
- `validateLlmDecisionQuestions` fails at the DECLARATION, naming the question, rather than as a 4xx about a body:
  no questions, blank instructions, a Choice outside 1..255 options (`LLM_DECISION_CHOICE_OPTIONS_MAX`), a Score
  outside 2..10 levels. The limits are transport limits of the decision route on every gateway. It returns
  `LlmDecisionValidation` (`{ valid, errors, warnings }`); a builder that refuses throws
  `LlmDecisionDeclarationError` (its `errors`, plus the `decision` key when a declared decision asked).

## On the wire

- `llmDecisionRequestBody({ model, state, questions })` builds exactly `{ model, state, questions }`, in that order,
  field by field — ZenMux answers 400 to any other key, so a host-extended request cannot leak one. These are the
  bytes the System One transport sends on every gateway.
- `LlmDecisionWireReply` (`id`, `model`, `provider`, `answers`, `usage`, every field optional) and
  `LlmDecisionWireUsage` (`input_tokens`, `output_tokens`, `cost`) are the reply side of the wire.
  `llmUsageFromDecisionUsage(usage, { costBasis })` is the one decision usage fold: input ⇒ prompt, output ⇒
  completion, their sum ⇒ total, and the cost (omitted when unreadable; the basis stamped only beside a cost).
- `llmDecisionWireQuestion` is the per-question mapping (an undescribed option is an explicit `null`; a Noul with no
  `means` omits `criteria`).
- `isLlmDecisionModelId` is the routing guard: decision models are not in a gateway's `/models` catalog, so the id
  (`typesafe/jev-1.13`, or bare `jev-…`) is the only discriminator.

## Reading

- `readLlmDecisionAnswers({ questions, raw })` membership-checks every answer against the question that asked it and
  returns the typed answers or EVERY fault (`answer-missing`, `answer-mistyped`, `choice-off-option`,
  `value-out-of-range`). Past it, a `choice` is a declared option, a `score` is in range and a `noul` is a
  probability — no consumer re-checks. `raw` takes any shape (the reader is the judge of what an answer is), and the
  value types are checked too: a non-number `noul`, `score` or distribution entry is `value-out-of-range`.
  `laxAnswerTypes: true` gives an answer that arrived with NO `type` its declared question's type first (a present
  `type` is never overwritten).
- `requireLlmDecisionAnswers(config)` is the throwing read: it returns the answers, or throws
  `LlmDecisionAnswerFaultError` with every fault. Pass `billing` (an `LlmDecisionReplyBilling`, which
  `llmDecisionReplyBilling` builds from a wire reply) and the error carries the faulted reply's `model`, `usage`,
  `generationId` and `provider`. That way a billed reply that faulted still reaches the ledger: the dispatcher's
  decision lane folds them onto the failed row. The System One transport passes it; the scripted decision strategy
  does not.
- `toLlmDecisionConfidenceBand`, `llmDecisionChoiceRanking`, `mapLlmDecisionChoiceRows` and
  `readLlmChoiceCertainty` (sure / nested / split / diffuse / unread, with site-owned floors) read a Choice's answer.

## Strategies

- `LlmDecisionStrategy extends LlmStrategyBase`, the decision sibling of `LlmStrategy`: `decide(request, options?)`
  takes `LlmDecisionRequest` (`{ state, questions, model }`) and returns `LlmDecisionResult` (the answering versioned
  `model`, `answers`, `usage`, `provider`, `generationId`). It throws rather than returning partial answers. Its
  `healthCheck` / `credentialProbe` are the base's, reporting `LlmStrategyHealth`. `LlmDecideOptions` extends
  `LlmCompleteOptions` (`signal`) with `timeoutMs`.
- Decision strategy kinds are `'openrouter-decisions'` (OpenRouter) and `'zenmux-systemone'` (ZenMux), each distinct
  from its route's completion kind (`'openrouter'`), so a ledger row never confuses the two lanes. A kind is a
  persisted `strategyKind`: OpenRouter's keeps the value existing ledgers already fold on, which is why it does not
  follow ZenMux's `<route>-systemone` form.
- A decision registry is `makeLlmStrategyRegistry(seed)` over decision strategies (an `LlmDecisionStrategyRegistry`);
  a kind's instances are `values().filter((s) => llmStrategyKind(s) === kind)` (`.at(-1)` the LAST registered),
  `values()[0]` the first.
- `verifyLlmStrategies({ strategies, required, lane: LLM_DECISION_STRATEGY_READINESS_LANE })` and
  `probeLlmCredentials({ strategies, required, signal, lane: LLM_DECISION_STRATEGY_READINESS_LANE })` gate launch on
  the decision backends and return the same `LlmStrategiesHealthReport`: verify throws one aggregated error, probe
  reports and never throws, a strategy without the seam counts as ready, and a throwing seam is recorded as an error
  issue. With that `lane`, issues and errors name a "decision strategy".
- `DEFAULT_LLM_DECISION_TIMEOUT_MS` (10s) is declared here and enforced by the System One transport.
- `LlmDecisionTransportError` (`status`, `body`, and `headers` when the route answered) and `isRetryableLlmDecisionError(error, isRetryableUnknownError?)`
  (408 / 429 / 5xx / socket failures, plus an `unknown` error the function approves; never an abort or a timeout) — the completion lane's retry posture, and what the dispatcher's decision lane resends
  by (see [Decision lane](dispatcher.md#retry-and-lanes)); a direct `strategy.decide()` / `decision.decide()` is never retried.
- `makeLlmSystemOneDecisionStrategy(config, hooks)` is the ONE decision transport, a plain `fetch` to
  `POST {baseUrl}/systemone` for every gateway that serves the route. The hooks define the gateway: `kind`, `label`,
  `defaultBaseUrl`, `generationIdHeader` (read when the body has no `id`), `costBasis`, `laxAnswerTypes` and
  `credentialProbe`. The config is the host's: `id`, `apiKey`, `apiKeyEnv` (a label for messages), `baseUrl`,
  `timeoutMs`, `decisionFetch` and `probeFetch` (both `ConfiguredFetch`). `toLlmSystemOneDecisionStrategyConfig` is the
  shared decision-adapter mapping (`id`, `apiKey`, `baseUrl`, `timeoutMs`, `fetch` → `probeFetch`); a gateway adds its
  own keys on top.
  - Failures: a timeout or abort rejects with the signal's reason (never wrapped); a socket failure is an
    `LlmDecisionTransportError` with the native error as its `cause`; a non-2xx carries `status`, the raw `body` and
    the response `headers` (never persisted; the dispatcher's default backoff reads `Retry-After` off them);
    a 2xx whose body is not a JSON object is a transport error with `status` and `body`; an answer fault throws
    `LlmDecisionAnswerFaultError` carrying the reply's bill; a missing key throws a status-less (never retried) transport error.
  - `healthCheck` is network-free. An injected `decisionFetch` makes a keyless fake (ready, no key needed). The global
    `fetch` is read at call time.
- `defineLlmDecision(descriptor)` returns an `LlmDecision<I, Q, D>`: a decision over one typed input: `state(input)` and `questions(input)`.
  Validation is lazy — `asRequest({ input, model })` validates and throws `LlmDecisionDeclarationError` naming the
  decision — and `decide({ strategy, input, model, options })` runs it.
  - Its third type parameter `D` is the descriptor's type, returned on `LlmDecision.descriptor` by identity. `D` is
    never inferred: a bare call types the descriptor as `LlmDecisionDescriptor<I, Q>`, so an unknown field fails to
    compile. A host whose descriptors carry more extends `LlmDecisionDescriptor` and names it through its own define
    wrapper, `(descriptor) => defineLlmDecision<I, Q, HostDecisionDescriptor<I, Q>>(descriptor)`; each call site still
    infers `I` / `Q`, and the decision still dispatches as an `LlmDecision<I, Q>`.
- `LlmDecisionDispatchRequest` is what `makeLlmDispatcher`'s decision lane (its `decisions` block) takes. It shares
  `LlmDispatchRequestBase` with a completion request — the consuming `capability`, host `meta`, model / tier
  overrides, the parent `callContext` and the `signal` — and adds the declared `decision`, its `input` and an optional
  `stamp`. A descriptor's own `model` / `tier` are `Pick<LlmCapabilityModelRef, 'tier' | 'model'>`. A host whose
  decision requests carry more (a scene, a tick) names those fields as the dispatcher's `E`: `decide` then takes
  `LlmDecisionDispatchRequest<I, Q> & E`, and the decision lane's hooks read them with no cast. A failed `decide` is
  recorded (`dropped`) and rejects with the original error
  ([Outcomes](dispatcher.md#outcomes-what-resolves-and-what-throws)).

```ts
import { llmChoiceQuestion, llmDecisionRequestBody, llmNoulQuestion, readLlmDecisionAnswers } from '@dereekb/llm/decision';

const questions = {
  team: llmChoiceQuestion('Which team should own `ticket`?', { billing: 'Charges and refunds', access: 'Sign-in and permissions' }),
  spam: llmNoulQuestion('`ticket` is unsolicited marketing rather than a real request.')
};

const body = llmDecisionRequestBody({ model: 'typesafe/jev-1.13', state: { ticket }, questions });
// … send `body` to the gateway's decision route …
const read = readLlmDecisionAnswers({ questions, raw: reply.answers });
read.answers?.team.choice; // 'billing' | 'access'
```

```ts
import { defineLlmDecision, llmChoiceQuestion } from '@dereekb/llm/decision';

const pickTeam = defineLlmDecision({
  decision: 'pick-team',
  describe: 'route one support ticket to its team',
  state: (input: { readonly ticket: string }) => ({ ticket: input.ticket }),
  questions: () => ({ team: llmChoiceQuestion('Which team should own `ticket`?', { billing: 'Charges', access: 'Sign-in' }) })
});

const { answers } = await pickTeam.decide({ strategy, input: { ticket }, model: 'typesafe/jev-1.13' });
```

## Coming from `@dereekb/openrouter`

The vocabulary moved here from `@dereekb/openrouter` under neutral names. JSON shapes are unchanged, and the old
names remain as `@deprecated` aliases of the same values and classes.

The deprecated classes ARE the `@dereekb/llm` classes, so a thrown fault's `.name` reads `LlmDecisionAnswerFaultError` /
`LlmDecisionDeclarationError` (not the old `OpenRouterDecision…` name); branch on `instanceof` (either name works).
Stored run-task error codes are unchanged. `@dereekb/openrouter` imports this vocabulary from `@dereekb/llm/decision`
(never the root), which also exports the `LlmGenerationId` type its `OpenRouterGenerationId` aliases.

| `@dereekb/openrouter` | `@dereekb/llm` |
|---|---|
| `OpenRouterDecision…` (the vocabulary types and the two error classes; not the five request types listed under "What stays") | `LlmDecision…` |
| `openRouterDecision{ChoiceOptionNames,ChoiceRanking,StatePaths,WireQuestion}` | `llmDecision…` |
| `openRouter{Choice,Score,Noul}Question` | `llm{Choice,Score,Noul}Question` |
| `OPENROUTER_DECISION_…` | `LLM_DECISION_…` |
| `{map,validate,read}OpenRouterDecision…`, with `MapOpenRouterDecisionChoiceRowsConfig` / `ReadOpenRouterDecisionAnswersConfig` | `{map,validate,read}LlmDecision…`, with `MapLlmDecisionChoiceRowsConfig` / `ReadLlmDecisionAnswersConfig` |
| `asOpenRouterDecisionConfidenceBand` | `toLlmDecisionConfidenceBand` |
| `isBlankOpenRouterDecisionEntry` | `isBlankLlmDecisionEntry` |
| `OpenRouterStorableDecisionState` | `LlmStorableDecisionState` |
| `OpenRouterSystemOneModelId` / `isOpenRouterSystemOneModelId` / `OPENROUTER_SYSTEM_ONE_MODEL_NAMESPACE` | `LlmDecisionModelId` / `isLlmDecisionModelId` / `LLM_DECISION_MODEL_NAMESPACE` |

### Moving the transport

The names above are aliases. The OpenRouter transport itself is not, and it stays in `@dereekb/openrouter`,
undeprecated, for hosts that keep the SDK. A host moving decisions onto llm swaps three calls:

| `@dereekb/openrouter` | `@dereekb/llm` | What changes |
|---|---|---|
| `openRouterDecision(…)` | `makeLlmOpenRouterDecisionStrategy({ apiKey })` (`/openrouter`), then `strategy.decide(request)`, or a dispatcher's `decide` (records, resends, routing) | No SDK. Errors are `LlmDecisionTransportError` or the abort reason, and the result is `{ model, answers, usage?, provider?, generationId? }`, with one generation id. A direct `strategy.decide` validates neither the model nor the questions, so validate first with `defineLlmDecision` (`asRequest` / `decide`) or `validateLlmDecisionQuestions`. |
| `openRouterDecisionRequestBody(…)` | `llmDecisionRequestBody({ model, state, questions })` | Sends exactly those three keys. `provider`, `user`, `session_id` and `trace` are dropped (ZenMux refuses them), so attribution lives on your own call record, keyed by `generationId`. |
| `openRouterRunUsageFromDecisionsUsage(usage)` | `llmUsageFromDecisionUsage(usage, { costBasis })` | Returns an `LlmUsage` (`promptTokens`, `completionTokens`, `totalTokens`, `cost?`), not `OpenRouterRunUsage`. |

What stays in `@dereekb/openrouter`, none of it deprecated: `openRouterDecisionRequest`, `openRouterDecisionRequestBody`
(the SDK's `DecisionsRequest`: llm's body plus `provider`, `user`, `session_id` and `trace`),
`splitOpenRouterDecisionModelConfig`, `validateOpenRouterDecisionRequest`, `openRouterRunUsageFromDecisionsUsage`, the
`OPENROUTER_JEV_*` ids, `DEFAULT_OPENROUTER_SYSTEM_ONE_MODEL_ID`, the five request types (`OpenRouterDecisionSessionId`,
`OpenRouterDecisionRequest`, `OpenRouterDecisionRequestParams`, `OpenRouterDecisionResult`, `OpenRouterDecisionParams`)
and the `openRouterDecision` transport, which keeps its own SDK transport. To move off it, see
[Moving the transport](#moving-the-transport). `@dereekb/llm/openrouter`'s decision strategy
(`makeLlmOpenRouterDecisionStrategy`) is a hook set over the core System One transport and never imports
`@dereekb/openrouter`.
