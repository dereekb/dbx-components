# @dereekb/llm

A framework-free, provider-agnostic LLM layer: the transport contract every provider strategy implements, model and
provider configuration, prompt assembly with provenance, reply repair and validation, a dispatcher with a retry
ladder, usage accounting, and a decision lane for short structured answers. It has no Angular, Nest or Firebase
dependency, and its browser entries run unchanged in a browser, a worker or Node.

> **Status: under construction.** The entry points below are published now and fill in over the next releases. The
> API may change in any release until the prompt-building layer lands — pin an exact version meanwhile.

## Entry points

| Entry | Node | SDK | Purpose |
|---|---|---|---|
| `@dereekb/llm` | no | none | The strategy contract and runner, call records, model and provider configuration, adapters, prompt assembly, reply repair and validation, the dispatcher and retry ladder, usage accounting, and utilities. |
| `@dereekb/llm/decision` | no | none | The decision lane: questions, the wire format and answer reader, confidence, and the decision strategy contract. Re-exported by the root entry from the same modules, so both share one copy. |
| `@dereekb/llm/openai` | no | `openai` (optional, lazy) | The OpenAI-compatible chat strategy (OpenAI, ZenMux chat, a local vLLM) and its completion adapter. |
| `@dereekb/llm/openrouter` | no | `openai` + `@openrouter/sdk` (optional, lazy) | The OpenRouter chat strategy (`cache_control`, strict `response_format`, usage accounting), the OpenRouter decision strategy and their adapters. |
| `@dereekb/llm/zenmux` | no | none (`fetch`) | ZenMux constants and cost basis, the decision strategy, the quota-status source and the bill reader. |
| `@dereekb/llm/node` | yes | none | Model-config file IO, environment variables to provider configs, and the craft-folder loader. |
| `@dereekb/llm/test` | test infra | none | Tape replay, scripted completion and decision strategies, and the billed-lane test factories. |

## Browser safety

The root, `/decision`, `/openai`, `/openrouter` and `/zenmux` entries are browser-safe:

- They import no `node:` module or Node builtin and never read `process`. Hosts pass configuration (API keys, base
  URLs, model lists) in; nothing is read from the environment. Reading the environment or the file system is the job
  of `/node`.
- `openai` and `@openrouter/sdk` are **optional** peers. Each is loaded lazily from exactly one boundary module of the
  entry that needs it, so importing an entry never loads an SDK. Install an SDK only for the strategy that uses it.

These rules are enforced, not just documented:

- Each entry has an `*.isolation.spec.ts` that scans its own source for `node:` imports, `process` reads and SDK
  imports outside the boundary module, and loads the entry with the SDKs mocked to prove neither is evaluated. No
  entry may import `@dereekb/openrouter`.
- The browser entries compile with `types: []`, so a Node API or `process` reference fails the build's typecheck.

## Strategy contract

A **strategy** is one configured backend: an `LlmRequest` goes in, an `LlmCompletion` comes out, and it never parses
the reply. `id` names the instance; `kind` names the transport (it defaults to `id`; read it with `llmStrategyKind`),
so several instances of one transport can be registered side by side.

- **Call types.** `LlmRequest` carries the prompt and capability, the per-call model, output cap and reasoning, the
  cache split, the prompt segments, a prior thread and image attachments. `LlmCompletion` carries the text, which
  strategy and model served it, usage and timing. `LlmDispatchResult` is a completion plus what a dispatcher adds:
  attempts, validation errors, decode status and the reply repair. Host data rides `meta`: the library never reads it
  and strategies echo it. `LlmRunner` is the text-in / text-out seam a strategy can call instead of its transport.
- **Registry.** `makeLlmStrategyRegistry(seed)` answers `get(id)` and `getBy('kind', kind)` (the last registered
  instance of that transport); `llmStrategyInstancesOfKind` lists them all. It is built on `createKeyedRegistry`, a
  generic multi-index registry.
- **Readiness.** Three optional seams: `healthCheck` (no network), `credentialProbe` (one free authenticated request)
  and `providerStatus` (account windows and balance). `verifyLlmStrategies` throws when a required strategy is
  missing or not ready; `probeLlmCredentials` and `readLlmProviderStatus` report and never throw (one status read per
  account).
- **Quota gate.** `evaluateLlmQuotaGate({ report })` refuses only when a measured window is above the ceiling (90% by
  default) and fails open whenever nothing is measured.
- **Usage and bills.** `llmUsageFrom(raw, { costBasis })` folds a provider usage block: token counts default to `0`,
  every other field is omitted when not reported (absent is not zero), and numeric-string costs are parsed. An
  `LlmCallBillReader` reads what a call billed, later, by its generation id.
