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
| `@dereekb/llm` | no | none | The strategy contract, call records, model and provider configuration, adapters, prompt assembly, reply repair and validation, the dispatcher and retry ladder, usage accounting, and utilities. |
| `@dereekb/llm/decision` | no | none | The decision lane: questions, the wire format and answer reader, confidence, the decision strategy contract and the System One transport (`makeLlmSystemOneDecisionStrategy`). Re-exported by the root entry from the same modules, so both share one copy. |
| `@dereekb/llm/craft` | no | none | Craft notes: the note model and markdown parser, the site registry, selection, the judge and the craft prompt contributor. Opt-in: the root does not export it. |
| `@dereekb/llm/openai` | no | `openai` (optional, lazy) | The OpenAI-compatible chat base (`makeLlmOpenAiCompatibleChatStrategy`), the OpenAI-compatible chat strategy (OpenAI, ZenMux chat, a local vLLM) and its completion adapter. |
| `@dereekb/llm/openrouter` | no | `openai` (through `/openai`) | The OpenRouter chat strategy (`cache_control`, strict `response_format`, usage accounting), the OpenRouter decision strategy and their adapters. |
| `@dereekb/llm/zenmux` | no | none (`fetch`) | ZenMux constants and cost basis, the decision route on the core System One transport, the quota-status source and the bill reader. |
| `@dereekb/llm/node` | yes | none | Model-config file IO, environment variables to provider configs, the craft-notes folder loader and the craft markdown to TypeScript compiler. |
| `@dereekb/llm/test` | test infra | none | Tape replay, scripted completion and decision strategies, the decision answer builders (`makeLlmDecisionChoiceAnswer`, …), the `/systemone` wire fake, and the billed-lane test factories. |

## Browser safety

The root, `/decision`, `/craft`, `/openai`, `/openrouter` and `/zenmux` entries are browser-safe:

- They import no `node:` module or Node builtin and never read `process`. Hosts pass configuration (API keys, base
  URLs, model lists) in; nothing is read from the environment. Reading the environment or the file system is the job
  of `/node`.
