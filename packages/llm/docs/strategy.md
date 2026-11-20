# Strategy contract

Entry: `@dereekb/llm` · [← @dereekb/llm](../README.md)

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
  to word the report for decision strategies (see [Strategies](decision.md#strategies)). Every stock strategy's
  `credentialProbe` runs the one ladder, `runLlmCredentialProbeLadder`: a missing key (and no injected fake) is an
  error, a host probe source is delegated to, an injected fake is ready without a request, and otherwise the
  transport's own `LlmTransportCredentialProbe` runs.
- **Quota gate.** `evaluateLlmQuotaGate({ report })` refuses only when a measured window is above the ceiling (90% by
  default) and fails open whenever nothing is measured. A window's `unit` is an `LlmQuotaUnit`: one of the library's
  own (`flow`, `request`, `token`, `usd`) or a host's own string for a provider it meters itself.
- **Usage and bills.** `toLlmUsage(raw, { costBasis })` folds a provider usage block: token counts default to `0`,
  every other field is omitted when not reported (absent is not zero), and numeric-string costs are parsed. An
  `LlmCallBillReader` reads what a call billed, later, by its generation id; `reconcileLlmCallBills` folds those reads
  against the logged cost (see [Readers, ledger and reconcile](records.md#readers-ledger-and-reconcile)).
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
