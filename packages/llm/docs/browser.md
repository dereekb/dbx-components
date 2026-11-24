# Browser hosts

Entry: the browser-safe entries (the root, `/decision`, `/craft`, `/openai`, `/openrouter`, `/zenmux`) ·
[← @dereekb/llm](../README.md)

Every entry but `/node` and `/test` runs unchanged in a page or a worker ([Browser safety](../README.md#browser-safety)).
What differs for a browser host is where its configuration and its keys come from. Nothing reads an environment or a
file, so the host builds its providers and strategies itself. And any key a page holds is readable by whoever can open
that page.

- **Where the key lives.** Keep your account's keys on a server, and send the page's calls through your own endpoint
  (a proxy). Hold a key in the page only when it is the user's own (bring your own key). Keep it in memory or the
  user's own storage: never in a `models.json`, a call row or your telemetry.
- **Building without `/node`.** Build `LlmProviderConfig`s yourself and hand them to `makeLlmProviderStrategies`, as
  [Nest hosts](node.md#nest-hosts) does with keys from elsewhere. Or construct each strategy directly. A `models.json`
  you fetch parses with `parseLlmModelConfigFile`, exactly as on Node.
- **A proxy for chat.** Inject a `client`, any `LlmOpenAiChatClient`, into `makeLlmOpenAiStrategy` or
  `makeLlmOpenRouterStrategy`. Its `chat.completions.create(body, options)` posts the body to your endpoint, which adds
  the key, allow-lists the models and caps the spend.
  - The strategy needs no `apiKey`. It still passes `maxRetries: 0`, the `timeout` and the `signal` in `options`; pass
    the signal on.
  - Throw an error carrying the HTTP `status` and the response `headers`, so the dispatcher can classify it
    ([Writing a strategy](strategy.md#writing-a-strategy)).
  - With an injected client, the credential probe is a ready no-op unless you set `probeFetch` or
    `credentialProbeSource`.
- **A proxy for decisions.** Pass `decisionFetch` (a `ConfiguredFetch`) to `makeLlmOpenRouterDecisionStrategy` or
  `makeLlmZenmuxDecisionStrategy`, sending the request to your endpoint. An injected `decisionFetch` makes the strategy
  keyless: it skips its key checks and reports ready. Adapter-built decision strategies use the global `fetch`, so
  construct this one directly.
- **User-held keys.** The `openai` SDK refuses to run in a browser unless told to, and the stock adapters never tell
  it. Build the chat strategy with `dangerouslyAllowBrowser: true`, either directly or through your own completion
  adapter registered in place of the stock one ([Writing an adapter](adapters.md#writing-an-adapter)).
- **CORS.** A page that calls a gateway directly needs the gateway to answer CORS for the page's origin. That covers
  chat, the decision route and the credential probe (`GET /models`, `GET /key`). A gateway or LAN server that does not
  answer CORS cannot be reached from a page, so proxy it. ZenMux's quota and bill reads need the management and
  pay-as-you-go keys, which belong on a server.
- **What stays on the server.** `/node` (file and environment reads), `/test`, and anything that needs your account's
  keys.

Bring your own key — the user's OpenRouter key, held in memory:

```ts
import { DEFAULT_LLM_MAX_OUTPUT_TOKENS, makeLlmDispatcher, makeLlmStrategyRegistry } from '@dereekb/llm';
import { makeLlmOpenRouterStrategy } from '@dereekb/llm/openrouter';

const chat = makeLlmOpenRouterStrategy({ apiKey: userKey, dangerouslyAllowBrowser: true });
const dispatcher = makeLlmDispatcher({ strategies: makeLlmStrategyRegistry([chat]), defaultStrategyId: chat.id, defaultMaxOutputTokens: DEFAULT_LLM_MAX_OUTPUT_TOKENS, modelTiers: { fast: 'vendor/model-flash' }, descriptorOf, templateResolver });
```

A proxy — the page holds no key; your endpoint adds it:

```ts
import { makeLlmOpenAiStrategy, type LlmOpenAiChatClient } from '@dereekb/llm/openai';

const proxy: LlmOpenAiChatClient = {
  chat: {
    completions: {
      create: async (body, options) => {
        const response = await fetch('/api/llm/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: options?.signal });

        if (!response.ok) {
          throw Object.assign(new Error(`llm proxy answered ${response.status}`), { status: response.status, headers: response.headers });
        }

        return response.json();
      }
    }
  }
};

const chat = makeLlmOpenAiStrategy({ id: 'proxy', client: proxy });
```
