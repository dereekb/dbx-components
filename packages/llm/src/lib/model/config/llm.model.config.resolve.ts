/**
 * Model config **resolution**: which profile is active, the per-slug projections the transports and dispatcher read,
 * and the RESOLVED provider configs that carry the key VALUE.
 *
 * Nothing here reads the environment: a host passes the raw values it read (a per-run profile override, a default-tier
 * setting, a key reader), so the same functions serve a server reading env vars and a browser host reading a user's
 * stored settings.
 */

import { type Maybe } from '@dereekb/util';
import { isLlmOffValue, type LlmPartialModelTierMap, readLlmTierModel, resolveLlmDefaultModelTierKey } from '../llm.model.tier';
import { type LlmModelReasoningOffMap, type LlmModelVisionMap } from '../llm.model.wire';
import { type LlmModelId, type LlmModelSlugMap, type LlmModelTierKey, type LlmStrategyId } from '../llm.value';
import { DEFAULT_LLM_MODEL_CONFIG_SOURCE, type LlmCompletionProviderEntry, type LlmCompletionProviderEntryMap, type LlmExtendedCompletionProviderEntry, type LlmModelConfigBaseTypes, type LlmModelConfigFile, type LlmModelConfigSchema, type LlmModelConfigTypes, type LlmModelSettings } from './llm.model.config.schema';

// MARK: Profile
/**
 * Where the active profile's selection came from — named in a startup line so an operator can tell a file pick from a
 * per-run override when a run turns out to be on the model they did not expect.
 */
export type LlmModelProfileSelectedBy = 'override' | 'file';

/**
 * Config for {@link resolveLlmModelProfile}.
 */
export interface ResolveLlmModelProfileConfig<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * The effective (overlaid) file. Absent ⇒ nothing to resolve.
   */
  readonly file?: Maybe<LlmModelConfigFile<X>>;
  /**
   * A per-run pick (an env value, a CLI flag) that wins over the file's `active`. Trimmed; blank ⇒ none.
   */
  readonly override?: Maybe<string>;
  /**
   * What the error names as the override's surface (an env var name). Default `'the profile override'`.
   */
  readonly overrideLabel?: Maybe<string>;
  /**
   * The file path / label errors name. Default {@link DEFAULT_LLM_MODEL_CONFIG_SOURCE}.
   */
  readonly source?: Maybe<string>;
  /**
   * The schema (its label prefixes the error).
   */
  readonly schema: LlmModelConfigSchema<X>;
}

/**
 * WHICH profile resolved, and the tiers it declares.
 */
export interface LlmResolvedModelProfile {
  /**
   * The resolved profile name.
   */
  readonly profileName: string;
  /**
   * The tier map it declares — the host merges it over its tier base.
   */
  readonly tiers: LlmPartialModelTierMap;
  /**
   * Where the selection came from.
   */
  readonly selectedBy: LlmModelProfileSelectedBy;
}

/**
 * Resolve the ACTIVE profile — the override over the file's own `active` key.
 *
 * Returns `undefined` when nothing selects a profile (no file, a blank `active`, or an off value — `off` / `none` in any
 * case, `LLM_OFF_VALUES`),
 * so a host's "no profile" path is a null check. FAILS LOUD when a selection names a profile the file does not define,
 * listing the ones it does: a run that silently fell back to the host's defaults because `active` was misspelled is the
 * billed surprise this layer exists to prevent.
 *
 * @param config - The file, the override and its label, the source label and the schema.
 * @returns The resolved profile, or `undefined` when none is selected.
 * @throws {Error} When the selected profile name is not defined in the file.
 */
export function resolveLlmModelProfile<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: ResolveLlmModelProfileConfig<X>): Maybe<LlmResolvedModelProfile> {
  const { file, schema } = config;
  const source = config.source ?? DEFAULT_LLM_MODEL_CONFIG_SOURCE;
  const fromOverride = (config.override ?? '').trim();
  const selectedBy: LlmModelProfileSelectedBy = fromOverride.length > 0 ? 'override' : 'file';
  const requested = fromOverride.length > 0 ? fromOverride : (file?.active ?? '').trim();
  const profiles = file?.profiles ?? {};
  let resolved: Maybe<LlmResolvedModelProfile>;

  if (requested.length > 0 && !isLlmOffValue(requested)) {
    const entry = Object.hasOwn(profiles, requested) ? profiles[requested] : undefined;

    if (entry == null) {
      const available = Object.keys(profiles);
      const where = selectedBy === 'override' ? (config.overrideLabel ?? 'the profile override') : `${source}.active`;
      throw new Error(`${schema.label}: ${where} names profile '${requested}', which ${source} does not define (have: ${available.length === 0 ? '(none)' : available.join(', ')}).`);
    }

    resolved = { profileName: requested, tiers: entry.tiers, selectedBy };
  }

  return resolved;
}

