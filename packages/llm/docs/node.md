# Node host quick start (`@dereekb/llm/node`)

Entry: `@dereekb/llm/node` (Node only) · [← @dereekb/llm](../README.md)

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
  | `providers[openrouter]` | `OPENROUTER_API_KEY`, `OPENROUTER_SERVER_URL`, `OPENROUTER_BASE_URL` | The fallback env default: key and endpoint (first set wins). Serves only when nothing else is keyed, or when selected. |
  | `defaultProvider` | `LLM_PROVIDER` | The explicit default-provider selection. A value naming no env default with a registered adapter and no declared completion provider throws, listing the selectable ids. |
  | `modelsFile` | `LLM_MODELS_FILE` | The model config file path; a path set here that does not exist fails loud. |
  | `modelProfile` | `LLM_MODEL_PROFILE` | The per-run profile override (wins over the file's `active`; `off` / `none`, any case, selects none). |
  | `modelTiers` | `LLM_MODEL_TIERS` | The bulk tier map, as JSON. |
  | `tierModels` | `LLM_MODEL` (`fast`), `LLM_MODEL_STRONG` (`strong`) | One slug per tier; wins over the same key in `modelTiers`. |
  | `defaultTier` | `LLM_DEFAULT_TIER` | Which tier is the default. |
  | `decodeRetryTier` | `LLM_DECODE_RETRY_TIER` | Which tier a malformed reply retries on (`off` / `none`, any case, keeps the same model). |
  | `decisionProvider` | `LLM_DECISION_PROVIDER` | The decision-lane provider pin (a provider id; the test lane throws on one that is not registered). |
  | `craftNotesDir` | `LLM_CRAFT_NOTES_DIR` | The machine craft-notes folder. |

  Whose names these are: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENROUTER_API_KEY` and `OPENROUTER_BASE_URL` are the
  vendor SDKs' own; `OPENROUTER_SERVER_URL` is `@dereekb/nestjs/openrouter`'s. The OpenRouter row reads
  `OPENROUTER_SERVER_URL`, then `OPENROUTER_BASE_URL`, else the adapter default (`https://openrouter.ai/api/v1`) — the
  Nest module's names in the Nest module's order (`OPENROUTER_SERVER_URL_ENV_VAR`, `OPENROUTER_BASE_URL_ENV_VAR`), so
  a host running both clients sends both to one endpoint: chat, the `/key` probe and decisions. A `models.json`
  provider with the same id replaces the env default, endpoint included. `OPENAI_ORG_ID` / `OPENAI_PROJECT_ID` are
  never read: the `openai` transport serves any OpenAI-compatible gateway, and those ids would reach it (see
  [openai](openai.md) for injecting your own client).

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

## A complete Node host

From the environment and a models file to a dispatcher. The file declares one extra provider — a local OpenAI-
compatible server — and a profile; a profile is a flat tier map, and `models` binds a slug to a provider:

```json
{
  "active": "balanced",
  "providers": { "local": { "transport": "openai", "baseUrl": "http://127.0.0.1:8000/v1", "apiKeyEnv": "LOCAL_LLM_API_KEY" } },
  "profiles": { "balanced": { "fast": "local/small", "strong": "vendor/large" } },
  "models": { "local/small": { "provider": "local" } }
}
```

The environment:

```sh
LOCAL_LLM_API_KEY=…            # the key the file's `local` provider names (apiKeyEnv)
OPENROUTER_API_KEY=…           # the OpenRouter env default, the fallback provider
LLM_PROVIDER=openrouter        # optional: make it the default although `local` is keyed too
LLM_MODELS_FILE=/path/models.json  # optional: another path; a path set here that does not exist fails loud
```

The code:

```ts
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_LLM_MAX_OUTPUT_TOKENS, llmModelProviderBindings, llmModelReasoningOffEncodings, llmModelVisionCapabilities, makeLlmAdapterRegistry, makeLlmDispatcher, makeLlmModelConfigSchema, readLlmModelConfigLists, resolveLlmModelTier, resolveLlmModelTiers } from '@dereekb/llm';
import { loadEffectiveLlmModelConfigFile, makeLlmStrategiesFromEnv, resolveLlmModelProfileFromEnv, resolveLlmModelTierEnv } from '@dereekb/llm/node';
import { LLM_OPENAI_ADAPTERS } from '@dereekb/llm/openai';
import { LLM_OPENROUTER_ADAPTERS } from '@dereekb/llm/openrouter';

const adapters = makeLlmAdapterRegistry([...LLM_OPENAI_ADAPTERS, ...LLM_OPENROUTER_ADAPTERS]);
const schema = makeLlmModelConfigSchema({ ...readLlmModelConfigLists(adapters), label: 'my-app models' });

// LLM_MODELS_FILE, else ~/.my-app/models.json, else the base tiers alone.
const loaded = loadEffectiveLlmModelConfigFile({ schema, defaultPath: join(homedir(), '.my-app', 'models.json') });

// Tiers: env over the active profile over the host's base.
const profile = resolveLlmModelProfileFromEnv({ file: loaded.file, source: loaded.filePath, schema });
const tierEnv = resolveLlmModelTierEnv();
const { tiers, defaultTier } = resolveLlmModelTiers({ base: { fast: 'vendor/small', strong: 'vendor/large' }, modelTiers: { ...profile?.tiers, ...tierEnv.modelTiers }, defaultTier: tierEnv.defaultTier });

// Providers: the env defaults plus the file's own, each keyed from the env.
const { strategies, defaultProviderId, gaps } = makeLlmStrategiesFromEnv({
  file: loaded.file,
  schema,
  adapters,
  defaultModel: resolveLlmModelTier(tiers, defaultTier),
  reasoningOffByModel: llmModelReasoningOffEncodings(loaded.file),
  visionByModel: llmModelVisionCapabilities(loaded.file)
});

if (defaultProviderId == null) {
  throw new Error('No LLM provider is configured.');
}

const dispatcher = makeLlmDispatcher({
  strategies,
  defaultStrategyId: defaultProviderId,
  defaultMaxOutputTokens: DEFAULT_LLM_MAX_OUTPUT_TOKENS,
  modelTiers: tiers,
  defaultTier,
  decodeRetryTier: tierEnv.decodeRetryTier,
  providerByModel: llmModelProviderBindings(loaded.file),
  descriptorOf: (capability) => DESCRIPTORS[capability], // the README quick start's
  templateResolver // the README quick start's
});
```

With the environment above, the strategies are `local` and `openrouter` (no `openai`: `OPENAI_API_KEY` is unset), and
`openrouter` is the default because `LLM_PROVIDER` names it. `fast` dispatches `local/small` on `local` (the file's
`models` binding); `strong` dispatches `vendor/large` through OpenRouter, the default provider. `gaps` lists declared
providers whose key is missing; scope it to the models a run can reach with `filterLlmReachableProviderGaps` before
failing a run on it.

`defaultModel` here serves direct strategy calls only: a strategy behind a dispatcher is always sent the resolved slug.

Pinned by `test/src/lib/llm.test.node.host.example.spec.ts` (stand-in adapters; see its header).

## Adding ZenMux

There is no ZenMux env default, so declare a ZenMux provider in `models.json` (its chat rides the `openai` transport)
and add its adapters to the registry. The management key is the host's own setting, read with the same rule:

```ts
import { firstLlmEnvEntry } from '@dereekb/llm/node';
import { LLM_ZENMUX_MANAGEMENT_API_KEY_ENV_VAR, makeLlmZenmuxAdapters } from '@dereekb/llm/zenmux';

const management = firstLlmEnvEntry({ names: [LLM_ZENMUX_MANAGEMENT_API_KEY_ENV_VAR] });
const adapters = makeLlmAdapterRegistry([...LLM_OPENAI_ADAPTERS, ...makeLlmZenmuxAdapters({ managementApiKey: management?.value, managementApiKeyEnv: management?.name }), ...LLM_OPENROUTER_ADAPTERS]);
```

## Nest hosts

There is no Nest module for llm, and none is needed: pass nothing. `/node` reads `process.env` when a call has no
`env`, and Nest's `ConfigService` answers `process.env[name]` for every name a `ConfigModule.forRoot({ load })` factory
does not define — so both read the same variables.

| Variable | `@dereekb/nestjs` | `/node` (`DEFAULT_LLM_ENV_NAMES`) |
|---|---|---|
| `OPENAI_API_KEY`, `OPENAI_BASE_URL` | `@dereekb/nestjs/openai` | the `openai` env default |
| `OPENAI_ORG_ID`, `OPENAI_PROJECT_ID` | required by `@dereekb/nestjs/openai` | never read, on purpose ([openai](openai.md)) |
| `OPENROUTER_API_KEY` | `@dereekb/nestjs/openrouter` | the `openrouter` env default |
| `OPENROUTER_SERVER_URL`, then `OPENROUTER_BASE_URL` | `@dereekb/nestjs/openrouter` | the same order |
| `LLM_*` | — | `/node` only |

A factory provider needs nothing from Nest but its standard `useFactory` shape:

```ts
// APP_LLM_STRATEGIES is the host's own injection token; no env and no ConfigService are passed.
{ provide: APP_LLM_STRATEGIES, useFactory: () => makeLlmStrategiesFromEnv({ file: loaded.file, schema, adapters }) }
```

- The Nest modules read values as they are, while `/node` trims them and treats a blank value as unset.
- A host that defines values through `load` factories passes them as `env`, a plain record:
  `env: { OPENROUTER_API_KEY: config.get('OPENROUTER_API_KEY') }`.

Keys from elsewhere (a secret manager, a user's stored key) skip the environment: build an `LlmProviderConfig` and
hand it to the root's `makeLlmProviderStrategies`. `apiKeyEnv` only names where a key would come from; the value sent
is `apiKey`.

```ts
import { makeLlmAdapterRegistry, makeLlmProviderStrategies, makeLlmStrategyRegistry, type LlmProviderConfig } from '@dereekb/llm';
import { LLM_OPENROUTER_ADAPTERS } from '@dereekb/llm/openrouter';

const provider: LlmProviderConfig = { id: 'openrouter', transport: 'openrouter', apiKeyEnv: 'OPENROUTER_API_KEY', apiKey: await secrets.read('openrouter') };
const strategies = makeLlmStrategyRegistry(makeLlmProviderStrategies({ providers: [provider], adapters: makeLlmAdapterRegistry(LLM_OPENROUTER_ADAPTERS) }));
```
