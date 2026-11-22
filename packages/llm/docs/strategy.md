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
  `@dereekb/util`'s `toBase64DataUrl` builds an attachment's `data:` URL. The stock transports default to
  `DEFAULT_LLM_MAX_OUTPUT_TOKENS` (8,192) and an abort window of at least `DEFAULT_LLM_COMPLETION_TIMEOUT_MS` (60 s)
  that scales with the cap: about 273 s at 8,192 (`resolveLlmCompletionCallTimeoutMs`, see [openai](openai.md)). A strategy
  configured with a cap declares it as `LlmStrategy.defaultMaxOutputTokens`, which a dispatcher sends when no route,
  descriptor or tier names one (ahead of the dispatcher's own `defaultMaxOutputTokens`).
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
- **Quota gate.** `evaluateLlmQuotaGate({ report, maxUsedFraction })` refuses only when a measured window is above the
  ceiling (`DEFAULT_LLM_QUOTA_GATE_MAX_USED_FRACTION`, 90%, by default) and fails open whenever nothing is measured.
  `parseLlmQuotaMaxUsed(raw)` reads a host's raw ceiling value: only a `(0, 1]` fraction is accepted, anything else
  (`90` meaning 90%, say) is `undefined` so the default applies. The root reads no environment; the host passes the
  raw value. A window's `unit` is an `LlmQuotaUnit`: one of the library's
  own (`flow`, `request`, `token`, `usd`) or a host's own string for a provider it meters itself.
- **Usage and bills.** `toLlmUsage(raw, { costBasis })` folds a provider usage block: token counts default to `0`,
  every other field is omitted when not reported (absent is not zero), and numeric-string costs are parsed with
  `@dereekb/util`'s `asFiniteNumber`. An `LlmCallBillReader` reads what a call billed, later, by its generation id;
  `reconcileLlmCallBills` folds those reads against the logged cost (see [Readers, ledger and reconcile](records.md#readers-ledger-and-reconcile)).
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

## Writing a strategy

A strategy of your own, such as a new gateway or an in-house model server, plugs into a dispatcher like the stock ones
when it keeps this contract:

- **Shape.** `id`, `describe`, `caching` (`none`, `breakpoint` or `auto-prefix`; telemetry only) and
  `complete(request, options)`. Optionally `kind` (the transport, defaulting to `id`), `defaultMaxOutputTokens`,
  `supportsReasoningParam`, `healthCheck`, `credentialProbe`, `providerStatus` / `providerStatusId` and `warm`.
- **Send what the request names.** Behind a dispatcher, every request carries `model`, `maxOutputTokens` and
  `reasoning` (`{ enabled: false }` unless something turns it on). Send the replayed `thread` before the prompt
  (`toLlmThreadChatMessages` maps it onto chat messages), or chained follow-ups lose their history. Send
  `attachments` only if your wire takes images.
- **Honor `options.signal`.** It merges the dispatcher's `cancellationSignal` and the request's `signal`. Abort the
  send when it fires, and reject with its reason. Add your own deadline the same way;
  `resolveLlmCompletionCallTimeoutMs` gives the stock window.
- **Never retry inside.** The dispatcher owns resends. A strategy that retries multiplies the bill and hides the error
  from the ladder.
- **Throw errors the dispatcher can classify.** It runs `classifyLlmError` on what you throw:
  - an `AbortError` or `TimeoutError` (by `name`) is a timeout
  - a numeric `status` (or `response.status`) is `permanent` for 400–404, `transient` for 408, 429 and 5xx, and
    `unknown` otherwise
  - a socket failure (`ECONNRESET`, …, on the error or its `cause`) is `transient`
  - anything else, such as a plain `Error` with no `status`, is `unknown`, which rejects as `LlmDispatchFaultError`
    unless the host's `isRetryableUnknownError` approves it

  So copy the HTTP status onto the error you throw, and the response headers onto `error.headers`, so the backoff can
  honor `Retry-After`.
- **Return the reply's facts.** `text`, `strategyId` (your `id`) and `capability` (echoed) are required. Add whatever
  you know:
  - `model`, the slug that served
  - `finishReason`, the provider's own word: `length` / `max_tokens` marks a truncation, which the ladder re-asks with
    a bigger budget, and only `stop`, `end_turn`, `stop_sequence` or none lets a malformed reply be repaired
  - `usage`, folded with `toLlmUsage(raw, { costBasis })`
  - `generationId`, the bill reader's key
  - `latencyMs`, `provider`, and `meta` (echoed)
- **`supportsReasoningParam: false`** suits a wire with no reasoning knob. The retry ladder then never takes the
  `reasoning-off` / `reasoning-low` levers: a timeout resends the same bytes, and no bonus attempt is earned. The
  request still carries `reasoning`, so keep it off your wire.

Register it with `makeLlmStrategyRegistry([...])`, which keeps the last instance of an id. Or mint it from
configuration through your own adapter ([Writing an adapter](adapters.md#writing-an-adapter)).

```ts
import { makeLlmStrategyRegistry, toLlmUsage, type LlmStrategy } from '@dereekb/llm';

const inHouse: LlmStrategy = {
  id: 'in-house',
  describe: 'The in-house model server',
  caching: 'none',
  supportsReasoningParam: false,
  complete: async (request, options) => {
    const response = await fetch(`${baseUrl}/generate`, { method: 'POST', body: JSON.stringify({ model: request.model, prompt: request.prompt, max_tokens: request.maxOutputTokens }), signal: options?.signal });

    if (!response.ok) {
      // the status classifies it (429 / 5xx resend, 400–404 fault); the headers carry Retry-After to the backoff
      throw Object.assign(new Error(`in-house answered ${response.status}`), { status: response.status, headers: response.headers });
    }

    const body = await response.json();
    return { text: body.text, strategyId: 'in-house', capability: request.capability, model: request.model, finishReason: body.stop_reason, usage: toLlmUsage(body.usage) };
  }
};

const strategies = makeLlmStrategyRegistry([inHouse]);
```
