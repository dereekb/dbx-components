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
