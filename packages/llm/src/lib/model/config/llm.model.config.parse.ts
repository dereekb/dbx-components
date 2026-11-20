/**
 * The fail-loud **model config parse**: validates a raw model config file (already JSON-decoded by the host) against a
 * {@link LlmModelConfigSchema}. The file is hand-edited, so a typo must redden startup rather than leave a run billing
 * the model the operator thought they had just switched away from.
 *
 * It validates SHAPE, not cross-references: that a slug's `provider` names a declared provider is checked over the
 * MERGED file (`assertLlmModelProviderBindings`), because a host file may legitimately bind a slug to a built-in
 * provider it does not itself declare.
 */

import { filterUndefinedValues, isPlainObject, type Maybe } from '@dereekb/util';
import { assertLlmModelConfigKeys, parseLlmModelConfigFields } from '../llm.model.field';
import { parseLlmModelTierMap } from '../llm.model.tier.parse';
import { type LlmModelTierKey, type LlmModelTierValue, type LlmStrategyId } from '../llm.value';
import {
  LLM_MODEL_CONFIG_FILE_KEYS,
  LLM_MODEL_SETTINGS_FIELD_RULES,
  LLM_MODEL_SETTINGS_KEYS,
  LLM_PROVIDER_ENTRY_KEYS,
  LLM_PROVIDER_IDENTITY_KEYS,
  LLM_PROVIDER_ROUTING_KEYS,
  type LlmExtendedCompletionProviderEntry,
  type LlmModelConfigBaseTypes,
  type LlmModelConfigFile,
  type LlmModelConfigFileFields,
  type LlmModelConfigFileJson,
  type LlmModelConfigFileKey,
  type LlmModelConfigSchema,
  type LlmModelConfigTypes,
  type LlmModelProfile,
  type LlmExtendedModelSettings,
  type LlmParsedProviderEntry
} from './llm.model.config.schema';
import { llmModelSettingsType } from './llm.model.config.type';

/**
 * Config for the per-entry parsers ({@link parseLlmProviderEntry}, {@link parseLlmModelSettings},
 * {@link parseLlmModelProfile}).
 */
export interface ParseLlmModelConfigEntryConfig<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * The label error messages name (`models.json providers['local']`).
   */
  readonly label: string;
  /**
   * The raw entry value.
   */
  readonly value: unknown;
  /**
   * The schema to validate against.
   */
  readonly schema: LlmModelConfigSchema<X>;
}

/**
 * Parse and validate ONE entry of the `providers` block.
 *
 * FAILS LOUD on a retired or unknown key, an unrecognized `transport` / `metering` / `decision` / `reasoningOff` /
 * `tokenLimitParam`, and on a MISSING `apiKeyEnv` — a declared completion provider that silently inherited the default
 * key would bill the wrong account. An entry of a transport the schema's extension owns is parsed whole by the
 * extension.
 *
 * Checks run in a fixed order, and the first failure is reported: `transport`, `baseUrl`, the extension's provider
 * fields, then the completion keys in {@link LLM_PROVIDER_ENTRY_KEYS} order.
 *
 * @param config - The label, the raw entry and the schema.
 * @returns The parsed entry, tagged `completion` or `extension`.
 * @throws {Error} When the entry is not an object, carries a retired / unknown key, or names an illegal value.
 */
export function parseLlmProviderEntry<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: ParseLlmModelConfigEntryConfig<X>): LlmParsedProviderEntry<X> {
  const { label, value, schema } = config;
  const schemaLabel = schema.label;

  if (!isPlainObject(value)) {
    throw new Error(`${schemaLabel}: ${label} must be a JSON object of { ${schema.providerKeys.join(', ')} }.`);
  }

  const entry = value;
  assertLlmModelConfigKeys({ schemaLabel, label, entry, retired: schema.retiredKeys.provider, allowed: schema.providerKeys });

  const routing = parseLlmModelConfigFields({ schemaLabel, label, value: entry, type: schema.providerEntryBaseType, keys: LLM_PROVIDER_ROUTING_KEYS, rules: schema.providerEntryBaseRules });
  const extension = schema.extension;
  const fields: Partial<X['providerFields']> = extension?.parseProviderFields?.({ schemaLabel, label, entry }) ?? {};
  const transport = routing.transport;
  const parseExtensionEntry = transport != null && schema.extensionTransports.includes(transport) ? extension?.parseProviderEntry : undefined;
  let result: LlmParsedProviderEntry<X>;

  if (parseExtensionEntry != null && transport != null) {
    result = { kind: 'extension', entry: parseExtensionEntry({ schemaLabel, label, entry, transport, baseUrl: routing.baseUrl, fields, meterings: schema.meterings }) };
  } else {
    const checked = parseLlmModelConfigFields({ schemaLabel, label, value: entry, type: schema.completionProviderEntryType, keys: LLM_PROVIDER_ENTRY_KEYS, rules: schema.completionProviderEntryRules });
    const { baseUrl, reasoningOff, tokenLimitParam, usageAccounting, metering, decision } = checked;
    // Base keys in LLM_PROVIDER_ENTRY_KEYS order, then the extension's — the pinned key order of a parsed entry.
    const completionEntry: LlmExtendedCompletionProviderEntry<X> = {
      transport: checked.transport ?? schema.defaultTransport,
      ...(baseUrl == null ? {} : { baseUrl: baseUrl.trim() }),
      apiKeyEnv: checked.apiKeyEnv.trim(),
      ...(reasoningOff == null ? {} : { reasoningOff }),
      ...(tokenLimitParam == null ? {} : { tokenLimitParam }),
      ...(usageAccounting == null ? {} : { usageAccounting }),
      ...(metering == null ? {} : { metering }),
      ...(decision == null ? {} : { decision }),
      ...fields
    };
    result = { kind: 'completion', entry: completionEntry };
  }

  return result;
}

