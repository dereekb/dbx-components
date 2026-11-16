/**
 * The fail-loud **model config parse**: validates a raw model config file (already JSON-decoded by the host) against a
 * {@link LlmModelConfigSchema}. The file is hand-edited, so a typo must redden startup rather than leave a run billing
 * the model the operator thought they had just switched away from.
 *
 * It validates SHAPE, not cross-references: that a slug's `provider` names a declared provider is checked over the
 * MERGED file (`assertLlmModelProviderBindings`), because a host file may legitimately bind a slug to a built-in
 * provider it does not itself declare.
 */

import { type Maybe } from '@dereekb/util';
import { parseLlmModelTierMap } from '../llm.model.tier.parse';
import { isLlmReasoningOffEncoding, isLlmTokenLimitParam, LLM_REASONING_OFF_ENCODINGS, LLM_TOKEN_LIMIT_PARAMS } from '../llm.model.wire';
import { type LlmModelTierKey, type LlmModelTierValue, type LlmStrategyId } from '../llm.value';
import { type LlmCompletionProviderEntryOf, LLM_MODEL_CONFIG_FILE_KEYS, LLM_PROVIDER_IDENTITY_KEYS, type LlmModelConfigBaseTypes, type LlmModelConfigFile, type LlmModelConfigSchema, type LlmModelConfigTypes, type LlmModelProfile, type LlmModelSettingsOf, type LlmProviderEntryOf } from './llm.model.config.schema';

/**
 * Input to {@link assertLlmModelConfigKeys}.
 */
interface AssertLlmModelConfigKeysInput {
  readonly schemaLabel: string;
  readonly label: string;
  readonly entry: Readonly<Record<string, unknown>>;
  readonly retired: ReadonlyMap<string, string>;
  /**
   * The allowed keys; absent ⇒ only the retired keys are checked.
   */
  readonly allowed?: Maybe<ReadonlyArray<string>>;
}

/**
 * Check one object's keys at one level: every RETIRED key throws its remedy first, then any key not allowed throws
 * unknown — so an operator who kept an old key is told what replaced it rather than that it is unknown.
 *
 * @param input - The labels, the entry, the retired keys and the allowed keys.
 * @throws {Error} When the entry carries a retired or an unknown key.
 */
function assertLlmModelConfigKeys(input: AssertLlmModelConfigKeysInput): void {
  const { schemaLabel, label, entry, retired, allowed } = input;
  const keys = Object.keys(entry);

  for (const key of keys) {
    const remedy = retired.get(key);

    if (remedy != null) {
      throw new Error(`${schemaLabel}: ${label} has retired key '${key}'. ${remedy}`);
    }
  }

  if (allowed != null) {
    for (const key of keys) {
      if (!allowed.includes(key)) {
        throw new Error(`${schemaLabel}: ${label} has unknown key '${key}' (allowed: ${allowed.join(', ')}).`);
      }
    }
  }
}

function isLlmModelConfigObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

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
 * Input to {@link parseLlmCompletionProviderEntry}.
 */
interface ParseLlmCompletionProviderEntryInput<X extends LlmModelConfigTypes> {
  readonly schema: LlmModelConfigSchema<X>;
  readonly label: string;
  readonly entry: Readonly<Record<string, unknown>>;
  readonly rawTransport: unknown;
  readonly rawBaseUrl: unknown;
  readonly fields: X['providerFields'];
}

/**
 * The completion arm of {@link parseLlmProviderEntry}: the entry's keys, transport and base URL are already checked.
 *
 * @param input - The schema, the label, the raw entry, its raw transport and base URL, and the extension fields.
 * @returns The parsed completion provider entry.
 * @throws {Error} When `apiKeyEnv` is missing or a completion key names an illegal value.
 */
