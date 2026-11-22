# OpenRouter (`@dereekb/llm/openrouter`)

Entry: `@dereekb/llm/openrouter` · [← @dereekb/llm](../README.md)

**Chat** — `makeLlmOpenRouterStrategy(config)`, built on `/openai`'s `makeLlmOpenAiCompatibleChatStrategy` (the
`openai` peer is reached through `@dereekb/llm/openai`, pointed at OpenRouter):

- An `anthropic/` route sends the prompt's stable prefix as a `cache_control: { type: 'ephemeral' }` block, and a
  chained follow-up adds a history breakpoint on the last replayed turn; other routes get the plain prompt
  (`caching: 'breakpoint'`).
- `usage: { include: true }` rides every call, so the reply carries `cost`; the request's reasoning config rides as
  OpenRouter's nested `reasoning` object (an OFF config is sent as `reasoning: { enabled: false }` alone); the served
  upstream `provider` is echoed; `native_finish_reason` is the finish-reason fallback.
- No built-in model, and the same defaults as `/openai`. The same seams (`client`, `probeFetch`), [browser rule](browser.md),
  `openai` SDK environment reads ([openai](openai.md)) and `costBasis` / `providerStatusSource` /
  `credentialProbeSource` facets as `/openai` — the chat strategy runs on `/openai`'s client; the generic credential
  probe is `GET {baseUrl}/key`, and a 404 there is an error.

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

`LLM_OPENROUTER_ADAPTERS` registers the completion transport `openrouter` (default `https://openrouter.ai/api/v1`; `/node`'s env default reads
`OPENROUTER_SERVER_URL`, then `OPENROUTER_BASE_URL`, first) and
the decision route `openrouter` (`strategyKind: 'openrouter-decisions'`, derived for every `openrouter`-transport
provider). The kind is a persisted `strategyKind` that ledgers fold on: it keeps the value existing ledgers already
carry, which is why it does not follow ZenMux's `<route>-systemone` form (`'zenmux-systemone'`). The completion mapping is `/openai`'s shared `toLlmOpenAiCompatibleChatStrategyConfig`, which ignores the provider's `reasoningOff`,
`tokenLimitParam` and `usageAccounting` — this wire has one spelling for each. The entry's swallow sites are
`LLM_OPENROUTER_SWALLOW_SITES`; register them beside the root's the same way.

```ts
import { llmNoulQuestion } from '@dereekb/llm';
import { makeLlmOpenRouterDecisionStrategy, makeLlmOpenRouterStrategy } from '@dereekb/llm/openrouter';

const chat = makeLlmOpenRouterStrategy({ apiKey, defaultModel: 'anthropic/claude-opus-4.8' });
const decisions = makeLlmOpenRouterDecisionStrategy({ apiKey });
const { answers, usage } = await decisions.decide({ model: 'typesafe/jev-1.13', state: { ticket }, questions: { spam: llmNoulQuestion('`ticket` is unsolicited marketing.') } });
```