- **Prompt segments.** An `LlmPromptSegment` carries its exact bytes (trailing separator included) and an open
  `origin`. `joinLlmPromptSegments` builds the sent string, `llmPromptCacheSegmentsOf` splits it for provider caching
  (the prefix is everything before the first volatile segment), `llmPromptSegmentSpans` derives highlight spans, and
  `isLlmPromptSegment` / `isLlmPromptSegmentArray` guard persisted payloads.

```ts
import { makeLlmStrategyRegistry, verifyLlmStrategies, type LlmStrategy } from '@dereekb/llm';

const echo: LlmStrategy = {
  id: 'echo',
  describe: 'Replies with the prompt',
  caching: 'none',
  complete: async (request) => ({ text: request.prompt, strategyId: 'echo', capability: request.capability })
};

const strategies = makeLlmStrategyRegistry([echo]);
await verifyLlmStrategies({ strategies, required: ['echo'] }); // throws when a required strategy is missing or not ready
```

```ts
import { evaluateLlmQuotaGate, readLlmProviderStatus } from '@dereekb/llm';

const report = await readLlmProviderStatus({ strategies, required: ['gateway'] });
const verdict = evaluateLlmQuotaGate({ report }); // { allowed, reason, usedFraction? }
```

## Call records and observability

What a dispatcher records about each call, and the seams a host observes it through.

- **Errors.** `isAbortError` (a client deadline or cancel), `isRetryableLlmError` (an identical resend could succeed:
  connection failures, 429, 5xx, raw socket failures; never another 4xx) and `llmErrorSummaryOf` (one bounded log
  line naming what was thrown). Test `isAbortError` first: a connection timeout matches both.
- **Decode failures.** The six `LlmDecodeFailureClass`es, `classifyLlmDecodeFailure` (the failure family) and
  `classifyLlmReplyOutcome` (what the reply looked like), the finish-reason predicates (`isLlmLengthCappedFinish`,
  `isLlmCleanStopFinish`, `isLlmReasoningOnlyReply`), the two sentinels a dispatcher stamps on a synthesized reply
  (`LLM_TIMEOUT_FINISH_REASON`, `LLM_TRANSPORT_FINISH_REASON`) and the bounded excerpt helpers.
- **Retry lever.** `chooseLlmRetryLever` picks the ONE thing the next attempt changes (budget, model, reasoning off /
  low, structured output off, or nothing, with the reason); `applyLlmRetryLever` applies it.
- **Call records.** `LlmCallRecord`, `LlmCallStartRecord`, `LlmDecodeFailureRecord` and their event-type tags. A host's
  own fields sit at the top level: pass them as `H`. `llmCallTelemetry` projects the per-call telemetry block.
- **Call context.** `makeLlmCallContext` records spans, marks, children and detached roots into a nested profile;
  gaps, breadcrumbs and swallows go to the host's callbacks with the context's attribution, timing on or off.
  `noopLlmCallContext()` is the shared do-nothing context.
- **Taps.** `makeLlmDispatchTapRegistry` is a read-only observation seam: a tap that throws is counted in `health()`,
  never propagated. `makeLlmDispatchCollector` keeps every event.
- **Swallow sites.** `LlmSwallowSink`, the declaration vocabulary, `LLM_SWALLOW_SITES` (the library's declared
  fail-open catches) and `makeLlmSwallowSiteRegistry` to merge them with a host's own.

```ts
import { makeLlmCallContext, type LlmCallRecord } from '@dereekb/llm';

interface RequestAttribution {
  readonly requestId?: string;
  readonly tenantId?: string;
}

type AppCallRecord = LlmCallRecord<RequestAttribution>; // requestId / tenantId sit beside capability, prompt, result…

const context = makeLlmCallContext<RequestAttribution>({
  label: 'request',
  attribution: { requestId: 'r1' },
  onDiag: (record, attribution) => logger.debug({ ...attribution, ...record }),
  onSwallow: (site, cause, attribution) => logger.warn({ site, cause, ...attribution })
});

await context.child('attempt-1').timeAsync('complete', () => strategy.complete(request));
const profile = context.profile(); // nested spans, marks, breadcrumbs and swallows
```

```ts
import { isAbortError, isRetryableLlmError, llmErrorSummaryOf } from '@dereekb/llm';

try {
  return await strategy.complete(request);
} catch (error) {
  if (isAbortError(error) || isRetryableLlmError(error)) {
    logger.info(`resending: ${llmErrorSummaryOf(error)}`);
  }

  throw error;
}
```

## Model configuration

Which models a host runs, and which backend serves each one, is configuration rather than code. The library holds the
pure half — the file shape, a fail-loud parse, the overlay of a host's built-ins, and resolution. It reads no
environment variable and no file: `/node` does that, and a browser host passes the parsed JSON in.