function parseLlmCompletionProviderEntry<X extends LlmModelConfigTypes>(input: ParseLlmCompletionProviderEntryInput<X>): LlmCompletionProviderEntryOf<X> {
  const { schema, label, entry, rawTransport, rawBaseUrl, fields } = input;
  const schemaLabel = schema.label;
  const rawApiKeyEnv = entry['apiKeyEnv'];

  // REQUIRED, and a blank one is rejected rather than read as absent: a declared provider that silently inherited
  // the default key bills the wrong account.
  if (typeof rawApiKeyEnv !== 'string' || rawApiKeyEnv.trim().length === 0) {
    const patchHint = schema.extension?.parseProviderPatch == null ? '' : ` To extend a built-in provider with ${schema.patchKeysNoun} keys only, carry those keys alone.`;
    throw new Error(`${schemaLabel}: ${label}.apiKeyEnv must name the env var supplying this provider's key (got ${JSON.stringify(rawApiKeyEnv)}). A declared provider is never billed on another provider's key.${patchHint}`);
  }

  const rawReasoningOff = entry['reasoningOff'];

  if (rawReasoningOff !== undefined && !isLlmReasoningOffEncoding(rawReasoningOff)) {
    throw new Error(`${schemaLabel}: ${label}.reasoningOff must be one of ${LLM_REASONING_OFF_ENCODINGS.join(', ')} (got ${JSON.stringify(rawReasoningOff)}).`);
  }

  const rawTokenLimitParam = entry['tokenLimitParam'];

  if (rawTokenLimitParam !== undefined && !isLlmTokenLimitParam(rawTokenLimitParam)) {
    throw new Error(`${schemaLabel}: ${label}.tokenLimitParam must be one of ${LLM_TOKEN_LIMIT_PARAMS.join(', ')} (got ${JSON.stringify(rawTokenLimitParam)}).`);
  }

  const rawUsageAccounting = entry['usageAccounting'];

  if (rawUsageAccounting !== undefined && typeof rawUsageAccounting !== 'boolean') {
    throw new Error(`${schemaLabel}: ${label}.usageAccounting must be a boolean (got ${JSON.stringify(rawUsageAccounting)}).`);
  }

  const rawMetering = entry['metering'];

  if (rawMetering !== undefined && (typeof rawMetering !== 'string' || !schema.meterings.includes(rawMetering))) {
    throw new Error(`${schemaLabel}: ${label}.metering must be one of ${schema.meterings.join(', ')} (got ${JSON.stringify(rawMetering)}).`);
  }

  const rawDecision = entry['decision'];

  if (rawDecision !== undefined && (typeof rawDecision !== 'string' || !schema.decisionRoutes.includes(rawDecision))) {
    throw new Error(`${schemaLabel}: ${label}.decision must be one of ${schema.decisionRoutes.join(', ')} (got ${JSON.stringify(rawDecision)}).`);
  }

  const completionEntry = {
    transport: (rawTransport as Maybe<LlmStrategyId>) ?? schema.defaultTransport,
    ...(rawBaseUrl === undefined ? {} : { baseUrl: (rawBaseUrl as string).trim() }),
    apiKeyEnv: rawApiKeyEnv.trim(),
    ...(rawReasoningOff === undefined ? {} : { reasoningOff: rawReasoningOff }),
    ...(rawTokenLimitParam === undefined ? {} : { tokenLimitParam: rawTokenLimitParam }),
    ...(rawUsageAccounting === undefined ? {} : { usageAccounting: rawUsageAccounting }),
    ...(rawMetering === undefined ? {} : { metering: rawMetering as string }),
    ...(rawDecision === undefined ? {} : { decision: rawDecision as string }),
    ...fields
  };

  return completionEntry as LlmCompletionProviderEntryOf<X>;
}

/**
 * Parse and validate ONE entry of the `providers` block.
 *
 * FAILS LOUD on a retired or unknown key, an unrecognized `transport` / `metering` / `decision` / `reasoningOff` /
 * `tokenLimitParam`, and on a MISSING `apiKeyEnv` — a declared completion provider that silently inherited the default
 * key would bill the wrong account. An entry of a transport the schema's extension owns is parsed whole by the
 * extension.
 *
 * @param config - The label, the raw entry and the schema.
 * @returns The parsed provider entry.
 * @throws {Error} When the entry is not an object, carries a retired / unknown key, or names an illegal value.
 */