- No core module imports craft (lint pins it), so a host that never imports `/craft` never loads it.
- A browser network failure (Chromium's `Failed to fetch`, Firefox's `NetworkError when attempting to fetch
  resource.`, Safari's `Load failed`) is classified like undici's `fetch failed`: transient.
- `openai` is the only SDK peer, and it is **optional**: it is loaded lazily from `/openai`'s single boundary module,
  so importing an entry never loads it. Install it only for a chat strategy that uses it. `/openrouter` loads no SDK
  of its own: its chat strategy reaches `openai` by importing `/openai`, and its decision strategy is a plain `fetch`
  over the core System One transport.
- The browser entries have one sibling edge, `/openrouter` → `/openai`, and it is one-way: `/openai` imports no other
  provider entry. Lint pins both directions.
- The required peers are `@dereekb/util` (its `/fetch` entry included), `@dereekb/model` (the JSON-Schema export;
  framework-free and browser-safe) and `arktype`.
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

## Strategy contract

A **strategy** is one configured backend: an `LlmRequest` goes in, an `LlmCompletion` comes out, and it never parses
the reply. `id` names the instance; `kind` names the transport (it defaults to `id`; read it with `llmStrategyKind`),
so several instances of one transport can be registered side by side. Those two, `describe` and the `healthCheck` /
`credentialProbe` seams are `LlmStrategyBase`, which the completion `LlmStrategy` and the decision lane's
`LlmDecisionStrategy` both extend.

- **Call types.** `LlmRequest` carries the prompt and capability, the per-call model, output cap and reasoning, the
  cache split, the prompt segments, a prior thread and image attachments. `LlmCompletion` carries the text, which
  strategy and model served it, usage and timing. `LlmDispatchResult` is a completion plus what a dispatcher adds:
  attempts, validation errors, decode status and the reply repair. Host data rides `meta`: the library never reads it
  and strategies echo it. `toLlmThreadChatMessages` maps a replayed thread onto plain chat messages and
  `toLlmAttachmentDataUrl` builds an attachment's `data:` URL. The stock transports default to
  `DEFAULT_LLM_MAX_OUTPUT_TOKENS` (8,192) and a `DEFAULT_LLM_COMPLETION_TIMEOUT_MS` (60 s) timeout floor.
- **Registry.** `makeLlmStrategyRegistry(seed)` serves either lane (`LlmStrategyRegistry<S>`; a registry of decision
  strategies is an `LlmDecisionStrategyRegistry`) and answers `get(id)`. Every instance of a transport is
  `strategies.values().filter((s) => llmStrategyKind(s) === kind)`, in registry order, and its `.at(-1)` is the last
  registered one. It is built on `@dereekb/util`'s `createKeyedRegistry`.
- **Readiness.** Three optional seams: `healthCheck` (no network), `credentialProbe` (one free authenticated request)
  and `providerStatus` (account windows and balance). `verifyLlmStrategies` throws when a required strategy is
  missing or not ready; `probeLlmCredentials` and `readLlmProviderStatus` report and never throw (one status read per
  account). The first two read any registry of `LlmStrategyBase`s; pass `lane: LLM_DECISION_STRATEGY_READINESS_LANE`
  to word the report for decision strategies (see [Strategies](#strategies)). Every stock strategy's
  `credentialProbe` runs the one ladder, `runLlmCredentialProbeLadder`: a missing key (and no injected fake) is an
  error, a host probe source is delegated to, an injected fake is ready without a request, and otherwise the
  transport's own `LlmTransportCredentialProbe` runs.
- **Quota gate.** `evaluateLlmQuotaGate({ report })` refuses only when a measured window is above the ceiling (90% by
  default) and fails open whenever nothing is measured. A window's `unit` is an `LlmQuotaUnit`: one of the library's
  own (`flow`, `request`, `token`, `usd`) or a host's own string for a provider it meters itself.
- **Usage and bills.** `toLlmUsage(raw, { costBasis })` folds a provider usage block: token counts default to `0`,
  every other field is omitted when not reported (absent is not zero), and numeric-string costs are parsed. An
  `LlmCallBillReader` reads what a call billed, later, by its generation id; `reconcileLlmCallBills` folds those reads
  against the logged cost (see [Readers, ledger and reconcile](#readers-ledger-and-reconcile)).
- **Prompt segments.** An `LlmPromptSegment` carries its exact bytes (trailing separator included) and an open
  `origin`. `joinLlmPromptSegments` builds the sent string, `splitLlmPromptCacheSegments` splits it for provider caching
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

- **Errors.** `isLlmAbortError` (a client deadline or cancel; test it first, since a connection timeout is also
  transient by class), `classifyLlmError` (`transient | permanent | unknown`, through `@dereekb/util/fetch`'s
  `classifyFetchError` with `LLM_ERROR_CLASSIFICATION_CONFIG`, the `openai` SDK's class sets),
  `isRetryableLlmErrorClassification` (the one resend rule both lanes apply), `formatLlmErrorSummary` (one bounded log line
  naming what was thrown) and `LlmDispatchFaultError` / `isLlmDispatchFaultError` (the structured rejection of a send
  error the policy does not resend). The generic predicates (`isFetchAbortError`, `isFetchNetworkError`,
  `classifyFetchError`) live in `@dereekb/util/fetch`.
- **Decode failures.** The seven `LlmDecodeFailureClass`es, `classifyLlmDecodeFailure` (the failure family) and
  `classifyLlmReplyOutcome` (what the reply looked like), the finish-reason predicates (`isLlmLengthCappedFinish`,
  `isLlmCleanStopFinish`, `isLlmReasoningOnlyReply`), the two sentinels a dispatcher stamps on a synthesized reply
  (`LLM_TIMEOUT_FINISH_REASON`, `LLM_TRANSPORT_FINISH_REASON`, `LLM_UNRETRYABLE_FINISH_REASON`) and the bounded
  excerpt helpers.
- **Retry lever.** `chooseLlmRetryLever` picks the ONE thing the next attempt changes (budget, model, reasoning off /
  low, structured output off, or nothing, with the reason); `applyLlmRetryLever` applies it.
- **Call records.** `LlmCallRecord`, `LlmCallStartRecord`, `LlmDecodeFailureRecord` and their event-type tags. A host's
  own fields sit at the top level: pass them as `H`. `llmCallTelemetry` projects the per-call telemetry block.
  `LlmCallLogPayload` is the persisted read-side view of a record (see
  [Readers, ledger and reconcile](#readers-ledger-and-reconcile)). Each placed or cut supplement row
  (`LlmCallSupplement`) carries a `hash` and a `bytes` size; `bytes` counts UTF-16 code units (`.length`), not bytes,
  and keeps its name because the row is persisted (as does the craft cut reason `'max-bytes'`).
- **Call context.** `makeLlmCallContext` times spans (`time` / `timeAsync`) into a nested profile of `child`
  contexts; `detached` starts a new root for work a context schedules but does not contain (it records one link to
  its origin and lands in the origin's `detachedProfiles`, never in `children`). Breadcrumbs (`diag`) and swallows go
  to the host's `onDiag` / `onSwallow` with the context's attribution, timing on or off. A child or detached
  attribution override merges over the parent's: an `undefined` field inherits the parent's value, a `null` overrides
  it. A dispatch reports its gaps through the dispatcher's `onGap`, not through the context. `noopLlmCallContext()` is
  the shared do-nothing context.
- **Taps.** `makeLlmDispatchTapRegistry` is a read-only observation seam: a tap that throws is counted in `health()`,
  never propagated. A tap may return any thenable; its rejection counts as an async failure. `makeLlmDispatchCollector` keeps every event.
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
const profile = context.profile(); // nested spans, breadcrumbs and swallows
```

```ts
import { classifyLlmError, formatLlmErrorSummary } from '@dereekb/llm';

try {
  return await strategy.complete(request);
} catch (error) {
  if (classifyLlmError(error) === 'transient') {
    logger.info(`resending: ${formatLlmErrorSummary(error)}`);
  }

  throw error;
}
```

## Readers, ledger and reconcile

What a host persists for each call, the readers that read it back, and the math that turns the rows into spend.

- **Persisted payload.** `LlmCallLogPayload<H>` is what a host's recorder writes for each `LlmCallRecord`: flat, every
  field optional except `capability`, host fields (`H`) beside the library's, never nested. `decodeOutcome` and
  `decodeStatus` are plain strings, since a logged row may name a value this build does not know. `text` is the MODEL's own
  bytes (the pre-repair text), so a tape replays what the model said and the deterministic repair re-runs on replay.

  | payload key(s) | from the `LlmCallRecord` |
  |---|---|
  | `capability`, `tier`, `decision`, `supplements` (only when non-empty), `reasoningOff`, `estimatedPromptTokens`, `phases` | the record's own fields |
  | `strategyId`, `strategyKind`, `model`, `provider`, `usage`, `latencyMs`, `generationId`, `finishReason`, `repair` | `llmCallTelemetry(record.result)` |
  | `attempts`, `validationErrors`, `decodeStatus`, `decodeOutcome`, `lengthCapped` | `record.result` |
  | `promptSegments` (heavy; persisting it is the host's choice) | `record.segments` |
  | `text` (heavy) | `record.result.repair?.originalText ?? record.result.text` |
  | `failedAttempts` (heavy; only when non-empty) | `record.failedAttempts` |
  | host fields | beside the library's, never nested |

- **Readers.** `readLlmCallPrompt`, `readLlmCallPromptSegments` and `readLlmCallFailedAttempts` take `unknown` and
  answer on a persisted payload, a flat-`prompt` one (no segments), or an in-memory `LlmCallRecord`; a malformed field reads
  as `undefined`, never a throw. Never dereference `promptSegments` yourself — a flat row has only `prompt`, and the
  prompt reader joins the segments when that is all there is.
  - `formatLlmCallAttempts(event, { repliesPointer })` returns the one-line retry summary of an `llm_call` event
    (`attempts 2 retried · #1 schema-validation: … → reasoning-low`, with ` (<repliesPointer>)` appended when given),
    or `undefined` for a clean call and for any other event.
  - `isDecisionLlmCallRow(payload, kinds)` marks a decision-lane row: its lane (`strategyKind`, else `strategyId`) is
    in `kinds`, or it carries a `decision` id. Build `kinds` once with `readLlmDecisionStrategyKinds(adapters)`; rows this
    library's dispatcher wrote always carry `decision`, so `kinds` only matters for rows without one.
- **Usage cells.** `LlmUsageCell` (calls, prompt / completion / cached / reasoning tokens, cost, and
  `uncacheablePromptTokens` when above zero), with `toLlmUsageCell(usage, uncacheable)`, `addLlmUsageCells`,
  `accumulateLlmUsageCell(map, key, cell)` and `toLlmKeyedUsageCells(map)` (sorted by key). Cells are plain JSON: a
  persisted cell missing a field adds it as `0`, never `NaN`, and a re-fold of persisted cells is byte-stable.
- **Cost honesty.** `formatLlmUsageCost({ cost, calls, partial, listed })` renders `n/a` when no call priced itself,
  `>=$x` when some call did not (a lower bound), `<=$x` for list prices (an upper bound on the bill), `~$x` when both
  hold, and `$x` otherwise. A zero-call row is an exact `$0`. `resolveLlmUsageCostMarker` takes custom spellings (`≥`,
  `≤`), and `readLlmUsageCostFlags` maps a fold's `costPartial` / `costListed` flags onto a read.
- **Rates.** `computeLlmCacheHitRate` (cached over CACHEABLE prompt tokens, so decision-lane calls, which have no prompt
  cache, do not dilute it), `computeLlmReasoningShare`, `isUncacheableLlmCall(payload, kinds)` (a `decision` id, or a
  `strategyKind` in `kinds` — no `strategyId` fallback, unlike `isDecisionLlmCallRow`), `toLlmCapabilityCacheRows`,
  `renderLlmCacheHitLine({ cell, cachePartial, reasoningPartial })` and `formatLlmUsageRate`. `undefined` means
  "nothing to divide by", never 0%.
- **Bill reconcile.** `reconcileLlmCallBills({ calls, reader, concurrency?, signal? })` reads each call's bill through
  any `LlmCallBillReader` (e.g. `/zenmux`'s `makeLlmZenmuxGenerationBillReader`) and folds billed against logged cost per
  model. Pending and failed reads are counted and kept as details, never folded as zero; once `signal` aborts, no new
  read starts and each unread call is pending. `computeLlmBilledShare` gives billed / logged (a `PercentDecimal` that
  may exceed 1), and `renderLlmBillReconciliationMarkdown(reconciliation, sessionId)` renders the result. Calls with no
  recorded model fold into one `byModel` row whose `model` is `undefined`; the markdown labels it `(unknown model)`.

```ts
import {
  accumulateLlmUsageCell,
  addLlmUsageCells,
  emptyLlmUsageCell,
  formatLlmUsageCost,
  isUncacheableLlmCall,
  readLlmDecisionStrategyKinds,
  toLlmKeyedUsageCells,
  toLlmUsageCell,
  reconcileLlmCallBills,
  renderLlmBillReconciliationMarkdown,
  renderLlmCacheHitLine,
  type LlmCallLogPayload,
  type LlmUsageCell
} from '@dereekb/llm';

declare const rows: ReadonlyArray<LlmCallLogPayload>; // read back from the host's log

const decisionKinds = readLlmDecisionStrategyKinds(adapters);
const byModel = new Map<string, LlmUsageCell>();
let total = emptyLlmUsageCell();
let costPartial = false;

for (const row of rows) {
  const cell = toLlmUsageCell(row.usage, isUncacheableLlmCall(row, decisionKinds));
  total = addLlmUsageCells(total, cell);
  accumulateLlmUsageCell(byModel, row.model ?? '(unknown model)', cell);
  costPartial ||= row.usage?.cost == null;
}

for (const { key, cell } of toLlmKeyedUsageCells(byModel)) {
  console.log(`${key}: ${cell.calls} call(s) ${formatLlmUsageCost({ cost: cell.cost, calls: cell.calls, partial: costPartial })}`);
}

console.log(renderLlmCacheHitLine({ cell: total })); // cache 73.2% hit (6,000/8,200 prompt tok) · reasoning …

const reconciliation = await reconcileLlmCallBills({ calls: rows, reader: billReader });
console.log(renderLlmBillReconciliationMarkdown(reconciliation, 'session-1'));
```

## Model configuration

Which models a host runs, and which backend serves each one, is configuration rather than code. The library holds the
pure half — the file shape, a fail-loud parse, the overlay of a host's built-ins, and resolution. It reads no
environment variable and no file: `/node` does that, and a browser host passes the parsed JSON in. On Node, the
[Node host quick start](#node-host-quick-start-dereekbllmnode) shows `/node` doing those reads.

- **Tiers.** A capability names a tier (`fast`, `strong`, or any key a host adds), never a slug.
  `resolveLlmModelTiers({ base, modelTiers, defaultTier })` merges the host's declaration over its own base map and
  fails loud when the default tier is missing; `resolveLlmModelTier` fails loud on an unknown key. Every reader names
  the default tier through `resolveLlmDefaultModelTierKey` (trimmed; blank or unset ⇒ `fast`). A tier value is a slug
  or `{ model, maxOutputTokens?, reasoning? }` — read it with `readLlmTierModel` / `toLlmTierConfig`. The library ships
  no slugs.
- **Tier values are strict.** `parseLlmModelTierValue` / `parseLlmModelTierMap` (and the env tier reader) reject a
  blank or untrimmed slug and a token cap (`maxOutputTokens`, `reasoning.maxTokens`) that is not a positive integer,
  and report `<label>.<field> must … (got <value>).`, prefixed with the schema label when one is passed
  (`schemaLabel`). The value types are derived from arktype declarations (`llmModelTierValueType`,
  `llmReasoningConfigType`, … in `llm.model.type.ts`); `LLM_REASONING_EFFORTS` is the effort list.
  `parseLlmModelConfigFields` and `assertLlmModelConfigKeys` are the same field and key checks, exported so a host's
  own extension keys report in the same format.
- **The file.** `parseLlmModelConfigFile({ raw, source, schema })` validates a `models.json`-shaped object: named
  `providers`, `profiles` (complete tier maps), per-slug `models` facts, `active`, and the unread `notes` / `$schema`.
  An unknown key, an illegal value or a malformed tier throws an error naming the file and the entry, so a typo
  reddens startup instead of billing the model you meant to leave. A provider names the env var holding its key
  (`apiKeyEnv`), never the key. An unknown top-level key lists the allowed ones in the one key order,
  `LLM_MODEL_CONFIG_FILE_KEYS` (`$schema`, `notes`, `active`, `providers`, `profiles`, `models`), and a tier error
  inside the file carries the schema label (`my-app models: models.json profiles['free']['fast'] …`). The parsed file
  splits the on-disk `providers` block three ways: `providers` (completion providers — the only ones a completion
  reader mints strategies for), `extensionProviders` (entries of a transport the extension owns) and `providerPatches`
  (an extension's fields declared alone). `parseLlmProviderEntry` answers which (`{ kind: 'completion' | 'extension',
  entry }`). `flattenLlmModelConfigFile(file)` is the reverse: the plain on-disk object, keys in the constant's order,
  profiles flattened, and `providers` written as completion entries, then owned entries, then patches.
- **Schema and extensions.** `makeLlmModelConfigSchema({ label, transports, meterings, decisionRoutes,
  implicitProviders, retiredKeys, extension })` sets the legal values and the error label. An extension adds provider
  and model keys with their parsers, transports it owns (providers that serve no completions), patch entries (an entry
  with no transport, base URL or key var that extends the built-in provider of the same name) and metering sources. A
  retired key fails with the remedy you register. The entry and per-slug types are derived from arktype declarations
  (`llmCompletionProviderEntryType`, `llmModelSettingsType`, … in `llm.model.config.type.ts`), and an extension's
  fields are typed `Partial<…>` on every entry, patch and resolved config — a provider that leaves them out is still
  well-typed, so the extension seam needs no cast. Declare an extension's fields the same way: an arktype type with
  `'+': 'delete'`, read through `parseLlmModelConfigFields`.
- **Overlay.** `overlayLlmModelConfigFile({ base, file, source, schema })` lays a host's file over its built-ins. A
  provider, profile or per-slug entry the file names replaces the built-in whole — a half-replaced provider would bill
  one account at another's endpoint — and every `models[slug].provider` is then checked against the merged providers.
  A patch's `undefined` field and a host-built overlay's `undefined` slug keep the base's value.
- **Resolution.** `resolveLlmModelProfile({ file, override, schema })` picks the active profile: the override wins,
  an off value (`off` / `none` in any case, `LLM_OFF_VALUES` / `isLlmOffValue`) or a blank `active` selects nothing,
  and a name the file lacks throws. `llmModelReasoningOffEncodings`,
  `llmModelVisionCapabilities`, `llmModelPromptAddenda` and `llmModelProviderBindings` project the per-slug facts,
  each a one-line `mapLlmModelSettings({ file, read })` — the generic projector a host uses for its own per-slug
  fields (only the slugs `read` answers for are kept; `undefined` when none is).
  `resolveLlmProviderConfigs({ providers, apiKeyOf })` turns the declared completion providers into
  `LlmProviderConfig`s that carry the key value, and lists the declared providers whose key is missing.
- **Wire vocabulary.** `LLM_REASONING_OFF_ENCODINGS` (how an OpenAI-compatible wire says "reasoning off":
  `effort-none`, `effort-minimal`, `nested-disabled`, `omit`), `resolveLlmReasoningOffEncoding` (the slug's own, then the
  fallback, then `effort-none`), `LLM_TOKEN_LIMIT_PARAMS`, and the per-slug `LlmModelReasoningOffMap` /
  `LlmModelVisionMap` the transports read. `normalizeLlmReasoningConfig` applies the one OFF rule: an explicit
  `enabled: false` drops every other knob (`effort`, `maxTokens`, `exclude`) before any transport maps the config.

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
const { providers, gaps } = resolveLlmProviderConfigs({ providers: effective.providers, apiKeyOf: ({ entry }) => keys[entry.apiKeyEnv] });
```

## Model routing

A host moves a capability to another model without touching code. Routing rules map capabilities — by key or by tag —
onto a tier or a slug, and one precedence ladder decides what each call runs on, so a dispatcher and a report that
explains the choice read the same answer.

- **Parse.** `parseLlmModelRoutingConfig({ raw, source, label? })` validates a routing block read from JSON (or an env
  var) into an `LlmModelRoutingConfig` and fails loud naming the field — an unknown key, a non-array `rules`, a
  `"tags": "support"` string, a `"maxOutputTokens": "9000"` string or a non-integer cap, a bad `reasoning`, or a bad
  `tiers` value (the tier parser's own message). It checks shapes only; `compileLlmModelRouting` checks names.
- **Rules.** `compileLlmModelRouting({ routing, capabilities, tiers, providers, label })` (a thin caller of the shared
  `compileLlmCapabilityRules`, which also compiles the critique policy; a rule is an `LlmCapabilityRuleTarget`, i.e.
  `capabilities` and/or `tags`) compiles an
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
- **Vision.** `resolveLlmCapabilityVision({ …, visionByModel })` — the slug a capability bills and whether it accepts images.

```ts
import { compileLlmModelRouting, llmModelProviderBindings, parseLlmModelRoutingConfig, resolveLlmCapabilityModel, resolveLlmCapabilityProvider, resolveLlmModelTiers } from '@dereekb/llm';

const routing = parseLlmModelRoutingConfig({ raw: JSON.parse(routingText), source: 'routing.json' });
const { tiers, defaultTier } = resolveLlmModelTiers({ base: BUILT_IN_TIERS, modelTiers: { ...routing.tiers, ...profile?.tiers }, defaultTier: routing.defaultTier });
const routes = compileLlmModelRouting({ routing, capabilities: [{ capability: 'support-reply', tags: ['support'] }, { capability: 'summarize' }], tiers, providers: ['local', 'openrouter'] });

const route = routes.get('support-reply');
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
  `findLlmAdapter`, `resolveLlmAdapter` (throws naming the registered kinds), `filterLlmAdaptersByFacet` and `readLlmAdapterKinds`.
  `readLlmModelConfigLists(adapters)` gives `makeLlmModelConfigSchema` its `transports`, `meterings` and
  `decisionRoutes`.
- **Strategies.** `makeLlmProviderStrategies({ providers, adapters, defaultModel, maxOutputTokens, timeoutMs,
  visionByModel, reasoningOffByModel })` builds one strategy per resolved provider (`resolveLlmProviderConfigs`),
  registered under the provider's own name. Construction is inert. Both builders check each minted strategy with
  `checkLlmAdapterStrategy` (the provider's own id; a decision strategy's declared `strategyKind`).
- **Config contract.** An adapter config's unset field is absent or nullish (`undefined` / `null`). Read each with `??`,
  as the stock adapters do, and never spread a config over your own defaults: `mergeObjects` keeps a default against
  an explicit `undefined`.
- **Accounts.** `resolveLlmProviderAccount({ provider, adapters })` decides which account a provider bills — its
  declared `metering`, else the metering adapter that recognizes its base URL, else `none` — and every account fact
  follows that one answer: cost basis, status source (`providerStatusSource`), credential probe and bill reader. `resolveLlmProviderBaseUrl` and
  `resolveLlmProviderMetering` answer the parts for a report.
- **Decisions.** `resolveLlmProviderDecisionRoute` reads a provider's declared `decision`, else the route a decision adapter
  serves for its transport, else `none` — never its base URL. `llmDecisionCapableProviders({ providers, adapters,
  routePreference })` keeps the routed, keyed providers in your route order (default: registration order), then
  provider order; the first is the lane's default. `makeLlmDecisionStrategies(…)` builds the decision registry (empty
  when nothing can serve), `readLlmDecisionStrategyKinds(adapters)` tells a decision call record from a completion one, and
  `llmDecisionModelIssue(model)` refuses a completion slug before any call is made.

```ts
import { readLlmModelConfigLists, makeLlmAdapterRegistry, makeLlmDecisionStrategies, makeLlmModelConfigSchema, makeLlmProviderStrategies, makeLlmStrategyRegistry, resolveLlmProviderConfigs } from '@dereekb/llm';

const adapters = makeLlmAdapterRegistry(PROVIDER_ADAPTERS); // the adapters your provider entries export
const schema = makeLlmModelConfigSchema({ ...readLlmModelConfigLists(adapters), label: 'my-app models' });
const { providers } = resolveLlmProviderConfigs({ providers: effective.providers, apiKeyOf: ({ entry }) => keys[entry.apiKeyEnv] });

const strategies = makeLlmStrategyRegistry(makeLlmProviderStrategies({ providers, adapters, defaultModel, timeoutMs: 60_000 }));
const decisions = makeLlmDecisionStrategies({ providers, adapters, routePreference: ['zenmux', 'openrouter'] });
```

## Prompt building

The contracts a prompt is built against: the capability a call is made for, the slot layout that orders a prompt, the
contributor seam that supplements it, the live context a capability renders and the templates that supply authored
text, and the assembly that turns them into bytes. Around them sit the helpers a dispatcher and its host share: site
scopes, prompt handles and chains, a live-context token budget, a cache-prefix watch and two library contributors.

- **Capabilities.** An `LlmCapabilityDescriptor` is one capability's reply contract: its key, its reply protocol (`json`,
  `json-envelope` or `line`; `resolveLlmReplyProtocol` applies request, then descriptor, then the host default), its
  routing and output controls (it fits the routing compile and the model precedence as-is), the arktype schema and
  parser, the schema projections the output contract and `response_format` read, a frames policy keyed by slot id, and
  `traits` — the host's own flags, which the library never reads.
- **Dispatch.** `LlmDispatchRequest` is what a capability hands a dispatcher (the live-context renderer, overrides, a
  validator, a critic, a site, the parent call context, `meta`, an abort `signal`). `LlmDispatcher` dispatches it or
  prepares an `LlmPrompt`, which executes once and chains follow-ups onto the same thread (`ExecutedLlmPrompt`). Hosts
  extend the request and result types and pass them as `R` and `X`.
- **Reply checks.** `LlmValueValidator` (sync: is it well-formed?), `LlmCritic` (async and billed: is it good? never
  throws) and `LlmReplyFastFixer` (one cheap call that repairs a mangled JSON reply from the scorer's `JsonRepairShape`,
  from `@dereekb/util`).
  Reading, repair, schema projection and the critique policy have their own section, Replies.
- **Layout.** `LlmPromptLayout` is an ordered array of slots `{ id, role, occupancy, separator, lastSeparator? }`. The
  array is the prompt order; a role only says what fills a slot. `defineLlmPromptLayout` validates one, and
  `DEFAULT_LLM_PROMPT_LAYOUT` names every slot after its role. The dispatcher's `correction` and `follow-up` roles are
  declared like any other: the slot names the segment id, and its `lastSeparator ?? separator` is appended after the
  piece (`''` in the default layout). `findLlmPromptSlotByRole` and `readLlmPromptSlotSeparator` read a layout the same
  way the assembly does.
- **Contributors.** An `LlmPromptContributor` reads the request, descriptor, model and templates once per dispatch and
  offers contributions for the slots it declares. `resolveLlmPromptContributions` runs contributors in registry order;
  `assertLlmPromptContributionOccupancy` fails loud on an undeclared slot, an assembly-owned slot or a second
  contribution to a single slot; `mergeLlmLiveContextContributions` places live-slot contributions among the
  capability's blocks at their anchors; `toLlmPromptSupplements` builds a call record's `supplements` rows.
- **Live context.** `LlmLiveContextBlock`s are keyed sections (`llmLiveContextBlock`, rows blocks, fact rows).
  `orderLlmLiveContextBlocks` sorts by a sparse rank table with a key tiebreak, so any input order sends the same
  bytes. The tiebreak compares keys by UTF-16 code unit (`@dereekb/util` `compareStringsByCodeUnit`), never the host's
  locale, so every host sends the same bytes (`Beta` before `alpha`). Craft-note selection, usage rows and the bill
  reconciliation order by code unit too. `llmChainedFollowUpBody` re-sends only what changed since the thread's last turn.
- **Templates.** An `LlmPromptTemplateResolver` returns a dispatch's templates per role (`reply-protocol`,
  `instructions`, `context`, the last split at `{{liveContext}}`) with their `source`, plus a by-key lookup for
  contributors. `makeLlmTieredPromptTemplateResolver` is the library's: tiers lowest first, the last definition of a key
  wins, a capability-scoped template beats a shared one. A host with another cascade supplies its own resolver.
- **Assembly.** `composeLlmCapabilityPrompt` is the one prompt pipeline: it renders the request's live context, looks
  the descriptor up through the injected `descriptorOf`, awaits the template resolver once, resolves the contributors in
  registry order and assembles. `assembleLlmCapabilityPrompt` is its synchronous last step (resolved templates and
  contributions in, segments out) for previews and goldens. The layout drives it: each slot, in order, holds what its
  role says — contributions (frames, the model addendum, craft notes, in contribution order), the reply protocol (the
  `reply-protocol` template, or the built-in line protocol for a `line` call), at most one amendment (must-resolve, for a
  JSON protocol and a `mustResolve` descriptor; a clause only some calls carry is the host's, contributed from a `frame`
  slot it declares next to the amendment slot — its segment id may name that slot, so the bytes read as one amendment),
  the `instructions` template, the `context` template split at its first `{{liveContext}}`, the output contract (JSON protocols with a
  descriptor) and the live blocks with the live slot's contributions merged at their anchors. Each piece is closed by
  its slot's separator; bytes with no slot to land in fail loud. The result is `{ segments, prompt, cacheSegments }`, the
  last two derived from the segments. An empty live context still places one empty volatile segment, and an all-stable
  one forces its last block volatile, so the cache split never moves past the live context.
- **Output contract.** `renderLlmOutputContract` renders the contract schema (the descriptor's `contractSchemaHint()`,
  or a per-call override) as one bullet per field — name, type label, required or optional, the field's description —
  expanding an array of objects into an indented block where that delivers prose.
- **Texts.** The line protocol, the must-resolve amendment and the contract's intro and footer have library defaults
  (`DEFAULT_LLM_PROMPT_ASSEMBLY_TEXTS`); a host passes its own exact text through `texts`, and one call its own footer
  through `contractFooter`.
- **Sites.** `mergeLlmPromptSite` merges two sites, the narrower winning (its `kind` replaces; facts, inputs and supply
  merge key by key). `withLlmPromptSite({ dispatcher, site })` returns a dispatcher whose every request,
  dispatched or prepared, carries the site — the request's own site winning, a later wrapper narrower than an earlier
  one. It never changes a byte; a contributor reading the site does.
- **Prompt handles.** `makeLlmPromptFactory({ runPromptRequest })` builds `LlmPrompt`s that execute once (a rejected
  execution is cached too) and chain follow-ups onto the same thread. A recorded reply is capped at 8,000 characters
  (`threadTurnMaxChars`), and a reply the run marks `degenerate` is recorded as a placeholder
  (`degenerateThreadPlaceholder`), so no later follow-up replays — and re-bills — a garbage turn.
- **Chains.** `makeLlmPromptChain({ lead })` is one chained-follow-up instance. `chain.dispatch({ dispatcher, request,
  previous })` fires a root, or chains a follow-up onto `previous` whose message is the lead plus only the live blocks
  that changed since the thread last saw them (unchanged ones are named, not re-sent). The instance holds what each
  handle sent, weakly; two instances never share it.
- **Budget.** `estimateLlmTokens` is `ceil(length / 4)`; `estimateLlmRequestPromptTokens` estimates a whole request
  (prompt, replayed thread, response schema). `budgetLlmLiveContextBlocks` keeps a live context under a token budget
  (default 12,000, less `reservedPrefixTokens`) by shrinking, then dropping, the lowest-priority blocks — never a
  `required` one, and never blocking a send. `toLlmBudgetTrimSummary` folds the trim report for a host's log.
- **Cache watch.** `makeLlmPromptCachePrefixWatch()` hashes each dispatch's cacheable prefix (16 hex chars of SHA-256)
  and compares it with the previous dispatch of the same capability and partition, naming the first segment — and its
  key — that moved, or the first one appended. It keeps digests, never prompt bytes.
- **Library contributors.** `makeLlmModelAddendumPromptContributor({ promptAddendumByModel })` places the resolved model's
  `promptAddendum` (from `llmModelPromptAddenda(config)`) in the `model-addendum` slot; `llmModelAddendumSegment` mints
  the same segment, and `restampLlmModelAddendum` swaps a captured prompt's addendum for another model's, placing it
  where the layout puts the addendum slot (before the first captured segment whose slot comes later, else last).
  `makeLlmAnchoredBlockPromptContributor({ id, reason, blockOf })` places one block a scope supplied among the capability's
  live blocks, at its anchor. The craft contributor has its own section, [Craft notes](#craft-notes).

A layout with a host frame slot, one contributor that fills it, and a live-slot contribution anchored among the
capability's blocks:

```ts
import { assertLlmPromptContributionOccupancy, type LlmPromptContributor, llmLiveContextBlock, llmLiveContextHeadingBlock, defineLlmPromptLayout, mergeLlmLiveContextContributions, resolveLlmPromptContributions } from '@dereekb/llm';
import { filterMaybeArrayValues } from '@dereekb/util';

const layout = defineLlmPromptLayout([
  { id: 'brand-voice', role: 'frame', occupancy: 'single', separator: '\n\n' },
  { id: 'instructions', role: 'instructions', occupancy: 'single', separator: '\n\n' },
  { id: 'live', role: 'live', occupancy: 'many', separator: '\n\n', lastSeparator: '' }
]);

const brandVoice: LlmPromptContributor = {
  id: 'brand-voice',
  slots: ['brand-voice', 'live'],
  resolve: ({ templates }) => ({
    contributions: [
      { contributor: 'brand-voice', slot: 'brand-voice', id: 'brand-voice', text: templates.byKey('brand-voice')?.text ?? 'Be warm.', origin: { kind: 'template' }, reason: 'every summarize call speaks in the brand voice' },
      { contributor: 'brand-voice', slot: 'live', id: 'live', key: 'glossary', text: 'Glossary: SKU = stock-keeping unit.', origin: { kind: 'live-context' }, reason: 'the site supplied a glossary', anchor: { after: 'heading' } }
    ]
  })
};

const blocks = filterMaybeArrayValues([llmLiveContextHeadingBlock(), llmLiveContextBlock({ key: 'subject', lines: ['Subject: a desk lamp'] })]);
const { contributions } = await resolveLlmPromptContributions([brandVoice], { request, descriptor, templates, liveBlockKeys: blocks.map((block) => block.key) });

assertLlmPromptContributionOccupancy(contributions, layout);
const live = mergeLlmLiveContextContributions({ blocks, contributions, slot: 'live' }); // heading, glossary, subject
```

The library's tiered template resolver over a `defaults` and an `app` tier:

```ts
import { makeLlmTieredPromptTemplateResolver } from '@dereekb/llm';

const templateResolver = makeLlmTieredPromptTemplateResolver({
  tiers: [
    { source: 'defaults', templates: [{ key: 'instructions', role: 'instructions', text: 'Summarize the input.' }] },
    { source: 'app', templates: [{ key: 'summarize-instructions', role: 'instructions', capability: 'summarize', text: 'Summarize in two sentences.' }] }
  ]
});

const templates = await templateResolver({ request: { capability: 'summarize', renderLiveContext: () => [] }, descriptor: undefined });
templates.roles.instructions?.source; // 'app'
```

A three-capability host composing a prompt: a `brand-voice` frame before the default slots, the tiered resolver above,
a `descriptorOf` over a `Map`, and the `brandVoice` contributor from the first example:

```ts
import { composeLlmCapabilityPrompt, DEFAULT_LLM_PROMPT_LAYOUT, type LlmCapabilityDescriptor, defineLlmPromptLayout } from '@dereekb/llm';

const layout = defineLlmPromptLayout([{ id: 'brand-voice', role: 'frame', occupancy: 'single', separator: '\n\n' }, ...DEFAULT_LLM_PROMPT_LAYOUT]);
const descriptors = new Map<string, LlmCapabilityDescriptor>([
  ['summarize', summarizeDescriptor],
  ['classify', classifyDescriptor],
  ['reply', replyDescriptor]
]);

const composed = await composeLlmCapabilityPrompt({
  request: { capability: 'summarize', renderLiveContext: () => blocks },
  layout,
  descriptorOf: (capability) => descriptors.get(capability),
  templateResolver,
  contributors: [brandVoice]
});

composed.prompt; // the bytes sent
composed.cacheSegments; // { cachePrefix, volatileSuffix } — the split never moves past the live context
```

The output contract on its own:

```ts
import { renderLlmOutputContract } from '@dereekb/llm';

renderLlmOutputContract({ schema: { type: 'object', properties: { summary: { type: 'string', description: 'two sentences' } }, required: ['summary'] } });
// ## Output contract
//
// Return a JSON object with these fields:
// - `summary` (string, required): two sentences
//
// Use these field names exactly, and leave out an optional field rather than invent a value for it.
```

A run scoped to a glossary, with an anchored contributor that places it and a chain over the run's items:

```ts
import { type LlmAnchoredBlock, makeLlmAnchoredBlockPromptContributor, type LlmDispatchRequest, type LlmPromptSite, makeLlmPromptChain, withLlmPromptSite } from '@dereekb/llm';

interface RunSupply {
  readonly glossary?: LlmAnchoredBlock;
}

interface RunRequest extends LlmDispatchRequest {
  readonly site?: LlmPromptSite<RunSupply>;
}

// Registered with the dispatcher's contributors.
const glossary = makeLlmAnchoredBlockPromptContributor<RunRequest>({ id: 'glossary', reason: 'the run supplied a glossary', blockOf: ({ request }) => request.site?.supply?.glossary });

const scoped = withLlmPromptSite<RunRequest>({ dispatcher, site: { supply: { glossary: { text: 'Glossary: SKU = stock-keeping unit.', anchor: { after: 'heading' }, volatile: false } } } });
const chain = makeLlmPromptChain<RunRequest>();

const first = await chain.dispatch({ dispatcher: scoped, request: itemRequest(items[0]) });
// Replays `first`'s thread, then sends the lead plus only the live blocks that changed ("Unchanged …" names the rest).
const second = await chain.dispatch({ dispatcher: scoped, request: itemRequest(items[1]), previous: first });
```

A budgeted live context:

```ts
import { budgetLlmLiveContextBlocks, LLM_PROMPT_PREFIX_RESERVE_TOKENS } from '@dereekb/llm';

const budgeted = budgetLlmLiveContextBlocks({
  blocks: [
    { key: 'heading', text: '## Live context', priority: 9, required: true, volatile: false },
    { key: 'history', text: historyText, priority: 1, shrink: [recentHistoryText] }
  ],
  reservedPrefixTokens: LLM_PROMPT_PREFIX_RESERVE_TOKENS
});

const request = { capability: 'summarize', renderLiveContext: () => budgeted.blocks };
budgeted.trimmed; // [{ priority: 1, action: 'shrunk', savedTokens: … }] when the history had to shrink
```

## Craft notes

Craft is the opt-in `@dereekb/llm/craft` entry: the root does not export it.

A craft note is authored know-how about a target (a page type, a reply channel) that a contributor places, verbatim, in
the `craft` slot of the prompts written for it. Code composes no English around a note. Notes come from ordered tiers,
are matched against the request's site, are optionally judged by one decision call, and are budgeted.

- **Notes.** A markdown file with a frontmatter block: `id` (`^[a-z0-9][a-z0-9-]{1,63}$`), `title`, `sites`, `where`,
  `ask`, `floor` (default 0.6), `unserved` (default `omit`), `priority` (default 4, 0–8) and `enabled`. The body is at
  most 1,500 characters (UTF-16 code units; `DEFAULT_LLM_CRAFT_NOTE_MAX_CHARS`, overridable by the registry's
  `noteMaxChars`) and is never truncated. The frontmatter is read by `@dereekb/util` `parseMarkdownFrontmatter`: bare,
  double-quoted (JSON) and single-quoted scalars, `[a, b]` and `- item` lists, one level of nesting, and comments, and
  every refusal names its line. Craft adds the required fence, the schema and the cross-field rules.
  `parseLlmCraftNote` / `parseLlmCraftNoteSet`.
- **Sites.** `makeLlmCraftSiteRegistry({ sites })` declares each kind's facts (`closed` / `open` / `boolean`), its
  free-text inputs and its limits (`LlmCraftSiteLimits`): `maxNotes` 4 notes, `maxChars` 3,000 body characters,
  `judgeMax` 8 judged notes and `judgeInputMax` 600 characters per judged input, each overridable per registry and per
  site. Characters are UTF-16 code units; a note past `maxChars` is cut `max-bytes` (the stored reason's name). `llmCraftNoteUnknownWhereValues` names a `where` value your vocabulary cannot
  produce, for an authoring check.
- **Tiers.** Lowest precedence first; a higher tier shadows by id, and `enabled: false` is a tombstone. A tier is a
  static array or a per-request reader. `makeLlmCraftNoteRowReader` parses stored rows, memoized, and a tombstone row
  hides its id whatever text it kept.
- **Selection.** AND across `where` keys, OR within a list, and a missing fact never matches; then the host guard; rank
  (priority, then specificity, then id); `judgeMax`; the floor and the unserved posture; the budget.
  `selectLlmCraftNotes` selects in one step when the verdicts are known.
- **Judge.** `makeLlmCraftJudge({ sites, dispatcher, available, onUnavailable, swallow })` asks one Noul question per
  asked note (its `ask` verbatim). Its state is only the named inputs, clipped. `dispatcher` is a value or a getter read
  on every call — a getter is the usual case, since the judge rides the contributor of the very dispatcher it asks,
  which is built after it. `available(params)` and `onUnavailable(params)` see the call's `LlmCraftJudgeParams` (the
  dispatch `request`, the site `kind`, the `asked` notes and the `inputs`), so one judge can gate per call. It makes at
  most one call per dispatch, under the request's capability, and a fault or a closed gate answers nothing (each note
  takes its `unserved` posture). The call record is stamped `{ craft: { asked, kept } }` under decision
  `CraftNoteSelect`.
- **Contributor.** `makeLlmCraftPromptContributor({ sites, tiers, guard, judge, headings, slot, enabled })` asks its
  `judge` about the judged notes (no judge: each takes its `unserved` posture), gives each group one heading, puts the
  stable group on the cache prefix and the judged group after it as volatile, and records every cut on the call's
  `supplements`. A per-request tier that fails to parse logs one `craft-note-invalid` breadcrumb per file.
- **Building blocks.** For an explain view or an authoring tool: `mergeLlmCraftNoteTiers`, `resolveLlmCraftCandidates`
  then `settleLlmCraftNotes` (or `selectLlmCraftNotes` with known verdicts), `toLlmCraftContributions`,
  `readLlmCraftNoteGroup` and `isLlmCraftNoteKept` (the one keep rule: a verdict at or above the note's floor).

A note file, `apparel-plain.md`:

```md
---
id: apparel-plain
title: Plain apparel pages
sites: [product-page]
where:
  category: [apparel]
ask: "`brief` asks for a garment with no logo or print."
unserved: include
---
Name the fabric and the cut first. Never describe a logo the brief did not ask for.
```

The registry, the tiers, the judge and a judged site:

```ts
import { makeLlmCraftPromptContributor, makeLlmCraftJudge, makeLlmCraftNoteRowReader, makeLlmCraftSiteRegistry } from '@dereekb/llm/craft';

const sites = makeLlmCraftSiteRegistry({
  sites: {
    'product-page': { facts: { category: 'closed', brand: 'open' }, inputs: ['brief'] },
    'support-reply': { facts: { channel: 'closed' }, inputs: ['message'], limits: { maxChars: 2400 } }
  }
});
const readRows = makeLlmCraftNoteRowReader({ tier: 'workspace', sites });

// the judge asks the dispatcher the contributor rides, built below — hence the getter
const judge = makeLlmCraftJudge<ShopRequest>({ sites, dispatcher: () => dispatcher, available: ({ request }) => request.craftJudge !== 'off' });

const craft = makeLlmCraftPromptContributor<ShopRequest, ShopDescriptor>({
  sites,
  tiers: [BUILTIN_CRAFT_NOTES, machine.notes, ({ request }) => readRows(request.craftRows)],
  guard: ({ descriptor }) => descriptor?.traits?.customerFacing === true,
  judge
});

const dispatcher = makeLlmDispatcher({ …, contributors: [craft] });

const site = { kind: 'product-page', facts: { category: 'apparel', brand: 'acme' }, inputs: { brief } };
```

## Replies

What happens to a reply between the strategy and the capability: it is read per its reply protocol, repaired when it
nearly parses, validated against the capability's schema, and optionally judged by a billed critic. A capability
descriptor also carries the two schema projections the request and the prompt read.

- **Protocols and reading.** The decoded reply payload is the reply's **value**. `json`: the parsed object is the
  value, never unwrapped and never declined. `json-envelope`: `LlmReplyEnvelopeKeys` (default `value` /
  `answerable` / `rationale`; a host with its own value key passes it, e.g. `{ value: 'result', … }`); `answerable: false` declines,
  a hedged decline keeps its value, and a bare object reads as the value. `line`: `readLlmLineReplyValue` lifts the
  bare line into `{ line }`. `readLlmReply` classifies `value` / `declined` / `no-json` / `parse-error`; `readLlmReplyValue`
  is the thin wrapper and `readLlmReplyRationale` reads the rationale. The slicer is `@dereekb/util`
  `readJsonObjectFromText`: it tries the greedy `{…}` slice, then each balanced top-level object, and never invents a
  brace. An envelope host passes `llmReplyEnvelopeContractIntro(keys)` as its contract intro.
- **Repair.** `repairLlmReplyJson` / `scoreLlmReplyJson` walk a reply once and give one of four verdicts: `near-miss`
  (repaired), `mangled`, `truncated-looking` or `not-json` (below a score of 0.2). Ten deterministic ops (closers,
  commas, stray closers, control escapes, trailing prose, fences; a second pass escapes inner quotes). A reply that ends
  inside a string or after `:` / `,` / a key / an opener is never repaired. `llmReplyRepairFidelity` gates every repair:
  nothing invented, and at least 90% of the 12+-char content literals kept. The three are thin wrappers over
  `@dereekb/util` `repairJsonObjectText` / `scoreJsonObjectText` / `checkJsonRepairFidelity`; their `{ envelope }`
  option takes the coverage check over the balanced object under the envelope's value key (an unclosed or non-object one keeps
  the rest of the reply), and without it the whole reply is the payload. The dispatcher passes the call's reading
  envelope (`resolveLlmReplyReadingEnvelope`: the host's keys on `json-envelope`, none on `json`). The shape types are
  util's `JsonRepair*`.
- **Fast fix.** `makeLlmReplyFastFixer({ requestOf, metaOf })` makes one `RepairReplyJson` call
  (`maxAttempts: 1`), handed only the broken reply, the subject's schema and a one-line diagnosis. It answers `fixed`, or
  `missed` with `truncated` / `declined` / `unusable` / `fidelity` / `error`, and never throws. Its fidelity check runs
  over the subject's reading envelope (`subjectEnvelope` on the fixer input).
- **Nested reads.** The critic and the fixer read their nested call's DECODED payload (`readLlmDispatchResultReply`:
  the `valueJson` stamp, `declined` for an accepted result with none, `no-json` when dropped, the `json` reading of an
  unstamped result's text), so they follow the nested call's resolved protocol and the dispatcher's `replyEnvelope`. A
  host `resultOf` must keep `valueJson` / `decodeStatus`. The built-in judge and fixer descriptors set no protocol and
  inherit the host default, so a `line`-default host must give them a JSON protocol.
  `DEFAULT_LLM_REPLY_FAST_FIX_LIMITS`: a score of at least 0.5, at most 16,000 chars, one fix per dispatch.
- **Validation.** `makeLlmSchemaValueValidator(schema)` is a pure schema check: `true`, or `{ error }`, which re-asks. A
  schema-valid but unusable value is a legitimate "no decision", not a re-ask.
- **Schema projection.** `defineLlmCapability` builds `responseSchemaHint()` and `contractSchemaHint()` from
  `responseSchema`. Each exports through `@dereekb/model` `arktypeToJsonSchemaForExport(schema, { strict: true })`: a
  `.narrow`ed or morphed schema projects its JSON base, and a type with no JSON form (`Date`, `symbol`, `bigint`, an
  `undefined` union arm) throws on first projection. Then `@dereekb/model` `toStrictJsonSchema`: `$schema` dropped,
  `additionalProperties: false` on every object, including inside tuples, `$defs` and records, described literal unions
  folded back to `enum`, union arm prose hoisted, and descriptions stripped from the `response_format` payload (they
  ride the output contract). Both hints are lazy and memoized; a projection that throws is not cached.
  `describeResponseSchemaHint` keeps the prose in the payload, per descriptor, default off.
  `hardenLlmResponseSchemaHint` (over `toStrictJsonSchema`) serves request-supplied hints; other projections, such as
  a tool's input schema, call `toStrictJsonSchema` directly.
- **Critique.** `compileLlmCritiquePolicy` (built on `compileLlmCapabilityRules`, with the judge excluded) is
  fail-loud (unknown capability or tag, no target, or the judge itself);
  a key match beats a tag match, and the first match wins. `resolveLlmCritiqueFields` gives `{}` unless a rule matches, so off is
  free. `makeLlmSemanticCritic` fails open with `critique-unusable` / `critique-error` breadcrumbs. `composeLlmCritics`
  runs critics in order and stops at the first rejection. The judge sees the goal, optional evidence, the subject's live
  context and the reply (both fenced as data), never the subject's instructions. `LlmCritiqueParams.signal` carries the
  subject's cancellation signal, and the semantic critic puts it on the judge request. A critiqued capability costs
  `1 + attempts` calls. Three recursion guards: the judge request carries no critic, the compile refuses the judge, and
  the dispatcher clamps `maxAttempts >= 1`.
- **Built-in capabilities.** `LLM_CRITIQUE_REPLY_DESCRIPTOR` / `LLM_REPAIR_REPLY_JSON_DESCRIPTOR` and their default
  templates `LLM_CRITIQUE_REPLY_TEMPLATE` / `LLM_REPAIR_REPLY_JSON_TEMPLATE`. Register the descriptors in your
  `descriptorOf`, add the templates as your lowest tier, and override with a higher tier or your own resolver. Spread a
  descriptor to add your tags, tier or traits.
- **Swallow sites.** `llm/reply-envelope.decode`, `llm/reply-repair.rebuilt-parse`, `llm/reply-repair.fast-fix` and
  `llm/critique-reply.judge`, all in `LLM_SWALLOW_SITES`.

```ts
import { compileLlmCritiquePolicy, defineLlmCapability, LLM_CRITIQUE_REPLY_DESCRIPTOR, LLM_CRITIQUE_REPLY_TEMPLATE, LLM_REPAIR_REPLY_JSON_DESCRIPTOR, LLM_REPAIR_REPLY_JSON_TEMPLATE, resolveLlmCritiqueFields, readLlmReplyValue, makeLlmSchemaValueValidator, type LlmCritiqueBinding } from '@dereekb/llm';
import { type } from 'arktype';

const summarySchema = type({ summary: type('string').describe('two sentences, plain words') });
const SUMMARIZE = defineLlmCapability({ capability: 'summarize', tags: ['copy'], responseSchema: summarySchema, parseValue: (value) => {
  const out = summarySchema(value);
  return out instanceof type.errors ? undefined : out;
} });
const DESCRIPTORS = [SUMMARIZE, LLM_CRITIQUE_REPLY_DESCRIPTOR, { ...LLM_REPAIR_REPLY_JSON_DESCRIPTOR, tier: 'fast' }];
const templates = { source: 'llm', templates: [LLM_CRITIQUE_REPLY_TEMPLATE, LLM_REPAIR_REPLY_JSON_TEMPLATE] }; // the lowest tier

const binding: LlmCritiqueBinding = {
  policy: compileLlmCritiquePolicy({ critique: { rules: [{ tags: ['copy'], tier: 'fast', maxAttempts: 3 }] }, capabilities: DESCRIPTORS }),
  dispatch: (request) => dispatcher.dispatch(request)
};

const goal = 'The summary MUST name the product and its price.';
const result = await dispatcher.dispatch({
  capability: 'summarize',
  renderLiveContext,
  validate: makeLlmSchemaValueValidator(summarySchema),
  ...resolveLlmCritiqueFields({ binding, capability: 'summarize', goal })
});
const value = readLlmReplyValue(result.text);
```

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
  resolved slug (the default tier's included) and the cap: route › descriptor › tier, else `defaultMaxOutputTokens`. A
  strategy behind a dispatcher therefore needs no `defaultModel`, and its own `maxOutputTokens` default never applies.
  The strategy comes from `selectStrategy` when set, else route provider › `providerByModel` › `defaultStrategyId`.
  Output controls follow `resolveLlmCapabilityOutputControls` over `reasoningDefault` (off by default). Debug breadcrumbs `model-route`, `provider-route` and `reasoning-floor` fire once
  per key.
- **Compose.** The root runs `composeLlmCapabilityPrompt` over `layout` (default `DEFAULT_LLM_PROMPT_LAYOUT`),
  `contributors`, `texts` and the schema hints (none on a `line` call; an explicit request hint is hardened). It sends
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
- **Validated.** With a `validate` (or a `critique`) the call runs the bounded retry loop (see Retry and lanes). Each
  reply is read, repaired, validated, then critiqued, and the result is stamped `attempts`, `decodeStatus`,
  `decodeOutcome`, `lengthCapped`, `valueJson` and `validationErrors`. A decline, or a `line` reply that is not JSON, is
  accepted. Each rejected attempt records a decode row (critique rejections excepted), a `failedAttempts` row and an
  `onDecodeFailure` tap event whose `willRetry` is the retry decision made when the attempt was judged. A send error
  the policy does not resend ends the loop at once (see Transport lane).
- **Follow-ups.** `preparePrompt(request)` returns an `LlmPrompt` whose `execute()` runs once and whose `followUp(…)`
  chains onto the same thread; `dispatch(request)` equals `preparePrompt(request).execute()` unwrapped. A degenerate
  reply replays as `degenerateThreadPlaceholder`. `makeLlmPromptChain` works over it unchanged: the root renders its
  live context once, and each follow-up sends only the lead and the changed blocks.
- **Records and taps.** `recorder.recordCallStart` fires before the send, `recordCall` once per execution, and
  `recordDecodeFailure` once when any decode row exists. The recorder gets the full record and owns any capture gate.
  `taps` (held by reference) get `onDispatch`, `onDecodeFailure` and `onDispatchComplete` with the same record object.
  A decision records through the same recorder and fires `onDispatch` / `onDispatchComplete` (never
  `onDecodeFailure`); `event.decision` marks it on both events. `onGap` gets `prompt-raw-json`, `critique-fail` and
  `prompt-over-budget` (the call is still sent).
- **Host data.** Every hook that receives a request gets `{ lane, request }` — `lane: 'completion'` with the host's
  `R`, or `lane: 'decision'` with the decision request; narrow on `lane`. `callAttributionOf` overrides the per-call
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
- **Fakes.** `makeLlmDispatcherFromDispatch(fn)` wraps a bare dispatch function as a dispatcher whose prompts run through it.
- **Retry and lanes.** The bounded retry ladder, the fast-fix and critique lanes and the decision lane are described in
  the next section.

```ts
import { DEFAULT_LLM_MAX_OUTPUT_TOKENS, makeLlmSchemaValueValidator, makeLlmDispatcher, makeLlmStrategyRegistry, makeLlmTieredPromptTemplateResolver } from '@dereekb/llm';

const dispatcher = makeLlmDispatcher({
  strategies: makeLlmStrategyRegistry([strategy]),
  defaultStrategyId: strategy.id,
  defaultMaxOutputTokens: DEFAULT_LLM_MAX_OUTPUT_TOKENS,
  modelTiers: { fast: 'acme/fast', strong: 'acme/strong' },
  descriptorOf: (capability) => DESCRIPTORS[capability],
  templateResolver: makeLlmTieredPromptTemplateResolver({ tiers: [{ source: 'app', templates }] }),
  recorder: { recordCall: (record) => log.write(record) }
});

const result = await dispatcher.dispatch({ capability: 'summarize', renderLiveContext, validate: makeLlmSchemaValueValidator(summarySchema) });

const first = await dispatcher.preparePrompt({ capability: 'summarize', renderLiveContext }).execute();
const next = await first.followUp({ content: 'Now the second item.' }).execute();
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
  `result.repair.meta`, on the call payload's `repair` and on the failed rows.
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

### Reading

- `readLlmDecisionAnswers({ questions, raw })` membership-checks every answer against the question that asked it and
  returns the typed answers or EVERY fault (`answer-missing`, `answer-mistyped`, `choice-off-option`,
  `value-out-of-range`). Past it, a `choice` is a declared option, a `score` is in range and a `noul` is a
  probability — no consumer re-checks. `raw` takes any shape (the reader is the judge of what an answer is), and the
  value types are checked too: a non-number `noul`, `score` or distribution entry is `value-out-of-range`.
  `laxAnswerTypes: true` gives an answer that arrived with NO `type` its declared question's type first (a present
  `type` is never overwritten).
- `requireLlmDecisionAnswers(config)` is the throwing read: the answers, or `LlmDecisionAnswerFaultError` with every
  fault. The System One transport and the scripted decision strategy both call it.
- `toLlmDecisionConfidenceBand`, `llmDecisionChoiceRanking`, `mapLlmDecisionChoiceRows` and
  `readLlmChoiceCertainty` (sure / nested / split / diffuse / unread, with site-owned floors) read a Choice's answer.

### Strategies

- `LlmDecisionStrategy extends LlmStrategyBase`, the decision sibling of `LlmStrategy`: `decide(request, options?)`
  takes `LlmDecisionRequest` (`{ state, questions, model }`) and returns `LlmDecisionResult` (the answering versioned
  `model`, `answers`, `usage`, `provider`, `generationId`). It throws rather than returning partial answers. Its
  `healthCheck` / `credentialProbe` are the base's, reporting `LlmStrategyHealth`. `LlmDecideOptions` extends
  `LlmCompleteOptions` (`signal`) with `timeoutMs`.
- Decision strategy kinds follow `<route>-systemone` (`'openrouter-systemone'`, `'zenmux-systemone'`): both stock
  transports speak System One, and the kind stays distinct from the route's completion kind (`'openrouter'`).
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
  by (see [Decision lane](#retry-and-lanes)); a direct `strategy.decide()` / `decision.decide()` is never retried.
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
    `LlmDecisionAnswerFaultError`; a missing key throws a status-less (never retried) transport error.
  - `healthCheck` is network-free. An injected `decisionFetch` makes a keyless fake (ready, no key needed). The global
    `fetch` is read at call time.
- `defineLlmDecision(descriptor)` declares a decision over one typed input: `state(input)` and `questions(input)`.
  Validation is lazy — `asRequest({ input, model })` validates and throws `LlmDecisionDeclarationError` naming the
  decision — and `decide({ strategy, input, model, options })` runs it.
- `LlmDecisionDispatchRequest` is what `makeLlmDispatcher`'s decision lane (its `decisions` block) takes. It shares
  `LlmDispatchRequestBase` with a completion request — the consuming `capability`, host `meta`, model / tier
  overrides, the parent `callContext` and the `signal` — and adds the declared `decision`, its `input` and an optional
  `stamp`. A descriptor's own `model` / `tier` are `Pick<LlmCapabilityModelRef, 'tier' | 'model'>`.

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

The deprecated classes ARE the `@dereekb/llm` classes, so a thrown fault's `.name` reads `LlmDecisionAnswerFaultError` /
`LlmDecisionDeclarationError` (not the old `OpenRouterDecision…` name); branch on `instanceof` (either name works).
Stored run-task error codes are unchanged. `@dereekb/openrouter` imports this vocabulary from `@dereekb/llm/decision`
(never the root), which also exports the `LlmGenerationId` type its `OpenRouterGenerationId` aliases.

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
`DEFAULT_OPENROUTER_SYSTEM_ONE_MODEL_ID` and the `openRouterDecision` transport, which keeps its own SDK transport.
`@dereekb/llm/openrouter`'s decision strategy (`makeLlmOpenRouterDecisionStrategy`) is a hook set over the core System
One transport and never imports `@dereekb/openrouter`.

## OpenAI-compatible chat (`@dereekb/llm/openai`)

`makeLlmOpenAiStrategy(config)` reaches any OpenAI-compatible chat-completions endpoint — bare OpenAI, ZenMux, a local
vLLM — over the optional `openai` peer.

- Messages are plain strings, so the provider's implicit prefix caching applies (`caching: 'auto-prefix'`).
- A request with `responseSchemaHint` sends a strict `json_schema` `response_format` named by the capability.
- Reasoning rides the flat `reasoning_effort`. An explicit OFF (`reasoning.enabled === false`) is encoded per
  `reasoningOffEncoding` / `reasoningOffByModel` rather than dropped; `LLM_OPENAI_REASONING_OFF_PARAMS` shows each wire
  shape (`toLlmOpenAiReasoningParams` builds it).
- The cap rides under `tokenLimitParam` (`max_tokens` or `max_completion_tokens`); `usage: { include: true }` is an
  opt-in (`usageAccounting`); a volunteered `usage.cost` is read either way and stamped with `costBasis` when set.
- Images ride only for slugs `visionByModel` marks; `attachmentsSent` on the result says what rode.
- There is no built-in model: set `defaultModel` or pass `request.model`, else the call fails loud. Behind a dispatcher
  every request names its model and cap, so `defaultModel` / `maxOutputTokens` only serve direct strategy calls.
- Defaults: the cap of a direct call is `DEFAULT_LLM_MAX_OUTPUT_TOKENS` (8,192) and the abort window is a 60 s floor
  (`DEFAULT_LLM_COMPLETION_TIMEOUT_MS`) scaled up with the call's budget by core's `resolveLlmCompletionCallTimeoutMs({ timeoutMs, maxOutputTokens })`. An older or
  small-context model needs its `maxOutputTokens` set.
- Seams: `client` (an `LlmOpenAiChatClient` — a fake, or your own SDK client) and `probeFetch`. The real client is built lazily with `maxRetries: 0` (the dispatcher retries) and never reads
  `OPENAI_ORG_ID` / `OPENAI_PROJECT_ID`. In a browser pass `dangerouslyAllowBrowser: true` or inject a client — with
  user-held keys only.
- Credentials: `credentialProbe` GETs `{baseUrl}/models` (a 404 is a ready warning); `credentialProbeSource` replaces
  it, even when a `client` is injected; `providerStatus` / `providerStatusId` exist only with a
  `providerStatusSource`.

`LLM_OPENAI_ADAPTERS` registers the completion transport `openai` (default base URL `https://api.openai.com/v1`).
`toLlmOpenAiStrategyConfig` is its mapping: the shared `toLlmOpenAiCompatibleChatStrategyConfig` (every OpenAI-compatible
completion adapter's mapping) plus the four OpenAI extras. Both are exported so a host can extend them in its own
adapter. `probeFetch` is a `ConfiguredFetch`, and a transport's `credentialProbe` hook is a function
(`LlmTransportCredentialProbe`):

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

**Building another OpenAI-compatible transport.** `makeLlmOpenAiCompatibleChatStrategy(config, hooks)` is the base:
it owns the lazy client, the model guard, the vision filter, `response_format`, the budget-scaled timeout, usage and
result assembly, `healthCheck`, the credential ladder and `providerStatus`. `config` is what a host configures
(`LlmOpenAiCompatibleChatStrategyConfig`); `hooks` is what makes one transport differ from another. Both stock
transports are one set of hooks each:

| Hook | openai | openrouter |
|---|---|---|
| `kind`, `describe`, `caching`, `defaultBaseUrl` | `'openai'`, `'auto-prefix'`, OpenAI | `'openrouter'`, `'breakpoint'`, OpenRouter |
| `tokenLimitParam` | from `tokenLimitParam` | `max_tokens` |
| `messages` | default: plain strings, image parts after the prompt | `anthropic/` routes: `cache_control` blocks; else default |
| `reasoningParams` | flat `reasoning_effort` + OFF encodings | nested `reasoning` |
| `bodyExtras` | `usage: { include: true }` with `usageAccounting` | `usage: { include: true }` always |
| `completionExtras` | — | `provider`, `native_finish_reason` fallback |
| `credentialProbe` | `GET /models`, 404 → ready + warning | `GET /key`, 404 → error |

The per-call hooks receive `LlmOpenAiCompatibleCallParams`: the request, the slug being sent, the reasoning config
already normalized by `normalizeLlmReasoningConfig`, and the attachments that ride. The body is sent as
`model, messages, <cap>, <reasoning>, response_format, <extras>`.

## OpenRouter (`@dereekb/llm/openrouter`)

**Chat** — `makeLlmOpenRouterStrategy(config)`, built on `/openai`'s `makeLlmOpenAiCompatibleChatStrategy` (the
`openai` peer is reached through `@dereekb/llm/openai`, pointed at OpenRouter):

- An `anthropic/` route sends the prompt's stable prefix as a `cache_control: { type: 'ephemeral' }` block, and a
  chained follow-up adds a history breakpoint on the last replayed turn; other routes get the plain prompt
  (`caching: 'breakpoint'`).
- `usage: { include: true }` rides every call, so the reply carries `cost`; the request's reasoning config rides as
  OpenRouter's nested `reasoning` object (an OFF config is sent as `reasoning: { enabled: false }` alone); the served
  upstream `provider` is echoed; `native_finish_reason` is the finish-reason fallback.
- No built-in model, and the same defaults as `/openai`. The same seams (`client`, `probeFetch`), browser rule,
  `costBasis` / `providerStatusSource` / `credentialProbeSource` facets as `/openai`; the generic credential probe is
  `GET {baseUrl}/key`, and a 404 there is an error.

**Decisions** — `makeLlmOpenRouterDecisionStrategy(config)` posts to `{baseUrl}/systemone` with a plain `fetch`: it is
OpenRouter's hook set over `makeLlmSystemOneDecisionStrategy`, with no SDK.

- The body is `llmDecisionRequestBody`. Answer types are read strictly (a type-less answer faults as
  `answer-mistyped`). Usage comes from `llmUsageFromDecisionUsage` and carries the gateway's exact, synchronous `cost`
  (no `costBasis`); the generation id is the body `id`.
- The per-call timeout (`DEFAULT_LLM_DECISION_TIMEOUT_MS` unless set) holds even when you pass a signal.
- Failures follow the System One transport: a timeout or abort rejects with its reason (`isFetchAbortError`), a socket
  failure is an `LlmDecisionTransportError` with the native error as its `cause` (the dispatcher's decision lane
  resends it), and an HTTP answer is an `LlmDecisionTransportError` (`status`, `body`).
- Seams: `decisionFetch` (a keyless fake of the route) and `probeFetch`; the credential probe is `GET {baseUrl}/key`.
- `probeLlmOpenRouterCredential({ strategyId, apiKey, baseUrl?, fetch?, signal? })` is that one probe
  (`GET {baseUrl}/key`, 404 = error), shared by the chat and decision strategies.

`LLM_OPENROUTER_ADAPTERS` registers the completion transport `openrouter` (default `https://openrouter.ai/api/v1`) and
the decision route `openrouter` (`strategyKind: 'openrouter-systemone'`, derived for every `openrouter`-transport
provider). The completion mapping is `/openai`'s shared `toLlmOpenAiCompatibleChatStrategyConfig`, which ignores the provider's `reasoningOff`,
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
- **Cost basis.** A synchronous `cost` is the pre-discount LIST amount (`LLM_ZENMUX_SYNC_COST_BASIS = 'list'`), an upper
  bound: some slugs bill a discount. A provider's cost basis is
  `resolveLlmProviderAccount(…).costBasis` with these adapters registered — a declared `metering` wins, else the URL
  must parse as `zenmux.ai` or a subdomain (`isLlmZenmuxBaseUrl`, which is `@dereekb/util`'s `isWebsiteUrlOnDomain`; a
  look-alike host never qualifies).
- **Management API.** Every management read is one `readLlmZenmuxManagement` (an authenticated GET read once with
  `readFetchJsonText`) answering a `LlmZenmuxEnvelope<T>`; `llmZenmuxManagementUrl` / `llmZenmuxGenerationUrl` build the URLs.
- **Bills.** `makeLlmZenmuxGenerationBillReader` reads `management/generation?id=`. A call bills 3–5 minutes after it is
  made, so a `404` reads `pending`; a refused key reads `failed` in ZenMux's own words.
- **Quota status.** `makeLlmZenmuxProviderStatusSource` reads `subscription/detail`, `payg/balance` and `flow_rate` in
  parallel. A partial read stays `available` with a warning per failed endpoint; a missing management key reads
  `available: false` with an error naming `ZENMUX_MANAGEMENT_API_KEY` (or your `managementApiKeyEnv`). Status and bill
  reads go to `resolveLlmZenmuxAccountBaseUrl(baseUrl)`: a ZenMux URL keeps its host, anything else (a LAN proxy declared
  `metering: 'zenmux'`) reads the account at `DEFAULT_LLM_ZENMUX_BASE_URL`.
- **Credential probe.** `GET /models` answers 200 to any bearer, so `probeLlmZenmuxCredential` asks two auth-gated,
  never-billed questions instead: a chat completion naming a model no gateway serves (a live subscription key gets
  `404`), then, only if refused, a bill lookup of a made-up id (a live pay-as-you-go key gets `404`). The chat question
  goes to the provider's own base; the bill lookup goes to `resolveLlmZenmuxAccountBaseUrl(baseUrl)`, so a LAN proxy's 404
  never reads as a live key.
- **Decisions.** `makeLlmZenmuxDecisionStrategy` (`kind: 'zenmux-systemone'`) is the core System One transport with the
  ZenMux hooks. It sends exactly `{ model, state, questions }` via `llmDecisionRequestBody` — ZenMux answers `400` to any
  other key. The generation id comes from the `X-ZenMux-RequestId` header, a type-less answer takes its question's
  declared type (`laxAnswerTypes`), and a reported `cost` carries `costBasis: 'list'`. Failures follow the transport's
  contract: a socket failure wraps as `LlmDecisionTransportError` with the failure as its `cause`, so the dispatcher's
  decision lane resends a reset (`isRetryableLlmDecisionError`).

`makeLlmZenmuxAdapters(config)` returns the decision route `zenmux`, plus the `zenmux` metering, bill and
credential-probe adapters. The decision route is never derived: a provider declares `decision: 'zenmux'`. Register the
array before `/openrouter`'s, or pass a `routePreference`, when ZenMux should be the default decision route. Without a
`billApiKey`, a subscription provider's bill reads fail `403`, so pass the pay-as-you-go key. The entry's swallow sites
are `LLM_ZENMUX_SWALLOW_SITES`.

```ts
import { makeLlmAdapterRegistry } from '@dereekb/llm';
import { LLM_OPENAI_ADAPTERS } from '@dereekb/llm/openai';
import { DEFAULT_LLM_ZENMUX_BASE_URL, makeLlmZenmuxAdapters } from '@dereekb/llm/zenmux';

const adapters = makeLlmAdapterRegistry([...LLM_OPENAI_ADAPTERS, ...makeLlmZenmuxAdapters({ managementApiKey, managementApiKeyEnv, billApiKey })]);
const zenmux = { transport: 'openai', baseUrl: DEFAULT_LLM_ZENMUX_BASE_URL, apiKeyEnv: 'ZENMUX_API_KEY', metering: 'zenmux', decision: 'zenmux', usageAccounting: true };
```

## Node host quick start (`@dereekb/llm/node`)

`/node` reads the machine — the model config file and the environment — and hands back the root entry's own types, so
everything after the read is the same code a browser host runs. Every env var NAME is a parameter: the library knows
conventional defaults, never a host's own prefix. Each function reads `process.env` unless you pass `env`, which is
how a spec stays hermetic.

- **Env names.** `DEFAULT_LLM_ENV_NAMES` lists what is read. Each field is a list in priority order: the first name
  holding a non-blank value wins, the value is trimmed, and `[]` is never read (the way to switch a knob off). Build
  your own by spreading the defaults — `{ ...DEFAULT_LLM_ENV_NAMES, modelsFile: ['MY_APP_MODELS', 'LLM_MODELS_FILE'] }`
  — so a knob you do not mention keeps its default instead of going silent. `firstLlmEnvEntry` / `firstLlmEnvValue`
  apply the same rule to a host's own settings, such as the ZenMux management key below.

  | Field | Default var | Meaning |
  |---|---|---|
  | `providers[openai]` | `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `LLM_OPENAI_TOKEN_LIMIT_PARAM`, `LLM_OPENAI_REASONING_OFF`, `LLM_OPENAI_USAGE_ACCOUNTING` | The OpenAI env default: key, endpoint and wire knobs. |
  | `providers[openrouter]` | `OPENROUTER_API_KEY` | The fallback env default: serves only when nothing else is keyed, or when selected. |
  | `defaultProvider` | `LLM_PROVIDER` | The explicit default-provider selection. A value naming no env default with a registered adapter and no declared completion provider throws, listing the selectable ids. |
  | `modelsFile` | `LLM_MODELS_FILE` | The model config file path; a path set here that does not exist fails loud. |
  | `modelProfile` | `LLM_MODEL_PROFILE` | The per-run profile override (wins over the file's `active`; `off` / `none`, any case, selects none). |
  | `modelTiers` | `LLM_MODEL_TIERS` | The bulk tier map, as JSON. |
  | `tierModels` | `LLM_MODEL` (`fast`), `LLM_MODEL_STRONG` (`strong`) | One slug per tier; wins over the same key in `modelTiers`. |
  | `defaultTier` | `LLM_DEFAULT_TIER` | Which tier is the default. |
  | `decodeRetryTier` | `LLM_DECODE_RETRY_TIER` | Which tier a malformed reply retries on (`off` / `none`, any case, keeps the same model). |
  | `decisionProvider` | `LLM_DECISION_PROVIDER` | The decision-lane provider pin (a provider id; the test lane throws on one that is not registered). |
  | `craftNotesDir` | `LLM_CRAFT_NOTES_DIR` | The machine craft-notes folder. |

- **The file.** `loadEffectiveLlmModelConfigFile({ schema, base, defaultPath })` reads the path the env names, else
  `defaultPath` — the explicit path fails loud when missing, while a missing `defaultPath` just means the built-ins —
  and returns `{ file, userFile, filePath, fileExists }`: `file` (your `base` with the operator's file laid over it)
  is what every read resolves against. `writeLlmModelConfigFile` persists a whole file: transform `userFile`, never
  the effective `file`, or a copy of the built-ins freezes onto the machine. The bytes are parsed back and `active`
  resolved before they land, the shape is `flattenLlmModelConfigFile`'s (every key, in `LLM_MODEL_CONFIG_FILE_KEYS`
  order — none is silently dropped), and the write is atomic (a temp file, then a rename).
- **Profile and tiers.** `resolveLlmModelProfileFromEnv({ file, source, schema })` picks the active profile with the
  env override over the file's `active` (`overrideEnv` names the var that chose it). `resolveLlmModelTierEnv()`
  returns the env's tier map, default tier and decode-retry tier. Precedence is env over profile over the host's
  base tiers: layer them in that order when calling `resolveLlmModelTiers`.
- **Providers.** `resolveLlmProvidersFromEnv({ file, schema, adapters })` — or `makeLlmStrategiesFromEnv`, which also
  builds each strategy — returns the keyed providers, the `gaps`, and the default. An env default is minted only when
  its transport has a registered completion adapter. A declared provider is keyed by its own `apiKeyEnv`, and it
  replaces an env default of the same id even when unkeyed — it is never silently re-pointed at another key. The
  default is the explicit selection, else the first keyed non-fallback provider, else the fallback, keyed or not, so a
  missing key fails loud at the call. An explicit selection (`LLM_PROVIDER`) that names neither an env default with a
  registered adapter (case-insensitively) nor a declared completion provider (exactly) throws, naming the variable and
  the selectable ids — a typo never silently routes to the inferred default. `gaps` lists every declared provider without a key; scope it to the slugs a run
  can reach with `filterLlmReachableProviderGaps`.
- **Craft notes.** `resolveLlmCraftNotesDir({ defaultDir })` answers the folder the env names, else yours.
  `loadLlmCraftNotes({ dir, tier, sites, warn })` drops and warns about a bad note, never throws, and reads an absent
  folder as no notes. `compileLlmCraftNotes` / `writeLlmCraftNotesModule` compile a committed folder into a
  `*.generated.ts` module that imports its note type from `@dereekb/llm/craft` (`typeFrom` overrides it). The write
  refuses on any refusal, leaves a module that already holds the compiled text untouched (`outcome: 'unchanged'`, no
  mtime bump), and otherwise writes atomically (`outcome: 'wrote'`). Register `LLM_NODE_SWALLOW_SITES` beside
  `LLM_SWALLOW_SITES` for the folder-read site.

  A freshness spec for committed built-ins compares data, and re-emits behind a flag of your own:

  ```ts
  import { compileLlmCraftNotes, writeLlmCraftNotesModule } from '@dereekb/llm/node';

  const config = { dir: NOTES_DIR, tier: 'builtin', sites, exportName: 'BUILTIN_CRAFT_NOTES', out: OUT_FILE };

  it('keeps the compiled craft notes fresh', () => {
    if (process.env['SHOP_EMIT_CRAFT_NOTES'] === '1') writeLlmCraftNotesModule(config);
    expect(compileLlmCraftNotes(config).notes).toEqual(BUILTIN_CRAFT_NOTES);
  });
  ```

```ts
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readLlmModelConfigLists, llmModelReasoningOffEncodings, llmModelVisionCapabilities, makeLlmAdapterRegistry, makeLlmModelConfigSchema, resolveLlmModelTier, resolveLlmModelTiers } from '@dereekb/llm';
import { firstLlmEnvEntry, loadEffectiveLlmModelConfigFile, makeLlmStrategiesFromEnv, resolveLlmModelProfileFromEnv, resolveLlmModelTierEnv } from '@dereekb/llm/node';
import { LLM_OPENAI_ADAPTERS } from '@dereekb/llm/openai';
import { LLM_OPENROUTER_ADAPTERS } from '@dereekb/llm/openrouter';
import { makeLlmZenmuxAdapters, LLM_ZENMUX_MANAGEMENT_API_KEY_ENV_VAR } from '@dereekb/llm/zenmux';

const management = firstLlmEnvEntry({ names: [LLM_ZENMUX_MANAGEMENT_API_KEY_ENV_VAR] });
const adapters = makeLlmAdapterRegistry([...LLM_OPENAI_ADAPTERS, ...makeLlmZenmuxAdapters({ managementApiKey: management?.value, managementApiKeyEnv: management?.name }), ...LLM_OPENROUTER_ADAPTERS]);
const schema = makeLlmModelConfigSchema({ ...readLlmModelConfigLists(adapters), label: 'my-app models' });

const loaded = loadEffectiveLlmModelConfigFile({ schema, base: BUILT_IN_MODEL_CONFIG, defaultPath: join(homedir(), '.my-app', 'models.json') });
const profile = resolveLlmModelProfileFromEnv({ file: loaded.file, source: loaded.filePath, schema });
const tierEnv = resolveLlmModelTierEnv();
const { tiers, defaultTier } = resolveLlmModelTiers({ base: BUILT_IN_TIERS, modelTiers: { ...profile?.tiers, ...tierEnv.modelTiers }, defaultTier: tierEnv.defaultTier });

const { strategies, defaultProviderId, gaps } = makeLlmStrategiesFromEnv({
  file: loaded.file,
  schema,
  adapters,
  defaultModel: resolveLlmModelTier(tiers, defaultTier),
  reasoningOffByModel: llmModelReasoningOffEncodings(loaded.file),
  visionByModel: llmModelVisionCapabilities(loaded.file)
});
```

`defaultModel` here serves direct strategy calls only: a strategy behind a dispatcher is always sent the resolved slug.

## Test infrastructure (`@dereekb/llm/test`)

`/test` is Node-only test infrastructure: no browser entry imports it, and it never imports `vitest`, so a plain Node
harness (a benchmark CLI) can use it too. Nothing in it bills unless a live lane is UNLOCKED and keyed — tapes and
scripts make no network call, and the lane's helpers answer `undefined` while it is locked.

- **Tape replay.** `makeLlmTapeStrategy({ turns })` serves recorded completions. A turn matches on its capability plus
  `hashLlmTapePrompt(prompt)` (`sha256HexPrefix(text, 12)` from `@dereekb/util`, byte-equal to a `node:crypto` digest): hash
  first, so a byte-identical replay consumes the tape in exact order whatever the dispatch order, then the next
  unconsumed turn of the same capability (an `order` match — the prompt drifted, the run still completes). With nothing
  left to serve it throws `LlmTapeStrategyError` — `tape-exhausted` (more calls than the recording) or
  `capability-drift` (the call sequence changed) — which TRUNCATES the replay at that call: calls already served stay
  readable, nothing past it ran. A served completion keeps the recorded tokens and forces `cost` to `0`. After the run,
  `matches()` (with each request's prompt and digest, for diffs), `unconsumed()` and `failures()` (recorded even when
  a host swallows the throw) feed a report; `isLlmTapeStrategyError` checks the shape, not the prototype.
  `readLlmTapeTurn(payload, { decisionStrategyKinds, hash })` turns one persisted `llm_call` payload into a turn (pass
  the same `hash` the tape strategy uses), and answers `undefined` for a capture-off row, a decision row or a
  non-object.
- **Scripted completions.** `makeLlmScriptedStrategy` answers each call from `respond(request, call)`, else
  `byCapability[capability]` (a reply or a list with its own counter), else `replies` (in order). A list repeats its
  last entry once spent; an empty list is no reply, and a call nothing answers throws, naming the id, capability and
  call. A reply is a text, a completion spec (`{ text, usage, finishReason, … }`) or an `Error` the call throws — how a
  spec drives a transport failure. Pass `requests` to collect every request, including the ones that threw.
- **Scripted decisions.** `makeLlmScriptedDecisionStrategy({ script })` reads the script's answers through
  `requireLlmDecisionAnswers`, so an under-answered or malformed script is refused with `LlmDecisionAnswerFaultError`
  exactly as a live transport would; usage is a zero-cost reading. Build answers with this entry's
  `makeLlmDecisionChoiceAnswer` / `makeLlmDecisionScoreAnswer` / `makeLlmDecisionNoulAnswer`, which are well-formed by
  construction, so a script states only which option won and how surely.
- **Fetch seams.** `makeLlmFetchFake(respond)` is a `ConfiguredFetch` fake for any fetch-seam spec: it records each
  request (`url`, and an `init` with `method`, a plain `headers` record, `body`, `signal`) and answers with a real
  `Response` (`llmFetchFakeResponse({ status, body, headers })`); `respond` is an answer, a function, or `'hang'`.
- **System One wire.** `makeLlmSystemOneWireFake({ respond })` is the one `/systemone` fake (its `fetch` is a
  `ConfiguredFetch`): `respond` is an answer
  (`{ status, body, headers }`, used for every request), a function (called per request; a throw is the socket
  failure) or `'hang'` (rejects with the signal's reason on abort). It records every request (`url`, `init`, parsed
  `body`) in `requests`. Pass its `fetch` as a decision strategy's `decisionFetch`, or stub the global `fetch` with it
  to drive a keyed strategy. `toLlmSystemOneWireReply(body)` is its default well-formed reply.
- **The live lane.** `makeLlmLiveLane({ schema, adapters, … })` is the billed-spec lane as one factory. Its switch
  and verdict names (`names`, merged over `DEFAULT_LLM_LIVE_LANE_ENV_NAMES`) and provider / model names (`envNames`,
  `/node`'s `DEFAULT_LLM_ENV_NAMES`) are injected, and so is the provider resolver (`resolveProviders`, defaulting to
  `/node`'s `resolveLlmProvidersFromEnv`). `liveStrategyFromEnv()` answers the live handle (`strategyId`, `model`,
  `apiKeyEnv`, `makeStrategy()`), or `undefined` when the run must skip: locked, keyless, a `dead` credential verdict,
  an `exhausted` quota verdict, or no model. The model is the default tier's variable (`LLM_MODEL`), else the active
  profile's default tier, else the host's `defaultModel` (a slug, or a function of the provider and its base URL that
  answers `undefined` for a provider with no safe default). Verdicts fail open: an absent or unrecognized one reads
  `unchecked` and never vetoes. Every skip past the lock is logged. `makeLiveStrategy()` /
  `liveStrategyBinding()` build inside an open gate (and throw when nothing resolves — the gate is wrong);
  `liveDecisionStrategyFromEnv()` answers the decision backend, pinned by `LLM_DECISION_PROVIDER` (a pin naming a
  strategy that is not registered throws, listing the registered ones), with no veto of its own (pair it with
  `liveStrategyFromEnv` in the gate). The built strategy is wrapped by
  `decorateLlmLiveStrategyAuthFailures`: a `401` / `403` is rethrown naming the key's variable, never the key.

  | Field | Default var | Meaning |
  |---|---|---|
  | `unlock` | `LLM_LIVE_SPECS` | Opts the billed lane in (`1` / `true`). |
  | `skipCredentialProbe` | `LLM_LIVE_SPECS_SKIP_CREDENTIAL_PROBE` | Runs without the credential probe, clearing a stale credential verdict. |
  | `skipQuotaProbe` | `LLM_LIVE_SPECS_SKIP_QUOTA_PROBE` | Runs without the quota read, clearing a stale quota verdict. |
  | `credentialVerdict` | `LLM_CREDENTIAL_VERDICT` | `live` / `dead` / `unchecked`, stamped by the setup. |
  | `credentialDetail` | `LLM_CREDENTIAL_DETAIL` | The provider's own words behind a `dead` verdict. |
  | `quotaVerdict` | `LLM_QUOTA_VERDICT` | `ok` / `exhausted` / `unchecked`, stamped by the setup. |
  | `quotaDetail` | `LLM_QUOTA_DETAIL` | The measured headroom line. |
  | `quotaMaxUsed` | `LLM_QUOTA_MAX_USED` | The 0–1 ceiling of the tightest quota window (a percent like `90` is ignored). |

- **The setup gate.** `lane.makeGlobalSetup()` is a vitest `globalSetup`; it runs once in the main process, so what it
  writes reaches every worker. Locked, it strips every provider key (the env defaults, the `apiKeyEnv`s in
  `modelConfig.base`, and `extraProviderKeyNames`) and does nothing else — no file read, no request; pass
  `hermetic: false` to keep them. Unlocked, it resolves first (a malformed models file or an unknown profile throws
  before anything is billed), logs the lane once, probes every keyed provider's credential and reads its quota, and
  stamps both verdicts. A skip flag deletes that half's stale verdict instead. Every switch is parsed with
  `isEnvFlagEnabled` from `@dereekb/util` (`1` / `true`, trimmed, any case). In this repo `LLM_LIVE_SPECS` is an Nx test
  input (`liveSpecFlags` in `nx.json`), so toggling it never replays a cached run; a host repo declares its own. The verdict
  codecs (`llmCredentialVerdictFromEnv`, `toLlmQuotaVerdictEnv`, …) and `parseLlmQuotaMaxUsed` are exported for hosts
  that wire their own.
- **A/B regression gate.** `computeLlmAbRegressionVerdict({ controlHits, controlTrials, treatmentHits, treatmentTrials })`
  runs a one-sided Fisher exact test at `LLM_AB_REGRESSION_ALPHA` (0.05). A raw count comparison's false-positive rate
  climbs toward 50% as trials grow; this one stays under alpha. It only looks for the treatment arm being worse:
  `regressed: false` means "not shown to regress", never "shown equivalent".

```ts
// llm.live.lane.ts — the host's one lane
import { makeLlmLiveLane } from '@dereekb/llm/test';

export const LIVE_LANE = makeLlmLiveLane({
  schema,
  adapters,
  modelConfig: { defaultPath: join(homedir(), '.my-app', 'models.json'), base: BUILT_IN_MODEL_CONFIG },
  defaultModel: ({ baseUrl }) => (baseUrl === DEFAULT_LLM_OPENAI_BASE_URL ? undefined : 'vendor/model-flash'),
  label: 'my-app'
});

// vitest.llm-live-setup.mts
export default LIVE_LANE.makeGlobalSetup();

// vitest.config.mts — test: { globalSetup: ['./vitest.llm-live-setup.mts'] }

// summarize.llm.spec.ts
const LIVE = LIVE_LANE.liveStrategyFromEnv();

describe.skipIf(LIVE == null)('summarize (live)', () => {
  it('should summarize', async () => {
    const strategy = LIVE_LANE.makeLiveStrategy();
    // ...
  });
});
```

## Utilities

**Semantic types.** The public API types its numbers and strings with `@dereekb/util` semantic aliases where one
fits: `PercentDecimal` (decision probabilities and confidences, judge floors and verdicts, cache-hit and billed
shares), `Count` (calls, attempts, caps on counts), `IndexNumber` (0-based positions), `HexString` (prompt and
supplement hashes), `WebsiteUrl` / `WebsiteUrlWithPrefix` (base URLs), `MimeTypeWithoutParameters` (`LlmAttachment.mime`),
`Milliseconds`, `DollarAmount` and `DestroyFunction` (the detach `addTap` returns). llm adds two of its own in
`llm.value.ts`: `LlmTokenCount` (every token count and token cap) and `LlmGenerationId` (a provider's per-generation
id, the key a bill reader looks a call up by). They are aliases of `number` / `string`, so no value changes; 1-based
ordinals (`attempt`) and UTF-16 lengths whose name carries the unit (`rawLength`, `promptChars`) stay `number`.

The SHA-256 helpers live in `@dereekb/util`: `sha256Hex(text)` and `sha256HexPrefix(text, length)`. They are
synchronous and byte-identical to `node:crypto`'s `createHash('sha256').update(text, 'utf8').digest('hex')`. llm uses 16
hex chars for cache / call-row / supplement hashes (`llmPromptCacheHash`) and 12 for tapes (`hashLlmTapePrompt`).
