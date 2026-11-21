# ZenMux (`@dereekb/llm/zenmux`)

Entry: `@dereekb/llm/zenmux` · [← @dereekb/llm](../README.md)

ZenMux is a gateway: its chat rides the `/openai` transport, and this entry holds everything else — the account (cost
basis, quota status, per-call bills, the credential probe) and the decision route `POST {baseUrl}/systemone`. It talks
plain `fetch`, so it needs no SDK, and never reads the environment: the host passes every key in. ZenMux chat is
`/openai`'s transport pointed at ZenMux, so the `openai` SDK's own environment reads apply to it ([openai](openai.md)).

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