- **Tiers.** A capability names a tier (`fast`, `strong`, or any key a host adds), never a slug.
  `resolveLlmModelTiers({ base, modelTiers, defaultTier })` merges the host's declaration over its own base map and
  fails loud when the default tier (`fast` unless set) is missing; `resolveLlmModelTier` fails loud on an unknown key.
  A tier value is a slug or `{ model, maxOutputTokens?, reasoning? }` — read it with `llmTierModelOf` /
  `llmTierConfigOf`. The library ships no slugs.
- **The file.** `parseLlmModelConfigFile({ raw, source, schema })` validates a `models.json`-shaped object: named
  `providers`, `profiles` (complete tier maps), per-slug `models` facts, `active`, and the unread `notes` / `$schema`.
  An unknown key, an illegal value or a malformed tier throws an error naming the file and the entry, so a typo
  reddens startup instead of billing the model you meant to leave. A provider names the env var holding its key
  (`apiKeyEnv`), never the key.
- **Schema and extensions.** `makeLlmModelConfigSchema({ label, transports, meterings, decisionRoutes,
  implicitProviders, retiredKeys, extension })` sets the legal values and the error label. An extension adds provider
  and model keys with their parsers, transports it owns (providers that serve no completions), patch entries (an entry
  with no transport, base URL or key var that extends the built-in provider of the same name) and metering sources. A
  retired key fails with the remedy you register.
- **Overlay.** `overlayLlmModelConfigFile({ base, file, source, schema })` lays a host's file over its built-ins. A
  provider, profile or per-slug entry the file names replaces the built-in whole — a half-replaced provider would bill
  one account at another's endpoint — and every `models[slug].provider` is then checked against the merged providers.
- **Resolution.** `resolveLlmModelProfile({ file, override, schema })` picks the active profile: the override wins,
  `off` / `none` select nothing, and a name the file lacks throws. `llmModelReasoningOffEncodings`,
  `llmModelVisionCapabilities`, `llmModelPromptAddenda` and `llmModelProviderBindings` project the per-slug facts.
  `resolveLlmProviderConfigs({ providers, schema, apiKeyOf })` turns declared providers into `LlmProviderConfig`s that
  carry the key value, and lists the declared providers whose key is missing.
- **Wire vocabulary.** `LLM_REASONING_OFF_ENCODINGS` (how an OpenAI-compatible wire says "reasoning off":
  `effort-none`, `effort-minimal`, `nested-disabled`, `omit`), `llmReasoningOffEncodingFor` (the slug's own, then the
  fallback, then `effort-none`), `LLM_TOKEN_LIMIT_PARAMS`, and the per-slug `LlmModelReasoningOffMap` /
  `LlmModelVisionMap` the transports read.

```json
{
  "active": "balanced",
  "providers": { "local": { "transport": "openai", "baseUrl": "http://192.168.1.50:8000/v1", "apiKeyEnv": "LOCAL_API_KEY" } },
  "profiles": { "balanced": { "fast": "local/qwen-27b", "strong": "deepseek/deepseek-v4.1-flash" } },
  "models": { "local/qwen-27b": { "provider": "local", "reasoningOff": "omit" } }
}
```

```ts
import { makeLlmModelConfigSchema, overlayLlmModelConfigFile, parseLlmModelConfigFile, resolveLlmModelProfile, resolveLlmModelTiers, resolveLlmProviderConfigs } from '@dereekb/llm';

const schema = makeLlmModelConfigSchema({ label: 'my-app models', transports: ['openai', 'openrouter'] });
const file = parseLlmModelConfigFile({ raw: JSON.parse(text), source: 'models.json', schema });
const effective = overlayLlmModelConfigFile({ base: BUILT_IN_MODEL_CONFIG, file, source: 'models.json', schema });
const profile = resolveLlmModelProfile({ file: effective, override: requestedProfile, schema });
const { tiers, defaultTier } = resolveLlmModelTiers({ base: BUILT_IN_TIERS, modelTiers: profile?.tiers });
const { providers, gaps } = resolveLlmProviderConfigs({ providers: effective.providers, schema, apiKeyOf: ({ entry }) => keys[entry.apiKeyEnv] });
```

## Model routing

A host moves a capability to another model without touching code. Routing rules map capabilities — by key or by tag —
onto a tier or a slug, and one precedence ladder decides what each call runs on, so a dispatcher and a report that
explains the choice read the same answer.

