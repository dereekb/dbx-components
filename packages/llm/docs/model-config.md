# Model configuration and routing

Entry: `@dereekb/llm` (file and environment reads: `@dereekb/llm/node`) · [← @dereekb/llm](../README.md)

## Model configuration

Which models a host runs, and which backend serves each one, is configuration rather than code. The library holds the
pure half — the file shape, a fail-loud parse, the overlay of a host's built-ins, and resolution. It reads no
environment variable and no file: `/node` does that, and a browser host passes the parsed JSON in. On Node, the
[Node host quick start](node.md) shows `/node` doing those reads.

- **Tiers.** A capability names a tier (`fast`, `strong`, or any key a host adds), never a slug.
  `resolveLlmModelTiers({ base, modelTiers, defaultTier })` merges the host's declaration over its own base map and
  fails loud when the default tier is missing; `resolveLlmModelTier` fails loud on an unknown key. Every reader names
  the default tier through `resolveLlmDefaultModelTierKey` (trimmed; blank or unset ⇒ `fast`). A tier value is a slug
  or `{ model, maxOutputTokens?, reasoning? }` — read it with `readLlmTierModel` / `toLlmTierConfig`. The library ships
  no slugs.
- **Tier values are strict.** `parseLlmModelTierValue` / `parseLlmModelTierMap` (and the env tier reader) reject a
  blank or untrimmed slug and a token cap (`maxOutputTokens`, `reasoning.maxTokens`) that is not a positive integer,
  and report `<label>.<field> must … (got <value>).`, prefixed with the schema label when one is passed
  (`schemaLabel`). The value types are derived from arktype declarations (`llmModelTierValueType`,
  `llmReasoningConfigType`, … in `llm.model.type.ts`); `LLM_REASONING_EFFORTS` is the effort list.
  The field and key checks themselves are `@dereekb/model`'s `parseArktypeFieldsWithMessages` and `assertObjectKeys`
  (typed by its `ArktypeFieldRules`); a host's own extension keys call them so they report in the same format.
