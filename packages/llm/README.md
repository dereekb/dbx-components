# @dereekb/llm

A framework-free, provider-agnostic LLM layer: the transport contract every provider strategy implements, model and
provider configuration, prompt assembly with provenance, reply repair and validation, a dispatcher with a retry
ladder, usage accounting, and a decision lane for short structured answers. It has no Angular, Nest or Firebase
dependency, and its browser entries run unchanged in a browser, a worker or Node.

> **Status: new.** All eight entries below are in place. While the first hosts adopt the package, a minor release may
> still rename an export — pin an exact version ([Versioning and stability](#versioning-and-stability)).

## Quick start: define a capability and dispatch it

A capability is a typed kind of LLM call; a dispatcher runs it. Nothing below touches the network: `/test`'s scripted
strategy answers in place of a provider.

```ts
import { type } from 'arktype';
import { DEFAULT_LLM_MAX_OUTPUT_TOKENS, defineLlmCapability, makeLlmDispatcher, makeLlmSchemaValueValidator, makeLlmStrategyRegistry, makeLlmTieredPromptTemplateResolver, readLlmReplyValue, toLlmCallLogPayload, type LlmCallLogPayloadWrite, type LlmCapabilityDescriptor } from '@dereekb/llm';
import { makeLlmScriptedStrategy } from '@dereekb/llm/test';

// 1. The capability: its key, the reply schema, and how a parsed reply becomes a typed value.
const summarySchema = type({ summary: 'string' });
const SUMMARIZE = defineLlmCapability({
  capability: 'summarize',
  responseSchema: summarySchema,
  parseValue: (value) => {
    const out = summarySchema(value);
    return out instanceof type.errors ? undefined : out;
  }
});
const DESCRIPTORS: Readonly<Record<string, LlmCapabilityDescriptor>> = { summarize: SUMMARIZE };

// 2. Its text: templates are keyed by role and scoped by capability, apart from the descriptor.
const templateResolver = makeLlmTieredPromptTemplateResolver({
  tiers: [{ source: 'app', templates: [{ key: 'summarize-instructions', role: 'instructions', capability: 'summarize', text: 'Summarize the subject in one sentence.' }] }]
});

// 3. A strategy: `/test`'s scripted one here; a provider strategy in an app (docs/node.md).
const strategy = makeLlmScriptedStrategy({ byCapability: { summarize: '{"summary":"A brass desk lamp."}' } });

// 4. The dispatcher. The recorder persists the flat row, never the in-memory record.
const rows: LlmCallLogPayloadWrite[] = [];
const dispatcher = makeLlmDispatcher({
  strategies: makeLlmStrategyRegistry([strategy]),
  defaultStrategyId: strategy.id,
  defaultMaxOutputTokens: DEFAULT_LLM_MAX_OUTPUT_TOKENS,
  modelTiers: { fast: 'acme/fast' },
  descriptorOf: (capability) => DESCRIPTORS[capability],
  templateResolver,
  recorder: {
    recordCall: (record) => {
      rows.push(toLlmCallLogPayload(record, { keepIo: true })); // keepIo keeps the prompt and the reply (a tape replays them)
    }
  }
});

// 5. Dispatch, then read the typed value.
const result = await dispatcher.dispatch({
  capability: 'summarize',
  renderLiveContext: () => [{ key: 'subject', text: 'Subject: a brass desk lamp' }],
  validate: makeLlmSchemaValueValidator(summarySchema)
});

const summary = SUMMARIZE.parseValue(readLlmReplyValue(result.text)); // { summary: 'A brass desk lamp.' }
```

- Descriptors are plain values. The host's `descriptorOf` IS the registry; there is no register call.
- Templates live in the resolver, keyed by `capability`, and `DEFAULT_LLM_PROMPT_LAYOUT` orders the prompt
  ([prompt](docs/prompt.md)).
- Persist `toLlmCallLogPayload(record)` — the flat row every reader, the ledger and the tape read — never the record
  itself ([records](docs/records.md)).
- In an app, swap the scripted strategy for a provider strategy: `/openai`, `/openrouter`, or `/node`'s env strategies
  in [A complete Node host](docs/node.md#a-complete-node-host). Add `validate` / `critique` for the retry ladder
  ([dispatcher](docs/dispatcher.md)).

Pinned by `src/llm.readme.example.spec.ts`.

## Entry points

| Entry | Node | SDK | Purpose | Guide |
|---|---|---|---|---|
| `@dereekb/llm` | no | none | The strategy contract, call records, model and provider configuration, adapters, prompt assembly, reply repair and validation, the dispatcher and retry ladder, usage accounting, and utilities. | [Guides](#guides) |
| `@dereekb/llm/decision` | no | none | The decision lane: questions, the wire format and answer reader, confidence, the decision strategy contract and the System One transport (`makeLlmSystemOneDecisionStrategy`). Re-exported by the root entry from the same modules, so both share one copy. | [decision](docs/decision.md) |
| `@dereekb/llm/craft` | no | none | Craft notes: the note model and markdown parser, the site registry, selection, the judge and the craft prompt contributor. Opt-in: the root does not export it. | [craft](docs/craft.md) |
| `@dereekb/llm/openai` | no | `openai` (optional, lazy) | The OpenAI-compatible chat base (`makeLlmOpenAiCompatibleChatStrategy`), the OpenAI-compatible chat strategy (OpenAI, ZenMux chat, a local vLLM) and its completion adapter. | [openai](docs/openai.md) |
| `@dereekb/llm/openrouter` | no | `openai` (through `/openai`) | The OpenRouter chat strategy (`cache_control`, strict `response_format`, usage accounting), the OpenRouter decision strategy and their adapters. | [openrouter](docs/openrouter.md) |
| `@dereekb/llm/zenmux` | no | none (`fetch`) | ZenMux constants and cost basis, the decision route on the core System One transport, the quota-status source and the bill reader. | [zenmux](docs/zenmux.md) |
| `@dereekb/llm/node` | yes | none | Model-config file IO, environment variables to provider configs, the craft-notes folder loader and the craft markdown to TypeScript compiler. | [node](docs/node.md) |
| `@dereekb/llm/test` | test infra | none | Tape replay, scripted completion and decision strategies, the decision answer builders (`makeLlmDecisionChoiceAnswer`, …), the fakes (fetch seam, OpenAI-compatible chat client, completion adapter, dispatcher, `/systemone` wire), and the billed-lane test factories. | [test](docs/test.md) |

## Entries

npm installs one package, `@dereekb/llm`, and reads its peers from the root manifest: `@dereekb/util`,
`@dereekb/model`, `arktype`, and the optional `openai`. The peers below are what each entry actually loads; each
sub-entry's own manifest lists `@dereekb/model` as a type-only peer.

### `@dereekb/llm`

The core: the strategy contract and registry, model config and routing, adapters, prompt building, replies, the
dispatcher and retry ladder, call records and usage — plus every `/decision` export, re-exported from the same
modules.

- **Browser-safe:** yes.
- **Peers:** `@dereekb/util` (with `@dereekb/util/fetch`), `@dereekb/model` (the field checks) and `arktype`. `openai`
  is declared here as an OPTIONAL peer for `/openai` and `/openrouter`; this entry never loads it.
- **Main exports:**
  - Strategies: `LlmStrategy`, `LlmRequest`, `LlmCompletion`, `makeLlmStrategyRegistry`, `verifyLlmStrategies`,
    `DEFAULT_LLM_MAX_OUTPUT_TOKENS`, `evaluateLlmQuotaGate`, `parseLlmQuotaMaxUsed`.
  - Model config: `makeLlmModelConfigSchema`, `parseLlmModelConfigFile`, `overlayLlmModelConfigFile`,
    `resolveLlmModelTiers`, `llmModelProviderBindings`, `mapLlmModelSettings`, `LLM_PROVIDER_COMPLETION_ONLY_KEYS`,
    `compileLlmModelRouting`.
  - Adapters: `makeLlmAdapterRegistry`, `readLlmModelConfigLists`, `makeLlmProviderStrategies`.
  - Prompts: `defineLlmCapability`, `defineLlmPromptLayout`, `DEFAULT_LLM_PROMPT_LAYOUT`,
    `makeLlmTieredPromptTemplateResolver`, `composeLlmCapabilityPrompt`, `makeLlmPromptChain`.
  - Replies: `readLlmReplyValue`, `makeLlmSchemaValueValidator`, `makeLlmReplyFastFixer`, `makeLlmSemanticCritic`.
  - Dispatcher: `makeLlmDispatcher`, `LlmDispatchRequest`, `LlmDispatchFaultError`, `classifyLlmError`.
  - Records and usage: `toLlmCallLogPayload`, `LLM_CALL_EVENT_TYPE` (`'llm_call'`), `LLM_CALL_START_EVENT_TYPE`
    (`'llm_call_start'`), `LLM_DECODE_FAILURE_EVENT_TYPE` (`'llm_decode_failure'`), `llmCallTelemetry`, `readLlmCallPrompt`,
    `isLlmSendFailureFinishReason`, `reconcileLlmCallBills`, `LLM_SWALLOW_SITES`.
- **Guide:** [Guides](#guides) 1–8 and 13.

### `@dereekb/llm/decision`

Short structured answers (choice, score, noul) from decision models: declare them with `defineLlmDecision`, send them
through an `LlmDecisionStrategy`, read typed answers.

- **Browser-safe:** yes; the System One transport is plain `fetch`.
- **Peers:** `@dereekb/util` (with `/fetch`); `@dereekb/model` and `arktype` type-only.
- **Main exports:** `defineLlmDecision`, `LlmDecisionDescriptor`, `llmChoiceQuestion`, `llmScoreQuestion`, `llmNoulQuestion`,
  `LlmDecisionStrategy`, `makeLlmSystemOneDecisionStrategy`, `llmDecisionRequestBody`, `readLlmDecisionAnswers`,
  `requireLlmDecisionAnswers`, `readLlmChoiceCertainty`, `toLlmDecisionConfidenceBand`, `LlmDecisionAnswerFaultError`,
  `LlmDecisionTransportError`. `@dereekb/openrouter/decision`'s old names are deprecated aliases of these.
- **Guide:** [decision](docs/decision.md).

### `@dereekb/llm/craft`

Opt-in: the root does not export it, and no core module imports it. Craft notes are short authored guidance, selected
per prompt site and placed in the prompt by a contributor.

- **Browser-safe:** yes.
- **Peers:** `@dereekb/util` and `arktype` (frontmatter parsing); `@dereekb/model` type-only.
- **Main exports:** `parseLlmCraftNote`, `parseLlmCraftNoteSet`, `makeLlmCraftSiteRegistry`, `mergeLlmCraftNoteTiers`,
  `selectLlmCraftNotes`, `makeLlmCraftPromptContributor`, `makeLlmCraftJudge`, `makeLlmCraftNoteRowReader`,
  `DEFAULT_LLM_CRAFT_SITE_LIMITS`. The judge rides the contributor:
  `makeLlmCraftPromptContributor({ …, judge: makeLlmCraftJudge(…) })`.
- **Guide:** [craft](docs/craft.md).

### `@dereekb/llm/openai`

The OpenAI-compatible chat strategy (OpenAI, ZenMux chat, a local vLLM) and its completion adapter.

- **Browser-safe:** yes. The SDK loads lazily from one boundary module; in a browser, pass `dangerouslyAllowBrowser`
  or inject a client ([Browser hosts](docs/browser.md)). On Node the SDK itself reads `OPENAI_CUSTOM_HEADERS` and `OPENAI_LOG`.
- **Peers:** `@dereekb/llm`, `@dereekb/util`, and `openai` (the package's optional peer; install it to use this
  entry).
- **Main exports:** `makeLlmOpenAiStrategy`, `makeLlmOpenAiCompatibleChatStrategy`, `toLlmOpenAiStrategyConfig`,
  `LLM_OPENAI_ADAPTERS`, `LLM_OPENAI_COMPLETION_ADAPTER`, `LLM_OPENAI_STRATEGY_KIND`, `DEFAULT_LLM_OPENAI_BASE_URL`,
  `LLM_OPENAI_SWALLOW_SITES`.
- **Guide:** [openai](docs/openai.md).

### `@dereekb/llm/openrouter`

The OpenRouter chat strategy (`cache_control`, strict `response_format`, usage accounting), the decision strategy
(kind `openrouter-decisions`), the credential probe and the adapters. It is not `@dereekb/openrouter`.

- **Browser-safe:** yes. The chat reaches `openai` through `/openai`, the decisions are plain `fetch`, and
  `@openrouter/sdk` is never loaded.
- **Peers:** `@dereekb/llm` (with `/openai`), `@dereekb/util`, and `openai` for the chat strategy.
- **Main exports:** `makeLlmOpenRouterStrategy`, `makeLlmOpenRouterDecisionStrategy`, `probeLlmOpenRouterCredential`,
  `LLM_OPENROUTER_ADAPTERS`, `LLM_OPENROUTER_STRATEGY_KIND`, `LLM_OPENROUTER_DECISION_STRATEGY_KIND`,
  `DEFAULT_LLM_OPENROUTER_BASE_URL`, `LLM_OPENROUTER_SWALLOW_SITES`.
- **Guide:** [openrouter](docs/openrouter.md).

### `@dereekb/llm/zenmux`

ZenMux constants and cost basis, the decision strategy (kind `zenmux-systemone`), the provider-status source, the bill
reader, the management reads and the adapters.

- **Browser-safe:** yes; `fetch` only.
- **Peers:** `@dereekb/llm` and `@dereekb/util` (with `/fetch`).
- **Main exports:** `makeLlmZenmuxAdapters`, `makeLlmZenmuxDecisionStrategy`, `makeLlmZenmuxProviderStatusSource`,
  `makeLlmZenmuxGenerationBillReader`, `probeLlmZenmuxCredential`, `readLlmZenmuxManagement`,
  `LLM_ZENMUX_DECISION_STRATEGY_KIND`, `LLM_ZENMUX_MANAGEMENT_API_KEY_ENV_VAR`, `DEFAULT_LLM_ZENMUX_BASE_URL`,
  `LLM_ZENMUX_SWALLOW_SITES`.
- **Guide:** [zenmux](docs/zenmux.md).

### `@dereekb/llm/node`

Node only. It reads the machine: model-config file IO, the environment into providers and strategies, the profile and
tier environment, and the craft-notes loader and compiler.

- **Browser-safe:** no. It uses `node:fs` and `node:path`, and reads `process.env` unless a call passes `env`. It loads
  `/craft`, and so `arktype`.
- **Peers:** `@dereekb/llm` (with `/craft`) and `@dereekb/util`.
- **Main exports:** `DEFAULT_LLM_ENV_NAMES`, `firstLlmEnvValue`, `firstLlmEnvEntry`, `loadEffectiveLlmModelConfigFile`,
  `writeLlmModelConfigFile`, `resolveLlmModelProfileFromEnv`, `resolveLlmModelTierEnv`, `resolveLlmProvidersFromEnv`,
  `resolveLlmDefaultProviderId`, `makeLlmStrategiesFromEnv`, `filterLlmReachableProviderGaps`, `loadLlmCraftNotes`, `compileLlmCraftNotes`,
  `writeLlmCraftNotesModule`, `LLM_NODE_SWALLOW_SITES`.
- **Guide:** [node](docs/node.md), with [A complete Node host](docs/node.md#a-complete-node-host). In a Nest app,
  pass nothing: `/node` and Nest's `ConfigService` both read `process.env` ([Nest hosts](docs/node.md#nest-hosts)).

### `@dereekb/llm/test`

Node-only test infrastructure: fakes and replays so a spec never bills, plus the env-gated live lane.

- **Browser-safe:** no. It loads `/node`. It never imports vitest and needs no vitest peer.
- **Peers:** `@dereekb/llm` (with `/node`) and `@dereekb/util` (with `/fetch`).
- **Main exports:** `makeLlmScriptedStrategy`, `makeLlmScriptedDecisionStrategy`, `makeLlmTapeStrategy`,
  `readLlmTapeTurn`, `makeLlmDecisionChoiceAnswer` / `makeLlmDecisionScoreAnswer` / `makeLlmDecisionNoulAnswer`,
  `makeLlmCompletionAdapterFake`, `makeLlmOpenAiChatClientFake`, `makeLlmFetchFake`, `makeLlmSystemOneWireFake`,
  `makeLlmDispatcherFake`, `makeLlmLiveLane`, `llmCredentialVerdictFromEnv`, `llmQuotaVerdictFromEnv`.
- Live specs run only behind an env flag (for example `LLM_LIVE_SPECS`), through `isEnvFlagEnabled`
  (`@dereekb/util`) or `describeIfEnvFlag` (`@dereekb/util/test`).
- **Guide:** [test](docs/test.md).

## Not @dereekb/openrouter's prompts

The two packages share words, not concepts:

- llm's `LlmPromptTemplate` (authored) and `LlmResolvedPromptTemplate` (what a resolver returns) are role-keyed prompt
  text placed in one slot of a capability's prompt — no model config, no version.
- `@dereekb/openrouter`'s `OpenRouterResolvedPrompt` is a whole stored, versioned request (instructions, seed messages,
  model config, decision questions), and its `OpenRouterResolvedPromptTemplate` is the script half of a MESSAGE
  template (an SMS or notification renderer).
- They are different concepts and deliberately not converged; neither package maps one onto the other.

## Browser safety

The root, `/decision`, `/craft`, `/openai`, `/openrouter` and `/zenmux` entries are browser-safe:

- They import no `node:` module or Node builtin and never read `process`. Hosts pass configuration (API keys, base
  URLs, model lists) in, and llm's own code reads nothing from the environment; reading the environment or the file
  system is the job of `/node`. The one read llm cannot switch off is the `openai` SDK's own: on Node it reads
  `OPENAI_CUSTOM_HEADERS` and `OPENAI_LOG` for every client `/openai` builds (see [openai](docs/openai.md)).
- No core module imports craft (lint pins it), so a host that never imports `/craft` never loads it.
- A browser network failure (Chromium's `Failed to fetch`, Firefox's `NetworkError when attempting to fetch
  resource.`, Safari's `Load failed`) is classified like undici's `fetch failed`: transient.
- `openai` is the only SDK peer, and it is **optional**: it is loaded lazily from `/openai`'s single boundary module,
  so importing an entry never loads it. Install it only for a chat strategy that uses it. `/openrouter` loads no SDK
  of its own: its chat strategy reaches `openai` by importing `/openai`, and its decision strategy is a plain `fetch`
  over the core System One transport.
- The browser entries have one sibling edge, `/openrouter` → `/openai`, and it is one-way: `/openai` imports no other
  provider entry. Lint pins both directions.
- The required peers are `@dereekb/util` (its `/fetch` entry included), `@dereekb/model` (the JSON-Schema export and
  the field checks the model config parses with; framework-free and browser-safe) and `arktype`.
- Every network read takes `@dereekb/util/fetch`'s `ConfiguredFetch` (default: the global `fetch`, read at call time,
  via `resolveLlmFetch`) and reads each body once with `readFetchJsonText`.

These rules are enforced, not just documented:

- Lint: `llmEntryBoundaryConfig` in `packages/llm/eslint.config.mjs`, applied per entry. Node builtins are banned by
  `import-x/no-nodejs-modules` and `process` by `no-restricted-globals` in every browser entry's sources; the `openai`
  SDK is legal only in `/openai`'s boundary module, and there only as `import type` or a lazy `import()`; no entry
  (specs included) imports `@dereekb/openrouter`; each entry carries its own sibling and `/decision` rules; no library
  source imports a test runner; and craft is a leaf (no core module imports it).
- One runtime spec per entry (`*.isolation.spec.ts`) loads it with the SDK ids watched and fails if either is
  evaluated (`itShouldLoadWithoutEvaluating` from `@dereekb/util/test`).
- The browser entries compile with `types: []`, so a Node API or `process` reference fails the build's typecheck;
  `/test` compiles with `types: ["node"]`, so a vitest global in its sources fails its typecheck.
- To run a dispatcher in a page, see [Browser hosts](docs/browser.md).

## Versioning and stability

- **Lockstep versions.** `@dereekb/llm` is released with every other dbx-components package under one version number.
  Its `@dereekb/*` peers (`@dereekb/util`, `@dereekb/model`) are pinned to that exact version, so install them at the
  same version as `@dereekb/llm`. `@dereekb/openrouter` pins `@dereekb/llm` the same way. The third-party peers take
  ranges: `arktype` `^2.2.0`, and the optional `openai` `^7.8.0`.
- **Exports.** While the first hosts adopt the package, a minor release may still rename an export. Pin an exact
  version, and read the changelog (`CHANGELOG.md`) before moving it.
- **Prompt bytes are not covered.** Any release may change the bytes a capability sends: the assembly, the default
  texts and layout, the correction and protocol wording, or the built-in templates.
  - Such a change is its own commit, named in the changelog.
  - It re-keys `cachePrefixHash` and a tape's prompt hashes. A tape still replays, matching by order.
  - It can move a model's answers, so re-record your tapes and re-run your evals when you upgrade across one.
- **Persisted rows are covered.** These form a compatibility surface:
  - the three event types: `LLM_CALL_EVENT_TYPE` (`'llm_call'`), `LLM_CALL_START_EVENT_TYPE` (`'llm_call_start'`) and
    `LLM_DECODE_FAILURE_EVENT_TYPE` (`'llm_decode_failure'`)
  - the keys `toLlmCallLogPayload` writes
  - the persisted values: the `strategyKind`s, the finish-reason sentinels, the `decodeStatus` / `decodeOutcome` words,
    and the supplement cut reasons

  A key or value is never renamed or repurposed once published; `lever` and `max-bytes` keep the names existing rows
  carry. New keys are optional. The readers read rows an older or newer build wrote: every key but `capability` is
  optional, an unknown string value reads as itself, and a malformed field reads as `undefined`. Removing a key or
  value would take a major release, plus a reader for the old rows.
- **Not covered:** the in-memory `LlmCallRecord` (persist the row, never the record), and the diag and gap codes, which
  a release may add to.

## Guides

The guides live in `docs/` and ship with the package. In reading order:

0. [Quick start](#quick-start-define-a-capability-and-dispatch-it) — above.
1. [Strategy contract](docs/strategy.md) — the transport contract every provider strategy implements: request in, completion out, usage, quota and credential probes.
2. [Model configuration and routing](docs/model-config.md) — the model config file shape, overlays and resolution, and the routing rules that move a capability to another model.
3. [Adapters](docs/adapters.md) — the adapter registry that turns configured providers into strategies, decision routes, metering and bills.
4. [Prompt building](docs/prompt.md) — capabilities, slot layouts, contributors, live context and templates.
5. [Craft notes](docs/craft.md) — `@dereekb/llm/craft`: the note model, the site registry, selection, the judge and the craft contributor.
6. [Replies](docs/replies.md) — reading, repair, schema validation and the critique policy.
7. [Dispatcher, retry and lanes](docs/dispatcher.md) — `makeLlmDispatcher`, its stages, the bounded retry ladder and the fast-fix, critique and decision lanes.
8. [Call records, readers and reconcile](docs/records.md) — what a dispatcher records and a host persists, the readers, the ledger and the spend math.
9. [Decisions](docs/decision.md) — `@dereekb/llm/decision`: questions, the wire format, answers, decision strategies, and coming from `@dereekb/openrouter`.
10. Providers — [OpenAI-compatible chat](docs/openai.md) (`/openai`), [OpenRouter](docs/openrouter.md) (`/openrouter`) and [ZenMux](docs/zenmux.md) (`/zenmux`).
11. Hosts — [Node host quick start](docs/node.md) (`@dereekb/llm/node`: the config file and environment reads, [a complete Node host](docs/node.md#a-complete-node-host) from env to dispatcher, [Nest hosts](docs/node.md#nest-hosts), and the craft-notes loader and compiler) and [Browser hosts](docs/browser.md) (where keys live, an injected client, CORS).
12. [Test infrastructure](docs/test.md) — `@dereekb/llm/test`: tapes, scripted strategies, the fakes and the billed-lane factories.
13. [Utilities](docs/utilities.md) — the semantic type aliases the API is typed with, and where the SHA-256 helpers live.