- **Rules.** `compileLlmModelRouting({ routing, capabilities, tiers, providers, label })` compiles an
  `LlmModelRoutingConfig` (`{ tiers?, defaultTier?, rules? }`) into an `LlmCompiledModelRouting`: capability →
  `LlmCapabilityRoute` (`{ model, tier?, provider?, maxOutputTokens?, reasoning? }`). A rule targets `capabilities`
  and/or `tags` and routes to a `tier` or a `model` slug (the slug wins when both are set). A capability-key match beats
  any tag match; within a level the first rule wins. It fails loud at startup on an unknown capability, a tag no
  capability carries, an unknown tier, an unknown provider (when you pass `providers`), or a rule with no target or no
  route. Merge `routing.tiers` and `routing.defaultTier` into your tiers with `resolveLlmModelTiers` first.
- **Model.** `resolveLlmCapabilityModel({ override, descriptor, route, tiers, defaultTier })`: the call's own slug >
  its tier > the route > the capability's slug > its tier > the default tier. The result names the rung that won
  (`source`), and the default tier is resolved first, so a bad default fails on every path.
- **Output controls.** `resolveLlmCapabilityOutputControls(…)`: `maxOutputTokens` follows route > capability > tier
  and is absent when nothing sets it; `reasoning` follows the call > route > capability > tier > `reasoningDefault`
  (usually `LLM_REASONING_OFF`, `{ enabled: false }`).
- **Provider.** `resolveLlmCapabilityProvider({ route, model, bindings, defaultProvider })`: the route's provider (a
  host policy) > the slug's binding (`llmModelProviderBindings`, an entitlement) > your default.
- **Vision.** `llmCapabilityVisionOf({ …, visionByModel })` — the slug a capability bills and whether it accepts images.

```ts
import { compileLlmModelRouting, llmModelProviderBindings, resolveLlmCapabilityModel, resolveLlmCapabilityProvider, resolveLlmModelTiers } from '@dereekb/llm';

const { tiers, defaultTier } = resolveLlmModelTiers({ base: BUILT_IN_TIERS, modelTiers: { ...routing.tiers, ...profile?.tiers }, defaultTier: routing.defaultTier });
const routes = compileLlmModelRouting({ routing, capabilities: [{ capability: 'reply-line', tags: ['dialog'] }, { capability: 'summarize' }], tiers, providers: ['local', 'openrouter'] });

const route = routes.get('reply-line');
const { model, source } = resolveLlmCapabilityModel({ descriptor: { tier: 'fast' }, route, tiers, defaultTier });
const { provider } = resolveLlmCapabilityProvider({ route, model, bindings: llmModelProviderBindings(effective), defaultProvider: 'openrouter' });
```

## Adapters

Provider entries (`/openai`, `/openrouter`, `/zenmux`, or your own) export adapters. Register them once, then turn
your configured providers into strategies through them: a new transport is a new adapter, never an edited switch, and
a provider naming one you did not register fails loud, listing the ones you did.

- **Facets.** `completion` adapters are keyed by transport and mint an `LlmStrategy`; `decision` adapters are keyed by
  decision route and mint an `LlmDecisionStrategy`. Three account facets are keyed by metering id: `metering` (an
  `LlmProviderStatusSource`, plus the account's cost basis), `bill` (an `LlmCallBillReader`) and `credentialProbe` (an
  `LlmCredentialProbe` that replaces a transport's generic key check).
- **Registry.** `makeLlmAdapterRegistry(adapters)`; a second adapter for the same facet and kind throws. Read it with
  `llmAdapterOf`, `resolveLlmAdapter` (throws naming the registered kinds), `llmAdaptersOf` and `llmAdapterKindsOf`.
  `llmModelConfigListsOf(adapters)` gives `makeLlmModelConfigSchema` its `transports`, `meterings` and
  `decisionRoutes`.
- **Strategies.** `makeLlmProviderStrategies({ providers, adapters, defaultModel, maxOutputTokens, timeoutMs,
  visionByModel, reasoningOffByModel })` builds one strategy per resolved provider (`resolveLlmProviderConfigs`),
  registered under the provider's own name. Construction is inert.
- **Accounts.** `resolveLlmProviderAccount({ provider, adapters })` decides which account a provider bills — its
  declared `metering`, else the metering adapter that recognizes its base URL, else `none` — and every account fact
  follows that one answer: cost basis, status source, credential probe and bill reader. `llmProviderBaseUrlOf` and
  `llmProviderMeteringOf` answer the parts for a report.
- **Decisions.** `llmProviderDecisionRouteOf` reads a provider's declared `decision`, else the route a decision adapter
  serves for its transport, else `none` — never its base URL. `llmDecisionCapableProviders({ providers, adapters,
  routePreference })` keeps the routed, keyed providers in your route order (default: registration order), then
  provider order; the first is the lane's default. `makeLlmDecisionStrategies(…)` builds the decision registry (empty
  when nothing can serve), `llmDecisionStrategyKinds(adapters)` tells a decision call record from a completion one, and
  `llmDecisionModelIssue(model)` refuses a completion slug before any call is made.