- **The file.** `parseLlmModelConfigFile({ raw, source, schema })` validates a `models.json`-shaped object: named
  `providers`, `profiles` (complete tier maps), per-slug `models` facts, `active`, and the unread `notes` / `$schema`.
  An unknown key, an illegal value or a malformed tier throws an error naming the file and the entry, so a typo
  reddens startup instead of billing the model you meant to leave. A provider names the env var holding its key
  (`apiKeyEnv`), never the key. An unknown top-level key lists the allowed ones in the one key order,
  `LLM_MODEL_CONFIG_FILE_KEYS` (`$schema`, `notes`, `active`, `providers`, `profiles`, `models`), and a tier error
  inside the file carries the schema label (`my-app models: models.json profiles['free']['fast'] …`). The parsed file
  splits the on-disk `providers` block three ways: `providers` (completion providers — the only ones a completion
  reader mints strategies for), `extensionProviders` (entries of a transport the extension owns) and `providerPatches`
  (an extension's fields declared alone). `parseLlmProviderEntry` answers which (`{ kind: 'completion' | 'extension',
  entry }`). `flattenLlmModelConfigFile(file)` is the reverse: the plain on-disk object, keys in the constant's order,
  profiles flattened, and `providers` written as completion entries, then owned entries, then patches.
- **Schema and extensions.** `makeLlmModelConfigSchema({ label, transports, meterings, decisionRoutes,
  implicitProviders, retiredKeys, extension })` sets the legal values and the error label. An extension adds provider
  and model keys with their parsers, transports it owns (providers that serve no completions), patch entries (an entry
  with no transport, base URL or key var that extends the built-in provider of the same name) and metering sources. A
  retired key fails with the remedy you register. The entry and per-slug types are derived from arktype declarations
  (`llmCompletionProviderEntryType`, `llmModelSettingsType`, … in `llm.model.config.type.ts`), and an extension's
  fields are typed `Partial<…>` on every entry, patch and resolved config — a provider that leaves them out is still
  well-typed, so the extension seam needs no cast. Declare an extension's fields the same way: an arktype type with
  `'+': 'delete'`, read through `@dereekb/model`'s `parseArktypeFieldsWithMessages`. `LLM_PROVIDER_COMPLETION_ONLY_KEYS`
  (`reasoningOff`, `tokenLimitParam`, `usageAccounting`, `decision`) lists the keys that only mean something on a
  provider that serves completions — the ones an extension's entry parser refuses on a provider kind it owns.
  `metering` is not one: an extension's provider may bill an account too.
- **Overlay.** `overlayLlmModelConfigFile({ base, file, source, schema })` lays a host's file over its built-ins. A
  provider, profile or per-slug entry the file names replaces the built-in whole — a half-replaced provider would bill
  one account at another's endpoint — and every `models[slug].provider` is then checked against the merged providers.
  A patch's `undefined` field and a host-built overlay's `undefined` slug keep the base's value.
- **Resolution.** `resolveLlmModelProfile({ file, override, schema })` picks the active profile: the override wins,
  an off value (`off` / `none` in any case, `LLM_OFF_VALUES` / `isLlmOffValue`) or a blank `active` selects nothing,
  and a name the file lacks throws. `llmModelReasoningOffEncodings`,
  `llmModelVisionCapabilities`, `llmModelPromptAddenda` and `llmModelProviderBindings` project the per-slug facts,
  each a one-line `mapLlmModelSettings({ file, read })` — the generic projector a host uses for its own per-slug
  fields (only the slugs `read` answers for are kept; `undefined` when none is). It is generic over the settings type
  `S`, inferred from the file, so `read` sees an extension's per-slug fields with no cast.
  `resolveLlmProviderConfigs({ providers, apiKeyOf })` turns the declared completion providers into
  `LlmProviderConfig`s that carry the key value, and lists the declared providers whose key is missing.
- **Wire vocabulary.** `LLM_REASONING_OFF_ENCODINGS` (how an OpenAI-compatible wire says "reasoning off":
  `effort-none`, `effort-minimal`, `nested-disabled`, `omit`), `resolveLlmReasoningOffEncoding` (the slug's own, then the
  fallback, then `effort-none`), `LLM_TOKEN_LIMIT_PARAMS`, and the per-slug `LlmModelReasoningOffMap` /
  `LlmModelVisionMap` the transports read. `normalizeLlmReasoningConfig` applies the one OFF rule: an explicit
  `enabled: false` drops every other knob (`effort`, `maxTokens`, `exclude`) before any transport maps the config.

```json
{
  "active": "balanced",
  "providers": { "local": { "transport": "openai", "baseUrl": "http://192.168.1.50:8000/v1", "apiKeyEnv": "LOCAL_API_KEY" } },
  "profiles": { "balanced": { "fast": "local/qwen-27b", "strong": "deepseek/deepseek-v4.1-flash" } },
  "models": { "local/qwen-27b": { "provider": "local", "reasoningOff": "omit" } }
}
```

```ts
import { makeLlmModelConfigSchema, overlayLlmModelConfigFile, parseLlmModelConfigFile, resolveLlmModelProfile, resolveLlmModelTiers, resolveLlmProviderConfigs } from '@dereekb/llm';

