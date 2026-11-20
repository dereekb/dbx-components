# OpenAI-compatible chat (`@dereekb/llm/openai`)

Entry: `@dereekb/llm/openai` · [← @dereekb/llm](../README.md)

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