/**
 * Parse and validate ONE entry of the `models` block (the per-slug facts).
 *
 * FAILS LOUD on a retired or unknown key or an illegal value — an operator who wrote `"minimal"` (the wire value)
 * instead of `"effort-minimal"` (the encoding name) meant to stop a `400`, and a silently ignored entry leaves them
 * staring at the same `400` with the file that should have fixed it open in front of them.
 *
 * @param config - The label, the raw entry and the schema.
 * @returns The parsed settings.
 * @throws {Error} When the entry is not an object, carries a retired / unknown key, or names an illegal value.
 */
export function parseLlmModelSettings<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: ParseLlmModelConfigEntryConfig<X>): LlmExtendedModelSettings<X> {
  const { label, value, schema } = config;
  const schemaLabel = schema.label;

  if (!isPlainObject(value)) {
    throw new Error(`${schemaLabel}: ${label} must be a JSON object of { ${schema.modelKeys.join(', ')} }.`);
  }

  const entry = value;
  assertLlmModelConfigKeys({ schemaLabel, label, entry, retired: schema.retiredKeys.model, allowed: schema.modelKeys });

  // `provider` is shape only — that the NAME resolves is a cross-reference checked over the MERGED file, where a
  // binding to a built-in provider this file does not declare is finally visible. A BLANK `promptAddendum` is REJECTED
  // rather than dropped: an operator who cleared the text but left the key meant to say something to this model.
  const checked = parseLlmModelConfigFields({ schemaLabel, label, value: entry, type: llmModelSettingsType, keys: LLM_MODEL_SETTINGS_KEYS, rules: LLM_MODEL_SETTINGS_FIELD_RULES });
  const { provider, reasoningOff, vision, promptAddendum } = checked;
  const fields: Partial<X['modelFields']> = schema.extension?.parseModelFields?.({ schemaLabel, label, entry }) ?? {};
  const settings: LlmExtendedModelSettings<X> = {
    ...(provider == null ? {} : { provider: provider.trim() }),
    ...(reasoningOff == null ? {} : { reasoningOff }),
    ...(vision == null ? {} : { vision }),
    // Never trimmed: the addendum is prompt text, byte for byte.
    ...(promptAddendum == null ? {} : { promptAddendum }),
    ...fields
  };

  return settings;
}

/**
 * Parse and validate ONE profile object — a flat tier map on disk.
 *
 * FAILS LOUD on a RETIRED profile key: every other key of a profile is a tier, so a leftover key would otherwise
 * silently mint a tier named after it.
 *
 * @param config - The label, the raw profile and the schema.
 * @returns The parsed profile.
 * @throws {Error} When the profile carries a retired key, or a tier value is malformed.
 */
export function parseLlmModelProfile<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: ParseLlmModelConfigEntryConfig<X>): LlmModelProfile {
  const { label, value, schema } = config;

  if (isPlainObject(value)) {
    assertLlmModelConfigKeys({ schemaLabel: schema.label, label, entry: value, retired: schema.retiredKeys.profile });
  }

  return { tiers: parseLlmModelTierMap({ label, value, schemaLabel: schema.label }) };
}

/**
 * Flatten a parsed {@link LlmModelProfile} back to its on-disk shape — the bare tier map. The parsed shape wraps the
 * tiers, so a host that WRITES the file must round-trip through here: serializing the parsed object directly would
 * emit a nested `tiers` key the parse rejects.
 *
 * @param profile - The parsed profile.
 * @returns The flat on-disk object.
 */
export function flattenLlmModelProfile(profile: LlmModelProfile): Readonly<Record<LlmModelTierKey, Maybe<LlmModelTierValue>>> {
  return { ...profile.tiers };
}