/**
 * Config for {@link llmModelProfileDefaultModel}.
 */
export interface LlmModelProfileDefaultModelConfig {
  /**
   * The resolved profile.
   */
  readonly profile: Maybe<LlmResolvedModelProfile>;
  /**
   * The host's default-tier setting. Trimmed; blank ⇒ `DEFAULT_LLM_MODEL_TIER` (`resolveLlmDefaultModelTierKey`).
   */
  readonly defaultTier?: Maybe<LlmModelTierKey>;
}

/**
 * The single model slug a resolved profile means for a caller that routes through NO tier registry (a test lane that
 * knows only one model). Reads the profile's DEFAULT tier, so a profile that renamed its default is honoured rather
 * than half-read.
 *
 * @param config - The resolved profile and the default-tier setting.
 * @returns The default tier's slug, or `undefined` when the profile declares no such tier.
 */
export function llmModelProfileDefaultModel(config: LlmModelProfileDefaultModelConfig): Maybe<LlmModelId> {
  const tierKey = resolveLlmDefaultModelTierKey(config.defaultTier);
  const value = config.profile?.tiers[tierKey];
  return value == null ? undefined : readLlmTierModel(value);
}

// MARK: Projections
/**
 * The per-model PROVIDER bindings: model slug → the provider name that serves it.
 */
export type LlmModelProviderBindingMap = LlmModelSlugMap<LlmStrategyId>;

/**
 * The per-model PROMPT ADDENDUM map: model slug → the text prepended to every dispatch that resolves to that slug.
 * Keyed by SLUG rather than by tier or capability, because the need belongs to the model however it was selected.
 */
export type LlmModelPromptAddendumMap = LlmModelSlugMap<string>;

/**
 * What the projections read: any object with a `models` block (a parsed or merged file).
 */
export interface LlmModelSettingsSource {
  readonly models?: Maybe<LlmModelSlugMap<LlmModelSettings>>;
}

/**
 * Config for {@link mapLlmModelSettings}.
 */
export interface MapLlmModelSettingsConfig<V> {
  /**
   * The file (absent ⇒ none).
   */
  readonly file: Maybe<LlmModelSettingsSource>;
  /**
   * Reads one slug's value; `null` / `undefined` ⇒ the slug is left out.
   */
  readonly read: (settings: LlmModelSettings) => Maybe<V>;
}

/**
 * Project the `models` block onto a per-slug map — THE one projector behind every per-slug map a host hands its
 * transports and dispatcher. Only the slugs `read` returns a value for are kept, in declaration order, and the result
 * is `undefined` (never `{}`) when none does, so a host's spread of it stays absent.
 *
 * @param config - The file and the per-slug reader.
 * @returns The slug → value map, or `undefined`.
 */
export function mapLlmModelSettings<V>(config: MapLlmModelSettingsConfig<V>): Maybe<LlmModelSlugMap<V>> {
  const { file, read } = config;
  const entries: [LlmModelId, V][] = [];

  for (const [model, settings] of Object.entries(file?.models ?? {})) {
    const value = settings == null ? undefined : read(settings);

    if (value != null) {
      entries.push([model, value]);
    }
  }

  return entries.length === 0 ? undefined : Object.fromEntries(entries);
}

/**
 * The per-model reasoning-OFF map the transport takes ({@link mapLlmModelSettings}).
 *
 * @param file - The file (absent ⇒ none).
 * @returns The slug → encoding map, or `undefined`.
 */
export function llmModelReasoningOffEncodings(file: Maybe<LlmModelSettingsSource>): Maybe<LlmModelReasoningOffMap> {
  return mapLlmModelSettings({ file, read: (settings) => settings.reasoningOff });
}

/**
 * The per-model VISION map the transports take — only the slugs that declare `vision: true`.
 *
 * @param file - The file (absent ⇒ none).
 * @returns The slug → `true` map, or `undefined`.
 */
export function llmModelVisionCapabilities(file: Maybe<LlmModelSettingsSource>): Maybe<LlmModelVisionMap> {
  return mapLlmModelSettings({ file, read: (settings) => (settings.vision === true ? true : undefined) });
}

/**
 * The per-model PROMPT ADDENDUM map the dispatcher takes ({@link mapLlmModelSettings}).
 *
 * @param file - The file (absent ⇒ none).
 * @returns The slug → addendum map, or `undefined`.
 */
