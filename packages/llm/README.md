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