export function parseLlmProviderEntry<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: ParseLlmModelConfigEntryConfig<X>): LlmProviderEntryOf<X> {
  const { label, value, schema } = config;
  const schemaLabel = schema.label;

  if (!isLlmModelConfigObject(value)) {
    throw new Error(`${schemaLabel}: ${label} must be a JSON object of { ${schema.providerKeys.join(', ')} }.`);
  }

  const entry = value;
  assertLlmModelConfigKeys({ schemaLabel, label, entry, retired: schema.retiredKeys.provider, allowed: schema.providerKeys });

  const rawTransport = entry['transport'];

  if (rawTransport !== undefined && (typeof rawTransport !== 'string' || !schema.entryTransports.includes(rawTransport))) {
    throw new Error(`${schemaLabel}: ${label}.transport must be one of ${schema.entryTransports.join(', ')} (got ${JSON.stringify(rawTransport)}).`);
  }

  const rawBaseUrl = entry['baseUrl'];

  if (rawBaseUrl !== undefined && (typeof rawBaseUrl !== 'string' || rawBaseUrl.trim().length === 0)) {
    throw new Error(`${schemaLabel}: ${label}.baseUrl must be a non-empty endpoint URL (got ${JSON.stringify(rawBaseUrl)}). Remove the key to use the transport's default.`);
  }

  const extension = schema.extension;
  const fields = (extension?.parseProviderFields?.({ schemaLabel, label, entry }) ?? {}) as X['providerFields'];
  const parseExtensionEntry = rawTransport !== undefined && schema.extensionTransports.includes(rawTransport) ? extension?.parseProviderEntry : undefined;
  let result: LlmProviderEntryOf<X>;

  if (parseExtensionEntry == null) {
    result = parseLlmCompletionProviderEntry({ schema, label, entry, rawTransport, rawBaseUrl, fields });
  } else {
    result = parseExtensionEntry({ schemaLabel, label, entry, transport: rawTransport as LlmStrategyId, baseUrl: rawBaseUrl as Maybe<string>, fields, meterings: schema.meterings });
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
export function parseLlmModelSettings<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: ParseLlmModelConfigEntryConfig<X>): LlmModelSettingsOf<X> {
  const { label, value, schema } = config;
  const schemaLabel = schema.label;

  if (!isLlmModelConfigObject(value)) {
    throw new Error(`${schemaLabel}: ${label} must be a JSON object of { ${schema.modelKeys.join(', ')} }.`);
  }

  const entry = value;
  assertLlmModelConfigKeys({ schemaLabel, label, entry, retired: schema.retiredKeys.model, allowed: schema.modelKeys });

  const rawProvider = entry['provider'];

  // Shape only — that the NAME resolves is a cross-reference checked over the MERGED file, where a binding to a
  // built-in provider this file does not declare is finally visible.
  if (rawProvider !== undefined && (typeof rawProvider !== 'string' || rawProvider.trim().length === 0)) {
    throw new Error(`${schemaLabel}: ${label}.provider must be a declared provider name (got ${JSON.stringify(rawProvider)}). Remove the key to use the default provider.`);
  }

  const rawReasoningOff = entry['reasoningOff'];

  if (rawReasoningOff !== undefined && !isLlmReasoningOffEncoding(rawReasoningOff)) {
    throw new Error(`${schemaLabel}: ${label}.reasoningOff must be one of ${LLM_REASONING_OFF_ENCODINGS.join(', ')} (got ${JSON.stringify(rawReasoningOff)}).`);
  }

  const rawVision = entry['vision'];

  if (rawVision !== undefined && typeof rawVision !== 'boolean') {
    throw new Error(`${schemaLabel}: ${label}.vision must be a boolean (got ${JSON.stringify(rawVision)}).`);
  }

  const rawPromptAddendum = entry['promptAddendum'];

  // A BLANK addendum is REJECTED rather than dropped: an operator who cleared the text but left the key meant to say
  // something to this model. Clearing is removing the key, never an empty string.
  if (rawPromptAddendum !== undefined && (typeof rawPromptAddendum !== 'string' || rawPromptAddendum.trim().length === 0)) {
    throw new Error(`${schemaLabel}: ${label}.promptAddendum must be a non-empty string of prompt text (got ${JSON.stringify(rawPromptAddendum)}). Remove the key to declare no addendum.`);
  }

  const fields = schema.extension?.parseModelFields?.({ schemaLabel, label, entry });

  return {
    ...(rawProvider === undefined ? {} : { provider: (rawProvider as string).trim() }),
    ...(rawReasoningOff === undefined ? {} : { reasoningOff: rawReasoningOff }),
    ...(rawVision === undefined ? {} : { vision: rawVision }),
    ...(rawPromptAddendum === undefined ? {} : { promptAddendum: rawPromptAddendum as string }),
    ...fields
  } as LlmModelSettingsOf<X>;
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

  if (isLlmModelConfigObject(value)) {
    assertLlmModelConfigKeys({ schemaLabel: schema.label, label, entry: value, retired: schema.retiredKeys.profile });
  }

  return { tiers: parseLlmModelTierMap({ label, value }) };
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
 * Whether a raw `providers` entry is a PATCH: an object carrying none of the {@link LLM_PROVIDER_IDENTITY_KEYS}, which
 * therefore extends the base provider of the same name rather than declaring a provider.
 *
 * @param value - The raw entry value.
 * @returns `true` when the entry declares no transport, base URL or key var.
 */
export function isLlmProviderPatchValue(value: unknown): boolean {
  return isLlmModelConfigObject(value) && LLM_PROVIDER_IDENTITY_KEYS.every((key) => value[key] === undefined);
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
 * The parsed `providers` block, split into full entries and patches.
 */
interface LlmModelConfigProvidersParse<X extends LlmModelConfigTypes> {
  readonly providers: Record<LlmStrategyId, LlmProviderEntryOf<X>>;
  readonly providerPatches: Record<LlmStrategyId, X['providerFields']>;
}

/**
 * Parse the raw `providers` block of a file. A patch is split off here so no consumer of the effective file ever meets
 * an identity-less entry.
 *
 * @param input - The raw block (already known to be an object, or absent), the source label and the schema.
 * @returns The full entries and the patches.
 * @throws {Error} When an entry or a patch is malformed.
 */
function parseLlmModelConfigProviders<X extends LlmModelConfigTypes>(input: ParseLlmModelConfigProvidersInput<X>): LlmModelConfigProvidersParse<X> {
  const { rawProviders, source, schema } = input;
  const schemaLabel = schema.label;
  const parseProviderPatch = schema.extension?.parseProviderPatch;
  const providers: Record<LlmStrategyId, LlmProviderEntryOf<X>> = {};
  const providerPatches: Record<LlmStrategyId, X['providerFields']> = {};

  for (const [providerName, rawEntry] of Object.entries(rawProviders ?? {})) {
    const label = `${source} providers['${providerName}']`;

    if (parseProviderPatch != null && isLlmModelConfigObject(rawEntry) && isLlmProviderPatchValue(rawEntry)) {
      assertLlmModelConfigKeys({ schemaLabel, label, entry: rawEntry, retired: schema.retiredKeys.provider });
      providerPatches[providerName] = parseProviderPatch({ schemaLabel, label, entry: rawEntry });
    } else {
      providers[providerName] = parseLlmProviderEntry({ label, value: rawEntry, schema });
    }
  }

  return { providers, providerPatches };
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
 * patches; otherwise it parses as an ordinary entry (and fails on its missing `apiKeyEnv`).
 *
 * @param config - The raw file, its source label and the schema.
 * @returns The validated file.
 * @throws {Error} When the payload does not match the schema.
 */
export function parseLlmModelConfigFile<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: ParseLlmModelConfigFileConfig<X>): LlmModelConfigFile<X> {
  const { raw, source, schema } = config;
  const schemaLabel = schema.label;

  if (!isLlmModelConfigObject(raw)) {
    throw new Error(`${schemaLabel}: ${source} must contain a JSON object.`);
  }

  const obj = raw;
  assertLlmModelConfigKeys({ schemaLabel, label: source, entry: obj, retired: schema.retiredKeys.file, allowed: LLM_MODEL_CONFIG_FILE_KEYS });

  const rawActive = obj['active'];

  if (rawActive !== undefined && rawActive !== null && typeof rawActive !== 'string') {
    throw new Error(`${schemaLabel}: ${source}.active must be a profile-name string.`);
  }

  const rawProfiles = obj['profiles'];

  if (rawProfiles !== undefined && !isLlmModelConfigObject(rawProfiles)) {
    throw new Error(`${schemaLabel}: ${source}.profiles must be a JSON object of { profileName: { tierKey: modelSlug } }.`);
  }

  const rawModels = obj['models'];

  if (rawModels !== undefined && !isLlmModelConfigObject(rawModels)) {
    const modelShape = schema.modelKeys.map((key) => `${key}?`).join(', ');
    throw new Error(`${schemaLabel}: ${source}.models must be a JSON object of { modelSlug: { ${modelShape} } }.`);
  }

  const rawProviders = obj['providers'];

  if (rawProviders !== undefined && !isLlmModelConfigObject(rawProviders)) {
    throw new Error(`${schemaLabel}: ${source}.providers must be a JSON object of { providerName: { transport?, baseUrl?, apiKeyEnv, … } }.`);
  }

  const { providers, providerPatches } = parseLlmModelConfigProviders({ rawProviders, source, schema });

  const models: Record<string, LlmModelSettingsOf<X>> = {};

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

  const active = typeof rawActive === 'string' ? rawActive.trim() : undefined;
  const hasPatches = Object.keys(providerPatches).length > 0;

  return {
    ...(active == null ? {} : { active }),
    ...(rawProviders == null || (Object.keys(providers).length === 0 && hasPatches) ? {} : { providers }),
    ...(hasPatches ? { providerPatches } : {}),
    ...(rawProfiles == null ? {} : { profiles }),
    ...(rawModels == null ? {} : { models }),
    ...(obj['notes'] === undefined ? {} : { notes: obj['notes'] }),
    ...(obj['$schema'] === undefined ? {} : { $schema: obj['$schema'] })
  };
}