/**
 * Flatten a parsed {@link LlmModelConfigFile} back to its ON-DISK shape — the one object a writer serializes.
 *
 * - Top-level keys in {@link LLM_MODEL_CONFIG_FILE_KEYS} order (the prose before the data, the endpoints before the
 *   maps that use them, the per-slug appendix last), every one carried: a key the writer forgot would delete it from
 *   disk the next time any command wrote the file.
 * - `providers` is ONE block again: the completion entries, then the extension-owned entries, then the patches.
 * - Profiles are flattened ({@link flattenLlmModelProfile}).
 * - `$schema` / `notes` are kept unless `undefined`; `active` and the maps are dropped when absent.
 *
 * Pure — a browser host (a stored settings document) can use it as well as the node writer.
 *
 * @param file - The parsed file.
 * @returns The plain on-disk object.
 */
export function flattenLlmModelConfigFile<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(file: LlmModelConfigFile<X>): LlmModelConfigFileJson<X> {
  const { providers, extensionProviders, providerPatches, profiles } = file;
  const onDisk: { readonly [K in LlmModelConfigFileKey]: LlmModelConfigFileJson<X>[K] } = {
    $schema: file.$schema,
    notes: file.notes,
    active: file.active ?? undefined,
    providers: providers == null && extensionProviders == null && providerPatches == null ? undefined : { ...providers, ...extensionProviders, ...providerPatches },
    profiles: profiles == null ? undefined : Object.fromEntries(Object.entries(profiles).map(([name, profile]) => [name, flattenLlmModelProfile(profile)])),
    models: file.models ?? undefined
  };

  return filterUndefinedValues(onDisk);
}

/**
 * Whether a raw `providers` entry is a PATCH: an object carrying none of the {@link LLM_PROVIDER_IDENTITY_KEYS}, which
 * therefore extends the base provider of the same name rather than declaring a provider.
 *
 * @param value - The raw entry value.
 * @returns `true` when the entry declares no transport, base URL or key var.
 */
export function isLlmProviderPatchValue(value: unknown): boolean {
  return isPlainObject(value) && LLM_PROVIDER_IDENTITY_KEYS.every((key) => value[key] === undefined);
}

/**
 * Input to {@link parseLlmModelConfigProviders}.
 */
interface ParseLlmModelConfigProvidersInput<X extends LlmModelConfigTypes> {
  readonly rawProviders: Maybe<Readonly<Record<string, unknown>>>;
  readonly source: string;
  readonly schema: LlmModelConfigSchema<X>;
}

/**
 * The parsed `providers` block, split into completion entries, extension-owned entries and patches.
 */
interface LlmModelConfigProvidersParse<X extends LlmModelConfigTypes> {
  readonly providers: Record<LlmStrategyId, LlmExtendedCompletionProviderEntry<X>>;
  readonly extensionProviders: Record<LlmStrategyId, X['extensionProviderEntry']>;
  readonly providerPatches: Record<LlmStrategyId, Partial<X['providerFields']>>;
}

/**
 * Parse the raw `providers` block of a file. A patch and an extension-owned entry are split off here, so no consumer
 * of the effective file ever meets an identity-less entry, and no completion reader meets an entry it cannot serve.
 *
 * @param input - The raw block (already known to be an object, or absent), the source label and the schema.
 * @returns The completion entries, the extension-owned entries and the patches.
 * @throws {Error} When an entry or a patch is malformed.
 */
function parseLlmModelConfigProviders<X extends LlmModelConfigTypes>(input: ParseLlmModelConfigProvidersInput<X>): LlmModelConfigProvidersParse<X> {
  const { rawProviders, source, schema } = input;
  const schemaLabel = schema.label;
  const parseProviderPatch = schema.extension?.parseProviderPatch;
  const providers: Record<LlmStrategyId, LlmExtendedCompletionProviderEntry<X>> = {};
  const extensionProviders: Record<LlmStrategyId, X['extensionProviderEntry']> = {};
  const providerPatches: Record<LlmStrategyId, Partial<X['providerFields']>> = {};

  for (const [providerName, rawEntry] of Object.entries(rawProviders ?? {})) {
    const label = `${source} providers['${providerName}']`;

    if (parseProviderPatch != null && isPlainObject(rawEntry) && isLlmProviderPatchValue(rawEntry)) {
      assertLlmModelConfigKeys({ schemaLabel, label, entry: rawEntry, retired: schema.retiredKeys.provider });
      providerPatches[providerName] = parseProviderPatch({ schemaLabel, label, entry: rawEntry });
    } else {
      const parsed = parseLlmProviderEntry({ label, value: rawEntry, schema });

      if (parsed.kind === 'completion') {
        providers[providerName] = parsed.entry;
      } else {
        extensionProviders[providerName] = parsed.entry;
      }
    }
  }

  return { providers, extensionProviders, providerPatches };
}