```ts
import { llmModelConfigListsOf, makeLlmAdapterRegistry, makeLlmDecisionStrategies, makeLlmModelConfigSchema, makeLlmProviderStrategies, makeLlmStrategyRegistry, resolveLlmProviderConfigs } from '@dereekb/llm';

const adapters = makeLlmAdapterRegistry(PROVIDER_ADAPTERS); // the adapters your provider entries export
const schema = makeLlmModelConfigSchema({ ...llmModelConfigListsOf(adapters), label: 'my-app models' });
const { providers } = resolveLlmProviderConfigs({ providers: effective.providers, schema, apiKeyOf: ({ entry }) => keys[entry.apiKeyEnv] });

const strategies = makeLlmStrategyRegistry(makeLlmProviderStrategies({ providers, adapters, defaultModel, timeoutMs: 60_000 }));
const decisions = makeLlmDecisionStrategies({ providers, adapters, routePreference: ['zenmux', 'openrouter'] });
```

## Decisions

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

### Declaring

- Every declaration surface takes a string, an object or an array (structured entries — `{ question, inspect }`,
  `{ what, not_for, examples }`, `{ what, signals }`), carried to the wire verbatim.
- Name state fields in backticks (`` `ticket.body` ``); `llmDecisionStatePaths` reads them back so a spec can pin
  them.
- `validateLlmDecisionQuestions` fails at the DECLARATION, naming the question, rather than as a 4xx about a body:
  no questions, blank instructions, a Choice outside 1..255 options (`LLM_DECISION_CHOICE_OPTIONS_MAX`), a Score
  outside 2..10 levels. The limits are transport limits of the decision route on every gateway. It returns
  `LlmDecisionValidation` (`{ valid, errors, warnings }`); a builder that refuses throws
  `LlmDecisionDeclarationError` (its `errors`, plus the `decision` key when a declared decision asked).

### On the wire

- `llmDecisionRequestBody({ model, state, questions })` builds exactly `{ model, state, questions }`, in that order,
  field by field — ZenMux answers 400 to any other key, so a host-extended request cannot leak one. The bytes equal
  OpenRouter's `/systemone` body for the same input.
- `llmDecisionWireQuestion` is the per-question mapping (an undescribed option is an explicit `null`; a Noul with no
  `means` omits `criteria`).
- `isLlmDecisionModelId` is the routing guard: decision models are not in a gateway's `/models` catalog, so the id
  (`typesafe/jev-1.13`, or bare `jev-…`) is the only discriminator.

### Reading

- `readLlmDecisionAnswers({ questions, raw })` membership-checks every answer against the question that asked it and
  returns the typed answers or EVERY fault (`answer-missing`, `answer-mistyped`, `choice-off-option`,
  `value-out-of-range`). Past it, a `choice` is a declared option, a `score` is in range and a `noul` is a
  probability — no consumer re-checks. A transport throws `LlmDecisionAnswerFaultError` with the faults.
- `asLlmDecisionConfidenceBand`, `llmDecisionChoiceRanking`, `mapLlmDecisionChoiceRows` and
  `llmChoiceCertaintyOf` (sure / nested / split / diffuse / unread, with site-owned floors) read a Choice's answer.

### Strategies

- `LlmDecisionStrategy` is the decision sibling of `LlmStrategy`: `decide(request, options?)` takes
  `LlmDecisionRequest` (`{ state, questions, model }`) and returns `LlmDecisionResult` (the answering versioned
  `model`, `answers`, `usage`, `provider`, `generationId`). It throws rather than returning partial answers. Its
  `healthCheck` / `credentialProbe` report `LlmStrategyHealth`, the completion lane's verdict.
- `makeLlmDecisionStrategyRegistry(seed)` — the same id / kind registry; `getBy('kind', k)` is the LAST registered
  instance, `values()[0]` the first.
- `DEFAULT_LLM_DECISION_TIMEOUT_MS` (10s) is declared here and enforced by each transport.
- `LlmDecisionTransportError` (`status`, `body`) and `isRetryableLlmDecisionError` (429 / 5xx / socket failures,
  never an abort) — the completion lane's retry posture; no retry loop lives here.
- `defineLlmDecision(descriptor)` declares a decision over one typed input: `state(input)` and `questions(input)`.
  Validation is lazy — `asRequest({ input, model })` validates and throws `LlmDecisionDeclarationError` naming the
  decision — and `decide({ strategy, input, model, options })` runs it.
