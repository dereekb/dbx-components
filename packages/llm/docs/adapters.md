# Adapters

Entry: `@dereekb/llm` (the stock adapters ship in the provider entries) · [← @dereekb/llm](../README.md)

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
- **Strategies.** `makeLlmProviderStrategies({ providers, adapters, defaultModel, maxOutputTokens,
  maxOutputTokensByProvider, timeoutMs, visionByModel, reasoningOffByModel, fetch })` builds one strategy per resolved
  provider (`resolveLlmProviderConfigs`), registered under the provider's own name. A provider's cap is its
  `maxOutputTokensByProvider[provider.id]` entry, else the shared `maxOutputTokens`; a stock strategy declares it as
  `defaultMaxOutputTokens`, so it also applies behind a dispatcher. Construction is inert. Both builders check each minted strategy with
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

## Writing an adapter

An adapter turns a configured provider (an `LlmProviderConfig`, from `models.json` or your code) into a strategy. That
is how `makeLlmProviderStrategies` and `/node`'s env reads mint yours.

- **Shape.** A completion adapter is an `LlmCompletionAdapter`, `{ facet: 'completion', kind, defaultBaseUrl?, make }`:
  - `kind` is the `transport` a provider names.
  - `defaultBaseUrl` is the endpoint a provider of that transport gets when it declares none
    (`resolveLlmProviderBaseUrl`).
  - `make(config)` mints the strategy.

  A decision adapter is an `LlmDecisionAdapter`, `{ facet: 'decision', kind, strategyKind, transports?, make }`, keyed
  by decision route. The account facets are `LlmMeteringAdapter`, `LlmBillAdapter` and `LlmCredentialProbeAdapter`.
- **`make` is inert and keeps the id.** It receives an `LlmCompletionAdapterConfig`: the `provider` (its `id`, `apiKey`
  and declared fields), the resolved `baseUrl`, the host's `fetch`, and the shared options (`defaultModel`,
  `maxOutputTokens`, `timeoutMs`, `visionByModel`, `reasoningOffByModel`, `costBasis`, `providerStatusSource`,
  `credentialProbe`). It returns a strategy whose `id` is `provider.id`; `checkLlmAdapterStrategy` refuses anything
  else. It does no I/O: probes and status reads run later.
- **Register it** beside the stock adapters, and feed `readLlmModelConfigLists(adapters)` to `makeLlmModelConfigSchema`
  so a `models.json` provider may name your transport. There is one adapter per facet and kind, so to replace a stock
  adapter (to inject a client, say), register yours INSTEAD of it.
  `LLM_OPENROUTER_ADAPTERS.filter((adapter) => adapter.facet !== 'completion')` keeps the rest of an entry's adapters.
- **Extending a stock transport.** Map the config with the entry's own mapping and add your fields, for example
  `make: (config) => makeLlmOpenAiStrategy({ ...toLlmOpenAiStrategyConfig(config), dangerouslyAllowBrowser: true })`
  ([Browser hosts](browser.md)). OpenRouter's mapping is `/openai`'s `toLlmOpenAiCompatibleChatStrategyConfig`.

`makeInHouseStrategy` stands for the host's factory around the strategy in
[Writing a strategy](strategy.md#writing-a-strategy):

```ts
import { makeLlmAdapterRegistry, makeLlmModelConfigSchema, readLlmModelConfigLists, type LlmCompletionAdapter } from '@dereekb/llm';
import { LLM_OPENAI_ADAPTERS } from '@dereekb/llm/openai';

const IN_HOUSE_ADAPTER: LlmCompletionAdapter = {
  facet: 'completion',
  kind: 'in-house',
  defaultBaseUrl: 'http://models.internal:8080',
  make: ({ provider, baseUrl, maxOutputTokens }) => makeInHouseStrategy({ id: provider.id, apiKey: provider.apiKey, baseUrl, maxOutputTokens })
};

const adapters = makeLlmAdapterRegistry([...LLM_OPENAI_ADAPTERS, IN_HOUSE_ADAPTER]);
const schema = makeLlmModelConfigSchema({ ...readLlmModelConfigLists(adapters), label: 'my-app models' }); // "transport": "in-house" now parses
```