const schema = makeLlmModelConfigSchema({ label: 'my-app models', transports: ['openai', 'openrouter'] });
const file = parseLlmModelConfigFile({ raw: JSON.parse(text), source: 'models.json', schema });
const effective = overlayLlmModelConfigFile({ base: BUILT_IN_MODEL_CONFIG, file, source: 'models.json', schema });
const profile = resolveLlmModelProfile({ file: effective, override: requestedProfile, schema });
const { tiers, defaultTier } = resolveLlmModelTiers({ base: BUILT_IN_TIERS, modelTiers: profile?.tiers });
const { providers, gaps } = resolveLlmProviderConfigs({ providers: effective.providers, apiKeyOf: ({ entry }) => keys[entry.apiKeyEnv] });
```

## Model routing

A host moves a capability to another model without touching code. Routing rules map capabilities — by key or by tag —
onto a tier or a slug, and one precedence ladder decides what each call runs on, so a dispatcher and a report that
explains the choice read the same answer.

- **Parse.** `parseLlmModelRoutingConfig({ raw, source, label? })` validates a routing block read from JSON (or an env
  var) into an `LlmModelRoutingConfig` and fails loud naming the field — an unknown key, a non-array `rules`, a
  `"tags": "support"` string, a `"maxOutputTokens": "9000"` string or a non-integer cap, a bad `reasoning`, or a bad
  `tiers` value (the tier parser's own message). It checks shapes only; `compileLlmModelRouting` checks names.
- **Rules.** `compileLlmModelRouting({ routing, capabilities, tiers, providers, label })` (a thin caller of the shared
  `compileLlmCapabilityRules`, which also compiles the critique policy; a rule is an `LlmCapabilityRuleTarget`, i.e.
  `capabilities` and/or `tags`) compiles an
  `LlmModelRoutingConfig` (`{ tiers?, defaultTier?, rules? }`) into an `LlmCompiledModelRouting`: capability →
  `LlmCapabilityRoute` (`{ model, tier?, provider?, maxOutputTokens?, reasoning? }`). A rule targets `capabilities`
  and/or `tags` and routes to a `tier` or a `model` slug (the slug wins when both are set). A capability-key match beats
  any tag match; within a level the first rule wins. It fails loud at startup on an unknown capability, a tag no
  capability carries, an unknown tier, an unknown provider (when you pass `providers`), or a rule with no target or no
  route. Merge `routing.tiers` and `routing.defaultTier` into your tiers with `resolveLlmModelTiers` first.
- **Model.** `resolveLlmCapabilityModel({ override, descriptor, route, tiers, defaultTier })`: the call's own slug >
  its tier > the route > the capability's slug > its tier > the default tier. The result names the rung that won
  (`source`), and the default tier is resolved first, so a bad default fails on every path.
- **Output controls.** `resolveLlmCapabilityOutputControls(…)`: `maxOutputTokens` follows route > capability > tier
  and is absent when nothing sets it; `reasoning` follows the call > route > capability > tier > `reasoningDefault`
  (usually `LLM_REASONING_OFF`, `{ enabled: false }`).
- **Provider.** `resolveLlmCapabilityProvider({ route, model, bindings, defaultProvider })`: the route's provider (a
  host policy) > the slug's binding (`llmModelProviderBindings`, an entitlement) > your default.
- **Vision.** `resolveLlmCapabilityVision({ …, visionByModel })` — the slug a capability bills and whether it accepts images.

```ts
import { compileLlmModelRouting, llmModelProviderBindings, parseLlmModelRoutingConfig, resolveLlmCapabilityModel, resolveLlmCapabilityProvider, resolveLlmModelTiers } from '@dereekb/llm';

const routing = parseLlmModelRoutingConfig({ raw: JSON.parse(routingText), source: 'routing.json' });
const { tiers, defaultTier } = resolveLlmModelTiers({ base: BUILT_IN_TIERS, modelTiers: { ...routing.tiers, ...profile?.tiers }, defaultTier: routing.defaultTier });
const routes = compileLlmModelRouting({ routing, capabilities: [{ capability: 'support-reply', tags: ['support'] }, { capability: 'summarize' }], tiers, providers: ['local', 'openrouter'] });

const route = routes.get('support-reply');
const { model, source } = resolveLlmCapabilityModel({ descriptor: { tier: 'fast' }, route, tiers, defaultTier });
const { provider } = resolveLlmCapabilityProvider({ route, model, bindings: llmModelProviderBindings(effective), defaultProvider: 'openrouter' });
```