- `LlmDecisionDispatchRequest` is what a dispatcher's decision lane takes: the consuming `capability`, the declared
  `decision`, its `input`, host `meta`, model / tier overrides, `stage` and an optional `stamp`.

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

### Coming from `@dereekb/openrouter`

The vocabulary moved here from `@dereekb/openrouter` under neutral names. JSON shapes are unchanged, and the old
names remain as `@deprecated` aliases of the same values and classes.

| `@dereekb/openrouter` | `@dereekb/llm` |
|---|---|
| `OpenRouterDecision…` | `LlmDecision…` |
| `openRouterDecision…` (option names, ranking, state paths, wire question) | `llmDecision…` |
| `openRouter{Choice,Score,Noul}Question` | `llm{Choice,Score,Noul}Question` |
| `OPENROUTER_DECISION_…` | `LLM_DECISION_…` |
| `{is,as,map,validate,read}OpenRouterDecision…` | `{is,as,map,validate,read}LlmDecision…` |
| `OpenRouterStorableDecisionState` | `LlmStorableDecisionState` |
| `OpenRouterSystemOneModelId` / `isOpenRouterSystemOneModelId` / `OPENROUTER_SYSTEM_ONE_MODEL_NAMESPACE` | `LlmDecisionModelId` / `isLlmDecisionModelId` / `LLM_DECISION_MODEL_NAMESPACE` |