export function llmModelPromptAddenda(file: Maybe<LlmModelSettingsSource>): Maybe<LlmModelPromptAddendumMap> {
  return mapLlmModelSettings({ file, read: (settings) => settings.promptAddendum });
}

/**
 * The per-model PROVIDER bindings the host and dispatcher take ({@link mapLlmModelSettings}).
 *
 * @param file - The file (absent ⇒ none).
 * @returns The slug → provider-name map, or `undefined`.
 */
export function llmModelProviderBindings(file: Maybe<LlmModelSettingsSource>): Maybe<LlmModelProviderBindingMap> {
  return mapLlmModelSettings({ file, read: (settings) => settings.provider });
}

// MARK: Provider configs
/**
 * A RESOLVED completion provider: its declared entry plus the key VALUE. Never log or persist one.
 */
export interface LlmProviderConfig extends LlmCompletionProviderEntry {
  /**
   * The provider NAME — the strategy instance id.
   */
  readonly id: LlmStrategyId;
  /**
   * The key value, read through the entry's {@link LlmCompletionProviderEntry.apiKeyEnv}.
   */
  readonly apiKey: string;
}

/**
 * A resolved provider config with the extension's provider fields (`Partial`, as on the entry it came from — a host's
 * env-default instance carries none).
 */
export type LlmExtendedProviderConfig<X extends LlmModelConfigTypes> = LlmProviderConfig & Partial<X['providerFields']>;

/**
 * A declared provider whose key is missing.
 */
export interface LlmProviderConfigGap {
  /**
   * The provider name.
   */
  readonly id: LlmStrategyId;
  /**
   * The env var name that should hold its key.
   */
  readonly apiKeyEnv: string;
}

/**
 * What an {@link LlmProviderApiKeyReader} receives.
 */
export interface LlmProviderApiKeyReaderParams<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * The provider name.
   */
  readonly id: LlmStrategyId;
  /**
   * The declared entry (its `apiKeyEnv` names the key).
   */
  readonly entry: LlmExtendedCompletionProviderEntry<X>;
}

/**
 * Reads one provider's key value (from the environment, or a user's stored key). Blank or absent ⇒ a gap.
 */
export type LlmProviderApiKeyReader<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> = (input: LlmProviderApiKeyReaderParams<X>) => Maybe<string>;

/**
 * Config for {@link resolveLlmProviderConfigs}.
 */
export interface ResolveLlmProviderConfigsConfig<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * The effective completion `providers` (`file.providers` — extension-owned entries live apart and are never read).
   */
  readonly providers: Maybe<LlmCompletionProviderEntryMap<X>>;
  /**
   * Reads each provider's key value.
   */
  readonly apiKeyOf: LlmProviderApiKeyReader<X>;
}

/**
 * The result of {@link resolveLlmProviderConfigs}.
 */
export interface LlmProviderConfigResolution<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * The keyed completion providers, in declaration order.
   */
  readonly providers: ReadonlyArray<LlmExtendedProviderConfig<X>>;
  /**
   * The declared completion providers whose key is missing, in declaration order.
   */
  readonly gaps: ReadonlyArray<LlmProviderConfigGap>;
}

/**
 * Resolve the declared completion providers into {@link LlmProviderConfig}s that carry the key value — the BYOK seam:
 * the FILE names the key var; the RESOLVED config carries the value, read by `apiKeyOf` from the environment or from a
 * user's stored key.
 *
 * A provider whose key is blank or absent becomes a gap, never a config: a declared provider is never silently
 * substituted by another. Only completion entries are read (the extension-owned entries live in
 * `file.extensionProviders`). Default instances, base-URL defaults
 * and model pins are the host's (or the adapter's) concern.
 *
 * @param config - The completion providers and the key reader.
 * @returns The keyed providers and the gaps.
 */
export function resolveLlmProviderConfigs<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: ResolveLlmProviderConfigsConfig<X>): LlmProviderConfigResolution<X> {
  const { providers, apiKeyOf } = config;
  const configs: LlmExtendedProviderConfig<X>[] = [];
  const gaps: LlmProviderConfigGap[] = [];

  for (const [id, entry] of Object.entries(providers ?? {})) {
    const apiKey = (apiKeyOf({ id, entry }) ?? '').trim();

    if (apiKey.length === 0) {
      gaps.push({ id, apiKeyEnv: entry.apiKeyEnv });
    } else {
      configs.push({ id, ...entry, apiKey });
    }
  }

  return { providers: configs, gaps };
}