/**
 * Config for {@link parseLlmModelConfigFile}.
 */
export interface ParseLlmModelConfigFileConfig<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * The raw, JSON-decoded file.
   */
  readonly raw: unknown;
  /**
   * The file path / label error messages name.
   */
  readonly source: string;
  /**
   * The schema to validate against.
   */
  readonly schema: LlmModelConfigSchema<X>;
}

/**
 * Parse and validate a raw model config file. FAIL-LOUD on a non-object top level, a retired or unknown top-level key,
 * a non-object `providers` / `profiles` / `models`, a non-string `active`, or any malformed provider, per-slug or tier
 * entry.
 *
 * A `providers` entry with no identity key becomes a PATCH (`providerPatches`) when the schema's extension parses
 * patches; otherwise it parses as an ordinary entry (and fails on its missing `apiKeyEnv`). An entry of a transport the
 * extension owns lands in `extensionProviders`, never in `providers`.
 *
 * The result's keys follow {@link LLM_MODEL_CONFIG_FILE_KEYS}, with the in-memory keys after `providers`; each map is
 * present only when it has entries, except that a declared empty `providers: {}` round-trips.
 *
 * @param config - The raw file, its source label and the schema.
 * @returns The validated file.
 * @throws {Error} When the payload does not match the schema.
 */
export function parseLlmModelConfigFile<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: ParseLlmModelConfigFileConfig<X>): LlmModelConfigFile<X> {
  const { raw, source, schema } = config;
  const schemaLabel = schema.label;

  if (!isPlainObject(raw)) {
    throw new Error(`${schemaLabel}: ${source} must contain a JSON object.`);
  }

  const obj = raw;
  assertLlmModelConfigKeys({ schemaLabel, label: source, entry: obj, retired: schema.retiredKeys.file, allowed: LLM_MODEL_CONFIG_FILE_KEYS });

  const rawActive = obj['active'];

  if (rawActive !== undefined && rawActive !== null && typeof rawActive !== 'string') {
    throw new Error(`${schemaLabel}: ${source}.active must be a profile-name string.`);
  }

  const rawProfiles = obj['profiles'];

  if (rawProfiles !== undefined && !isPlainObject(rawProfiles)) {
    throw new Error(`${schemaLabel}: ${source}.profiles must be a JSON object of { profileName: { tierKey: modelSlug } }.`);
  }

  const rawModels = obj['models'];

  if (rawModels !== undefined && !isPlainObject(rawModels)) {
    const modelShape = schema.modelKeys.map((key) => `${key}?`).join(', ');
    throw new Error(`${schemaLabel}: ${source}.models must be a JSON object of { modelSlug: { ${modelShape} } }.`);
  }

  const rawProviders = obj['providers'];

  if (rawProviders !== undefined && !isPlainObject(rawProviders)) {
    throw new Error(`${schemaLabel}: ${source}.providers must be a JSON object of { providerName: { transport?, baseUrl?, apiKeyEnv, … } }.`);
  }

  const { providers, extensionProviders, providerPatches } = parseLlmModelConfigProviders({ rawProviders, source, schema });

  const models: Record<string, LlmExtendedModelSettings<X>> = {};

  if (rawModels != null) {
    for (const [model, rawEntry] of Object.entries(rawModels)) {
      models[model] = parseLlmModelSettings({ label: `${source} models['${model}']`, value: rawEntry, schema });
    }
  }

  const profiles: Record<string, LlmModelProfile> = {};

  if (rawProfiles != null) {
    for (const [profileName, rawEntry] of Object.entries(rawProfiles)) {
      profiles[profileName] = parseLlmModelProfile({ label: `${source} profiles['${profileName}']`, value: rawEntry, schema });
    }
  }

  const hasCompletion = Object.keys(providers).length > 0;
  const hasExtension = Object.keys(extensionProviders).length > 0;
  const hasPatches = Object.keys(providerPatches).length > 0;
  const fields: LlmModelConfigFileFields<X> = {
    $schema: obj['$schema'],
    notes: obj['notes'],
    active: typeof rawActive === 'string' ? rawActive.trim() : undefined,
    // A declared EMPTY block round-trips; a block of only patches / owned entries yields no completion map.
    providers: rawProviders != null && (hasCompletion || (!hasExtension && !hasPatches)) ? providers : undefined,
    extensionProviders: hasExtension ? extensionProviders : undefined,
    providerPatches: hasPatches ? providerPatches : undefined,
    profiles: rawProfiles == null ? undefined : profiles,
    models: rawModels == null ? undefined : models
  };

  return filterUndefinedValues(fields);
}