What stays in `@dereekb/openrouter`: `openRouterDecisionRequest`, `openRouterDecisionRequestBody` (the SDK's
`DecisionsRequest`, with OpenRouter's session id and trace), `splitOpenRouterDecisionModelConfig`,
`validateOpenRouterDecisionRequest`, `openRouterRunUsageFromDecisionsUsage`, the `OPENROUTER_JEV_*` ids,
`DEFAULT_OPENROUTER_SYSTEM_ONE_MODEL_ID` and the `openRouterDecision` transport. `@dereekb/llm/openrouter`
carries its own decision transport (`makeLlmOpenRouterDecisionStrategy`) and usage flattening
(`llmUsageFromOpenRouterDecisionsUsage`) and never imports `@dereekb/openrouter`.

## OpenAI-compatible chat (`@dereekb/llm/openai`)

`makeLlmOpenAiStrategy(config)` reaches any OpenAI-compatible chat-completions endpoint — bare OpenAI, ZenMux, a local
vLLM — over the optional `openai` peer.

- Messages are plain strings, so the provider's implicit prefix caching applies (`caching: 'auto-prefix'`).
- A request with `responseSchemaHint` sends a strict `json_schema` `response_format` named by the capability.
- Reasoning rides the flat `reasoning_effort`. An explicit OFF (`reasoning.enabled === false`) is encoded per
  `reasoningOffEncoding` / `reasoningOffByModel` rather than dropped; `LLM_OPENAI_REASONING_OFF_PARAMS` shows each wire
  shape (`llmOpenAiReasoningParamsOf` builds it).
- The cap rides under `tokenLimitParam` (`max_tokens` or `max_completion_tokens`); `usage: { include: true }` is an
  opt-in (`usageAccounting`); a volunteered `usage.cost` is read either way and stamped with `costBasis` when set.
- Images ride only for slugs `visionByModel` marks; `attachmentsSent` on the result says what rode.
- There is no built-in model: set `defaultModel` or pass `request.model`, else the call fails loud.
- Seams: `run` (an `LlmRunner`), `client` (an `LlmOpenAiChatClient` — a fake, or your own SDK client) and
  `probeFetch`. The real client is built lazily with `maxRetries: 0` (the dispatcher retries) and never reads
  `OPENAI_ORG_ID` / `OPENAI_PROJECT_ID`. In a browser pass `dangerouslyAllowBrowser: true` or inject a client — with
  user-held keys only.
- Credentials: `credentialProbe` GETs `{baseUrl}/models` (a 404 is a ready warning); `credentialProbeSource` replaces
  it; `providerStatus` / `providerStatusId` exist only with a `providerStatusSource`.

`LLM_OPENAI_ADAPTERS` registers the completion transport `openai` (default base URL `https://api.openai.com/v1`).
`llmOpenAiStrategyConfigOf` is its mapping, exported so a host can extend it in its own adapter:

| strategy config | from the adapter config |
| --- | --- |
| `id`, `apiKey` | `provider.id`, `provider.apiKey` |
| `baseUrl`, `defaultModel`, `maxOutputTokens`, `timeoutMs` | the same names |
| `tokenLimitParam`, `reasoningOffEncoding`, `usageAccounting` | `provider.tokenLimitParam`, `provider.reasoningOff`, `provider.usageAccounting` |
| `reasoningOffByModel`, `visionByModel`, `costBasis`, `providerStatusSource` | the same names |
| `credentialProbeSource`, `probeFetch` | `credentialProbe`, `fetch` |

The entry's swallow sites are `LLM_OPENAI_SWALLOW_SITES`; register them beside the root's:
`makeLlmSwallowSiteRegistry([...Object.values(LLM_SWALLOW_SITES), ...Object.values(LLM_OPENAI_SWALLOW_SITES)])`.

```ts
import { makeLlmAdapterRegistry, makeLlmProviderStrategies, makeLlmStrategyRegistry } from '@dereekb/llm';
import { LLM_OPENAI_ADAPTERS, makeLlmOpenAiStrategy } from '@dereekb/llm/openai';
import { LLM_OPENROUTER_ADAPTERS } from '@dereekb/llm/openrouter';

const gateway = makeLlmOpenAiStrategy({ id: 'gateway', apiKey, baseUrl: 'https://zenmux.ai/api/v1', defaultModel: 'vendor/model-flash', tokenLimitParam: 'max_completion_tokens' });
const completion = await gateway.complete({ prompt, capability: 'summarize', responseSchemaHint: schema });

// or build every configured provider through the adapters
const adapters = makeLlmAdapterRegistry([...LLM_OPENAI_ADAPTERS, ...LLM_OPENROUTER_ADAPTERS]);
const strategies = makeLlmStrategyRegistry(makeLlmProviderStrategies({ providers, adapters, defaultModel: 'vendor/model-flash' }));
```

## OpenRouter (`@dereekb/llm/openrouter`)

**Chat** — `makeLlmOpenRouterStrategy(config)`, over the optional `openai` peer pointed at OpenRouter:

- An `anthropic/` route sends the prompt's stable prefix as a `cache_control: { type: 'ephemeral' }` block, and a
  chained follow-up adds a history breakpoint on the last replayed turn; other routes get the plain prompt
  (`caching: 'breakpoint'`).
- `usage: { include: true }` rides every call, so the reply carries `cost`; the request's reasoning config rides as
  OpenRouter's nested `reasoning` object; the served upstream `provider` is echoed; `native_finish_reason` is the
  finish-reason fallback.
- No built-in model. The same seams, browser rule, `costBasis` / `providerStatusSource` / `credentialProbeSource`
  facets as `/openai`; the generic credential probe is `GET {baseUrl}/key`.

**Decisions** — `makeLlmOpenRouterDecisionStrategy(config)` posts to `{baseUrl}/systemone` through the optional
`@openrouter/sdk` peer, loaded lazily (the core client plus `systemOneCreate`, `retries: none`):

- The body is `llmDecisionRequestBody`; answers are membership-checked (`LlmDecisionAnswerFaultError`); usage comes from
  `llmUsageFromOpenRouterDecisionsUsage` and carries the gateway's exact, synchronous `cost`.
- The per-call timeout (`DEFAULT_LLM_DECISION_TIMEOUT_MS` unless set) holds even when you pass a signal.
- Failures: a timeout or abort rejects with the native reason (`isAbortError`), a socket failure with the native fetch
  error (retryable), an HTTP answer with `LlmDecisionTransportError` (`status`, `body`).
- Seams: `decisionsCreate` (replaces the SDK call), `decisionsFetch` (a fake socket under the real SDK) and
  `probeFetch`.

`LLM_OPENROUTER_ADAPTERS` registers the completion transport `openrouter` (default `https://openrouter.ai/api/v1`) and
the decision route `openrouter` (`strategyKind: 'openrouter-decisions'`, derived for every `openrouter`-transport
provider). The completion mapping (`llmOpenRouterStrategyConfigOf`) ignores the provider's `reasoningOff`,
`tokenLimitParam` and `usageAccounting` — this wire has one spelling for each. The entry's swallow sites are
`LLM_OPENROUTER_SWALLOW_SITES`; register them beside the root's the same way.

```ts
import { llmNoulQuestion } from '@dereekb/llm';
import { makeLlmOpenRouterDecisionStrategy, makeLlmOpenRouterStrategy } from '@dereekb/llm/openrouter';

const chat = makeLlmOpenRouterStrategy({ apiKey, defaultModel: 'anthropic/claude-opus-4.8' });
const decisions = makeLlmOpenRouterDecisionStrategy({ apiKey });
const { answers, usage } = await decisions.decide({ model: 'typesafe/jev-1.13', state: { ticket }, questions: { spam: llmNoulQuestion('`ticket` is unsolicited marketing.') } });
```

## ZenMux (`@dereekb/llm/zenmux`)

ZenMux is a gateway: its chat rides the `/openai` transport, and this entry holds everything else — the account (cost
basis, quota status, per-call bills, the credential probe) and the decision route `POST {baseUrl}/systemone`. It talks
plain `fetch`, so it needs no SDK, and never reads the environment: the host passes every key in.

- **Three credentials.** The SUBSCRIPTION inference key covers chat, decisions and the probe. The PAY-AS-YOU-GO
  inference key covers bills, and reads every call's bill, the subscription's included. The MANAGEMENT API key
  covers quota status; both inference keys get `403 Invalid API key` there.
- **Cost basis.** A synchronous `cost` is the pre-discount LIST amount (`ZENMUX_SYNC_COST_BASIS = 'list'`), an upper
  bound: measured over 406 calls, three of 17 slugs billed half of it. `zenmuxCostBasisFor` / `isZenmuxMeteredProvider`
  are the registry-free form of the rule — a declared `metering` wins, else the URL must parse as `zenmux.ai` or a
  subdomain (`isZenmuxBaseUrl`; a look-alike host never qualifies).
- **Bills.** `makeZenmuxGenerationBillReader` reads `management/generation?id=`. A call bills 3–5 minutes after it is
  made, so a `404` reads `pending`; a refused key reads `failed` in ZenMux's own words.
- **Quota status.** `makeZenmuxProviderStatusSource` reads `subscription/detail`, `payg/balance` and `flow_rate` in
  parallel. A partial read stays `available` with a warning per failed endpoint; a missing management key reads
  `available: false` with an error naming `ZENMUX_MANAGEMENT_API_KEY` (or your `managementApiKeyEnv`). Status and bill
  reads go to `zenmuxAccountBaseUrlOf(baseUrl)`: a ZenMux URL keeps its host, anything else (a LAN proxy declared
  `metering: 'zenmux'`) reads the account at `DEFAULT_ZENMUX_BASE_URL`.
- **Credential probe.** `GET /models` answers 200 to any bearer, so `probeZenmuxCredential` asks two auth-gated,
  never-billed questions instead: a chat completion naming a model no gateway serves (a live subscription key gets
  `404`), then, only if refused, a bill lookup of a made-up id (a live pay-as-you-go key gets `404`).
- **Decisions.** `makeZenmuxDecisionStrategy` (`kind: 'zenmux-systemone'`) sends exactly `{ model, state, questions }`
  via `llmDecisionRequestBody` — ZenMux answers `400` to any other key. The generation id comes from the
  `X-ZenMux-RequestId` header. Two lax reads: a type-less answer takes its question's declared type, and `usage` is read
  field by field. A socket failure wraps as `LlmDecisionTransportError` with the failure as its `cause`, so a reset
  retries under `isRetryableLlmDecisionError`.

`makeZenmuxLlmAdapters(config)` returns the decision route `zenmux`, plus the `zenmux` metering, bill and
credential-probe adapters. The decision route is never derived: a provider declares `decision: 'zenmux'`. Register the
array before `/openrouter`'s, or pass a `routePreference`, when ZenMux should be the default decision route. Without a
`billApiKey`, a subscription provider's bill reads fail `403`, so pass the pay-as-you-go key. The entry's swallow sites
are `ZENMUX_SWALLOW_SITES`.

```ts
import { makeLlmAdapterRegistry } from '@dereekb/llm';
import { LLM_OPENAI_ADAPTERS } from '@dereekb/llm/openai';
import { DEFAULT_ZENMUX_BASE_URL, makeZenmuxLlmAdapters } from '@dereekb/llm/zenmux';

const adapters = makeLlmAdapterRegistry([...LLM_OPENAI_ADAPTERS, ...makeZenmuxLlmAdapters({ managementApiKey, managementApiKeyEnv, billApiKey })]);
const zenmux = { transport: 'openai', baseUrl: DEFAULT_ZENMUX_BASE_URL, apiKeyEnv: 'ZENMUX_API_KEY', metering: 'zenmux', decision: 'zenmux', usageAccounting: true };
```

## Utilities

### sha256Hex

`sha256Hex(text)` returns the SHA-256 of a string's UTF-8 bytes as 64 lowercase hex characters. It is synchronous and
dependency-free, so it runs anywhere — no `node:crypto`, no WebCrypto promise.

It is byte-identical to `createHash('sha256').update(text, 'utf8').digest('hex')` from `node:crypto` for every
JavaScript string, including strings with lone surrogates: those are encoded as U+FFFD, the same WHATWG UTF-8 rule
Node applies, instead of throwing.

```ts
import { sha256Hex } from '@dereekb/llm';

const shortDigest = sha256Hex(promptText).slice(0, 16);
```
