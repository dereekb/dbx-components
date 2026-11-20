/**
 * The **model config** vocabulary — the declaration a host keeps (usually a `models.json` file) that says which models
 * it runs and which backend serves each one.
 *
 * A tier map answers "which slug does `fast` mean"; a PROFILE answers "which whole set of slugs are we on"; the
 * `providers` block declares named backends (transport + endpoint + the env var NAME of its key — the file holds no
 * secrets); the per-slug facts (`models`) hold however a slug was selected. Precedence, widest → narrowest: a host's
 * per-run override > the file's `active` > the host's tier base.
 *
 * The library reads no environment and no file. A host parses its JSON with `parseLlmModelConfigFile`, lays it over
 * its built-ins with `overlayLlmModelConfigFile`, and resolves from the result.
 *
 * The {@link LlmModelConfigSchema} carries the host-supplied parts: the legal transports, metering sources and decision
 * routes, the error label, retired keys, and one {@link LlmModelConfigExtension} — the seam through which a host adds
 * provider / model keys, provider kinds that serve no completions, and patch entries.
 */

import { type ArktypeFieldRule, type ArktypeFieldRules } from '@dereekb/model';
import { type Maybe, unique, type WebsiteUrl } from '@dereekb/util';
import { type LlmProviderStatusProviderId } from '../../strategy/llm.provider.status';
import { type LlmPartialModelTierMap } from '../llm.model.tier';
import { LLM_REASONING_OFF_ENCODINGS, LLM_TOKEN_LIMIT_PARAMS } from '../llm.model.wire';
import { type LlmModelSlugMap, type LlmModelTierKey, type LlmModelTierValue, type LlmStrategyId } from '../llm.value';
import { type LlmModelConfigEntryTypes, type llmCompletionProviderEntryType, type llmModelSettingsType, type llmProviderEntryBaseType, makeLlmModelConfigEntryTypes } from './llm.model.config.type';

// MARK: Constants
/**
 * The label every model config error message is prefixed with when the schema sets none.
 */
export const DEFAULT_LLM_MODEL_CONFIG_LABEL = 'llm models';

/**
 * The source name (the file name) an error message names when the caller passes none.
 */
export const DEFAULT_LLM_MODEL_CONFIG_SOURCE = 'models.json';

/**
 * The value a provider's `metering` / `decision` key uses to say "this provider has no such facet" (meters nothing /
 * serves no decisions). Always legal, and always listed last in an error message.
 */
export const LLM_PROVIDER_FACET_NONE = 'none';

/**
 * The top-level keys a model config file may carry, in THE one order: the parse's allowed list (an unknown key fails
 * loud), the merge's output order and the on-disk order a writer emits (`flattenLlmModelConfigFile`) — the prose
 * before the data, the endpoints before the maps that use them, the per-slug appendix last.
 *
 * The in-memory-only keys of a parsed file (`extensionProviders`, `providerPatches`) are not listed: they are never
 * on-disk keys.
 */
export const LLM_MODEL_CONFIG_FILE_KEYS = ['$schema', 'notes', 'active', 'providers', 'profiles', 'models'] as const satisfies ReadonlyArray<keyof LlmModelConfigFile>;

/**
 * One on-disk top-level key of a model config file.
 */
export type LlmModelConfigFileKey = (typeof LLM_MODEL_CONFIG_FILE_KEYS)[number];

/**
 * The keys a completion provider entry may carry, in canonical (output and message) order; an extension appends its
 * own ({@link LlmModelConfigSchema.providerKeys}).
 */
export const LLM_PROVIDER_ENTRY_KEYS = ['transport', 'baseUrl', 'apiKeyEnv', 'reasoningOff', 'tokenLimitParam', 'usageAccounting', 'metering', 'decision'] as const satisfies ReadonlyArray<keyof LlmCompletionProviderEntry>;

/**
 * The keys that say WHICH backend and account an entry is. An entry carrying none of them is a PATCH
 * ({@link isLlmProviderPatchValue}) when the schema's extension parses patches.
 */
export const LLM_PROVIDER_IDENTITY_KEYS = ['transport', 'baseUrl', 'apiKeyEnv'] as const satisfies ReadonlyArray<keyof LlmProviderEntryBase>;

/**
 * The keys every entry is checked on before it is routed to the completion or the extension parse.
 */
export const LLM_PROVIDER_ROUTING_KEYS = ['transport', 'baseUrl'] as const satisfies ReadonlyArray<keyof LlmProviderEntryBase>;

/**
 * The keys a per-slug `models` entry may carry, in canonical order; an extension appends its own
 * ({@link LlmModelConfigSchema.modelKeys}).
 */
export const LLM_MODEL_SETTINGS_KEYS = ['provider', 'reasoningOff', 'vision', 'promptAddendum'] as const satisfies ReadonlyArray<keyof LlmModelSettings>;

// MARK: Entries
/**
 * What every `providers` entry carries, whichever kind it is: `{ transport, baseUrl?, apiKeyEnv? }`. Derived from
 * {@link llmProviderEntryBaseType}.
 */
export interface LlmProviderEntryBase extends Readonly<typeof llmProviderEntryBaseType.infer> {}

/**
 * ONE declared completion provider — a NAMED, separately-configured backend instance. Several may share one transport;
 * that is the point (a LAN-served local model beside a remote gateway, two keys against one gateway). `apiKeyEnv` is
 * REQUIRED here. Derived from {@link llmCompletionProviderEntryType}.
 *
 * A binding belongs on the SLUG ({@link LlmModelSettings.provider}), not on a profile: which key may bill a slug is a
 * fact about the model (a free slug may be entitled on only one account) and must hold however the slug was selected.
 */
export interface LlmCompletionProviderEntry extends Readonly<typeof llmCompletionProviderEntryType.infer> {}

/**
 * The per-SLUG facts of a `models` entry. They apply to a slug however it was selected, so they are not scoped to (or
 * overridden by) the active profile. Derived from {@link llmModelSettingsType}.
 */
export interface LlmModelSettings extends Readonly<typeof llmModelSettingsType.infer> {}

/**
 * ONE named profile: the complete tier map it declares. The on-disk shape is FLAT (`{ "fast": "…", "strong": "…" }`);
 * the parsed shape wraps the tiers so nothing downstream has to remember which keys are tiers. A writer flattens it
 * back with `flattenLlmModelProfile`.
 */
export interface LlmModelProfile {
  /**
   * The tier map the profile declares.
   */
  readonly tiers: LlmPartialModelTierMap;
}

// MARK: Extension types
/**
 * The shapes a host's {@link LlmModelConfigExtension} adds — the one type argument (`X`) every model config type and
 * function carries.
 */
export interface LlmModelConfigTypes {
  /**
   * What the extension adds to every provider entry (and what a patch carries).
   */
  readonly providerFields: object;
  /**
   * The parsed entry of a provider whose transport the extension owns.
   */
  readonly extensionProviderEntry: LlmProviderEntryBase;
  /**
   * What the extension adds to every `models` entry.
   */
  readonly modelFields: object;
}

/**
 * The types of a schema with no extension.
 */
export interface LlmModelConfigBaseTypes extends LlmModelConfigTypes {
  readonly extensionProviderEntry: never;
}

/**
 * A completion provider entry with the extension's provider fields. The extension fields are `Partial`: they are
 * optional on disk by nature (a host never owns every provider entry), and a library-built entry (an env default)
 * carries none of them.
 */
export type LlmExtendedCompletionProviderEntry<X extends LlmModelConfigTypes> = LlmCompletionProviderEntry & Partial<X['providerFields']>;

/**
 * A per-slug `models` entry with the extension's model fields (`Partial`, as for {@link LlmExtendedCompletionProviderEntry}).
 */
export type LlmExtendedModelSettings<X extends LlmModelConfigTypes> = LlmModelSettings & Partial<X['modelFields']>;

/**
 * The completion `providers`, keyed by provider name.
 */
export type LlmCompletionProviderEntryMap<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> = Readonly<Record<LlmStrategyId, LlmExtendedCompletionProviderEntry<X>>>;

/**
 * The entries of the transports the extension owns, keyed by provider name.
 */
export type LlmExtensionProviderEntryMap<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> = Readonly<Record<LlmStrategyId, X['extensionProviderEntry']>>;

/**
 * The provider PATCHES, keyed by the name of the provider each extends.
 */
export type LlmProviderPatchMap<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> = Readonly<Record<LlmStrategyId, Partial<X['providerFields']>>>;

/**
 * The `models` block, keyed by model slug.
 */
export type LlmModelSettingsMap<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> = LlmModelSlugMap<LlmExtendedModelSettings<X>>;

/**
 * One parsed `providers` entry, tagged with its kind so a caller routes it without re-checking the transport.
 */
export type LlmParsedProviderEntry<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> = { readonly kind: 'completion'; readonly entry: LlmExtendedCompletionProviderEntry<X> } | { readonly kind: 'extension'; readonly entry: X['extensionProviderEntry'] };

/**
 * The parsed shape of a model config file.
 */
export interface LlmModelConfigFile<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * WHICH profile is live: a name in {@link profiles}, or an off value (`off` / `none`, any case — `LLM_OFF_VALUES`),
   * blank or absent for none. A host's per-run override wins over it.
   */
  readonly active?: string;
  /**
   * The declared COMPLETION providers, keyed by name — the only providers a completion reader may mint a strategy for.
   */
  readonly providers?: LlmCompletionProviderEntryMap<X>;
  /**
   * The declared entries of the transports the extension owns (providers that serve no completions), keyed by name.
   * Split off the on-disk `providers` block at parse time; a name never lives in both maps. A writer folds them back
   * into `providers` after the completion entries.
   */
  readonly extensionProviders?: LlmExtensionProviderEntryMap<X>;
  /**
   * The named profiles, each a complete tier map for one cost posture.
   */
  readonly profiles?: Readonly<Record<string, LlmModelProfile>>;
  /**
   * The per-slug facts, keyed by model id.
   */
  readonly models?: LlmModelSettingsMap<X>;
  /**
   * A free-form operator note. Never read; carried so a host that rewrites the file does not delete it.
   */
  readonly notes?: unknown;
  /**
   * The editor-tooling schema ref. Never read; carried so a host that rewrites the file does not delete it.
   */
  readonly $schema?: unknown;
  /**
   * The PATCH entries of the on-disk `providers` block (an extension's fields declared alone). Present only on a
   * parsed host file: the merge lays each over the base provider of the same name and the merged file carries none. A
   * writer folds them back into `providers`; this is never an on-disk key.
   */
  readonly providerPatches?: LlmProviderPatchMap<X>;
}

/**
 * Every key of a parsed {@link LlmModelConfigFile}, each REQUIRED (its value may be `undefined`) — what a parse or
 * merge fills in before dropping the `undefined` keys, so a key added to the file type fails to compile until every
 * builder handles it. The literal's key order is the output order.
 */
export type LlmModelConfigFileFields<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> = { readonly [K in LlmModelConfigFileKey | 'extensionProviders' | 'providerPatches']: LlmModelConfigFile<X>[K] };

/**
 * The ON-DISK shape of a model config file (`flattenLlmModelConfigFile`): profiles flat, and ONE `providers` block
 * holding completion entries, extension-owned entries and patches alike.
 */
export interface LlmModelConfigFileJson<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  readonly $schema?: unknown;
  readonly notes?: unknown;
  readonly active?: string;
  readonly providers?: Readonly<Record<LlmStrategyId, LlmExtendedCompletionProviderEntry<X> | X['extensionProviderEntry'] | Partial<X['providerFields']>>>;
  readonly profiles?: Readonly<Record<string, Readonly<Record<LlmModelTierKey, Maybe<LlmModelTierValue>>>>>;
  readonly models?: LlmModelSettingsMap<X>;
}

// MARK: Schema
/**
 * Retired keys per level: key → the remedy text appended to its error. A retired key fails with its remedy before
 * the unknown-key check, so an operator who kept an old key is told what replaced it.
 */
export interface LlmModelConfigRetiredKeys {
  readonly file?: Maybe<ReadonlyMap<string, string>>;
  readonly provider?: Maybe<ReadonlyMap<string, string>>;
  readonly model?: Maybe<ReadonlyMap<string, string>>;
  readonly profile?: Maybe<ReadonlyMap<string, string>>;
}

/**
 * {@link LlmModelConfigRetiredKeys} normalized: every level present (an empty map when undeclared).
 */
export interface LlmModelConfigSchemaRetiredKeys {
  readonly file: ReadonlyMap<string, string>;
  readonly provider: ReadonlyMap<string, string>;
  readonly model: ReadonlyMap<string, string>;
  readonly profile: ReadonlyMap<string, string>;
}

/**
 * What an extension parser receives.
 */
export interface LlmModelConfigExtensionParams {
  /**
   * The schema label; prefix every message with `${schemaLabel}: `.
   */
  readonly schemaLabel: string;
  /**
   * The entry's label, e.g. `models.json providers['box']`.
   */
  readonly label: string;
  /**
   * The raw entry object (already known to be an object).
   */
  readonly entry: Readonly<Record<string, unknown>>;
}

/**
 * What {@link LlmModelConfigExtension.parseProviderEntry} receives for an entry of a transport the extension owns.
 */
export interface LlmModelConfigExtensionEntryParams<F extends object = object> extends LlmModelConfigExtensionParams {
  /**
   * The entry's transport (one of the extension's).
   */
  readonly transport: LlmStrategyId;
  /**
   * The raw `baseUrl` — already shape-checked (absent or non-blank), untrimmed.
   */
  readonly baseUrl: Maybe<WebsiteUrl>;
  /**
   * What {@link LlmModelConfigExtension.parseProviderFields} returned for this entry (`{}` without that parser).
   */
  readonly fields: Partial<F>;
  /**
   * The schema's full metering list, for a `metering` check.
   */
  readonly meterings: ReadonlyArray<LlmProviderStatusProviderId>;
}

/**
 * The extension seam: what a host adds to the model config.
 *
 * A provider entry naming an owned transport serves no completions — no completion reader mints a strategy for it,
 * and a slug may bind it only when {@link isProviderBindable} says so. A parsed file keeps those entries apart
 * ({@link LlmModelConfigFile.extensionProviders}). A PATCH is a `providers` entry carrying none of
 * {@link LLM_PROVIDER_IDENTITY_KEYS}; it extends the BASE provider of the same name at overlay. Patch fields never
 * change which account bills, which is why they alone may merge into a base entry instead of replacing it.
 */
export interface LlmModelConfigExtension<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * Extra keys every provider entry may carry.
   */
  readonly providerKeys?: Maybe<ReadonlyArray<string>>;
  /**
   * Parses the extra provider keys of any entry. Required with {@link providerKeys}.
   */
  readonly parseProviderFields?: Maybe<(input: LlmModelConfigExtensionParams) => Partial<X['providerFields']>>;
  /**
   * Transports the extension owns: their entries serve no completions.
   */
  readonly providerTransports?: Maybe<ReadonlyArray<LlmStrategyId>>;
  /**
   * Parses an entry of an owned transport, whole. Required with {@link providerTransports}.
   */
  readonly parseProviderEntry?: Maybe<(input: LlmModelConfigExtensionEntryParams<X['providerFields']>) => X['extensionProviderEntry']>;
  /**
   * Whether a slug may bind an owned-transport entry (e.g. as an entitlement read by a non-completion surface).
   * Absent ⇒ never.
   */
  readonly isProviderBindable?: Maybe<(entry: X['extensionProviderEntry']) => boolean>;
  /**
   * Parses a patch entry. Absent ⇒ an identity-less entry parses as an ordinary entry (and fails on `apiKeyEnv`).
   */
  readonly parseProviderPatch?: Maybe<(input: LlmModelConfigExtensionParams) => Partial<X['providerFields']>>;
  /**
   * What a patch's keys are called in messages (`media route` ⇒ "carries only media route keys"). Default `patch`.
   */
  readonly patchKeysNoun?: Maybe<string>;
  /**
   * Extra metering sources, appended to the schema's.
   */
  readonly meterings?: Maybe<ReadonlyArray<LlmProviderStatusProviderId>>;
  /**
   * Extra keys every `models` entry may carry.
   */
  readonly modelKeys?: Maybe<ReadonlyArray<string>>;
  /**
   * Parses the extra model keys. Required with {@link modelKeys}.
   */
  readonly parseModelFields?: Maybe<(input: LlmModelConfigExtensionParams) => Partial<X['modelFields']>>;
}

/**
 * Config for {@link makeLlmModelConfigSchema}.
 */
export interface LlmModelConfigSchemaConfig<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * The error-message prefix. Default {@link DEFAULT_LLM_MODEL_CONFIG_LABEL}.
   */
  readonly label?: Maybe<string>;
  /**
   * The completion transports a provider may name. At least one.
   */
  readonly transports: ReadonlyArray<LlmStrategyId>;
  /**
   * The transport of an entry that names none. Default: the first of {@link transports}.
   */
  readonly defaultTransport?: Maybe<LlmStrategyId>;
  /**
   * The legal `metering` values (`'none'` is always added, last).
   */
  readonly meterings?: Maybe<ReadonlyArray<LlmProviderStatusProviderId>>;
  /**
   * The legal `decision` values (`'none'` is always added, last).
   */
  readonly decisionRoutes?: Maybe<ReadonlyArray<LlmStrategyId>>;
  /**
   * Provider names a slug may bind without the file declaring them — the host's default instances, minted from its
   * own environment.
   */
  readonly implicitProviders?: Maybe<ReadonlyArray<LlmStrategyId>>;
  /**
   * Retired keys per level, with their remedies.
   */
  readonly retiredKeys?: Maybe<LlmModelConfigRetiredKeys>;
  /**
   * The host's extension.
   */
  readonly extension?: Maybe<LlmModelConfigExtension<X>>;
}

/**
 * A built model config schema — the normalized lists every parse, merge and resolve function reads.
 */
export interface LlmModelConfigSchema<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * The error-message prefix.
   */
  readonly label: string;
  /**
   * The completion transports, in message order.
   */
  readonly transports: ReadonlyArray<LlmStrategyId>;
  /**
   * The transport of an entry that names none.
   */
  readonly defaultTransport: LlmStrategyId;
  /**
   * The transports the extension owns.
   */
  readonly extensionTransports: ReadonlyArray<LlmStrategyId>;
  /**
   * Every legal `transport`: {@link transports}, then {@link extensionTransports}.
   */
  readonly entryTransports: ReadonlyArray<LlmStrategyId>;
  /**
   * Every legal `metering`: the base list, the extension's, then `'none'`.
   */
  readonly meterings: ReadonlyArray<LlmProviderStatusProviderId>;
  /**
   * Every legal `decision`: the base list, then `'none'`.
   */
  readonly decisionRoutes: ReadonlyArray<LlmStrategyId>;
  /**
   * Every legal provider key: {@link LLM_PROVIDER_ENTRY_KEYS}, then the extension's.
   */
  readonly providerKeys: ReadonlyArray<string>;
  /**
   * Every legal model key: {@link LLM_MODEL_SETTINGS_KEYS}, then the extension's.
   */
  readonly modelKeys: ReadonlyArray<string>;
  /**
   * Provider names a slug may bind without the file declaring them.
   */
  readonly implicitProviders: ReadonlyArray<LlmStrategyId>;
  /**
   * Retired keys per level.
   */
  readonly retiredKeys: LlmModelConfigSchemaRetiredKeys;
  /**
   * What a patch's keys are called in messages.
   */
  readonly patchKeysNoun: string;
  /**
   * The host's extension.
   */
  readonly extension?: Maybe<LlmModelConfigExtension<X>>;
  /**
   * INTERNAL (read by the parse): the check every `providers` entry passes before it is routed —
   * `{ transport?, baseUrl? }` against {@link entryTransports}.
   */
  readonly providerEntryBaseType: LlmModelConfigEntryTypes['providerEntryBaseType'];
  /**
   * INTERNAL: the messages for {@link providerEntryBaseType}.
   */
  readonly providerEntryBaseRules: ArktypeFieldRules<Pick<LlmProviderEntryBase, 'transport' | 'baseUrl'>>;
  /**
   * INTERNAL: the check of a completion entry against this schema's transports, meterings and decision routes.
   */
  readonly completionProviderEntryType: LlmModelConfigEntryTypes['completionProviderEntryType'];
  /**
   * INTERNAL: the messages for {@link completionProviderEntryType} (the `apiKeyEnv` remedy carries the patch hint when
   * the extension parses patches).
   */
  readonly completionProviderEntryRules: ArktypeFieldRules<LlmCompletionProviderEntry>;
}

// MARK: Field rules
/**
 * The message rule of an entry's `baseUrl`.
 */
const LLM_PROVIDER_BASE_URL_FIELD_RULE: ArktypeFieldRule = { must: 'be a non-empty endpoint URL', remedy: "Remove the key to use the transport's default." };

/**
 * The message rule of a `reasoningOff` encoding (a provider's or a slug's).
 */
const LLM_REASONING_OFF_FIELD_RULE: ArktypeFieldRule = { must: `be one of ${LLM_REASONING_OFF_ENCODINGS.join(', ')}` };

/**
 * The messages for a per-slug `models` entry's built-in fields.
 */
export const LLM_MODEL_SETTINGS_FIELD_RULES: ArktypeFieldRules<LlmModelSettings> = {
  provider: { must: 'be a declared provider name', remedy: 'Remove the key to use the default provider.' },
  reasoningOff: LLM_REASONING_OFF_FIELD_RULE,
  vision: { must: 'be a boolean' },
  promptAddendum: { must: 'be a non-empty string of prompt text', remedy: 'Remove the key to declare no addendum.' }
};

function uniqueLlmModelConfigList<T extends string>(values: Maybe<ReadonlyArray<T>>): T[] {
  return unique(values ?? []);
}

function withLlmProviderFacetNone(values: ReadonlyArray<string>): string[] {
  return [...uniqueLlmModelConfigList(values).filter((value) => value !== LLM_PROVIDER_FACET_NONE), LLM_PROVIDER_FACET_NONE];
}

/**
 * Build a model config schema — once, at host startup.
 *
 * A host with an extension passes the type argument explicitly (`makeLlmModelConfigSchema<MyTypes>({ … })`): TS cannot
 * infer `X` through `X['providerFields']`. Every other model config function infers `X` from its `schema`.
 *
 * @param config - The transports, value lists, label, retired keys and extension.
 * @returns The normalized schema.
 * @throws {Error} When the transports are empty, the default transport is not one of them, an extension key or
 * transport collides with a built-in one, or an extension adds keys / transports without the parser that reads them
 * (a key allowed but never read would vanish from the parsed entry).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmModelConfigSchema<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: LlmModelConfigSchemaConfig<X>): LlmModelConfigSchema<X> {
  const label = config.label ?? DEFAULT_LLM_MODEL_CONFIG_LABEL;
  const extension = config.extension;
  const transports = uniqueLlmModelConfigList(config.transports);

  if (transports.length === 0) {
    throw new Error(`${label}: a model config schema needs at least one transport.`);
  }

  const defaultTransport = config.defaultTransport ?? transports[0];

  if (!transports.includes(defaultTransport)) {
    throw new Error(`${label}: the default transport '${defaultTransport}' is not one of ${transports.join(', ')}.`);
  }

  const extensionProviderKeys = uniqueLlmModelConfigList(extension?.providerKeys);
  const extensionModelKeys = uniqueLlmModelConfigList(extension?.modelKeys);
  const extensionTransports = uniqueLlmModelConfigList(extension?.providerTransports);

  const builtInProviderKeys: ReadonlyArray<string> = LLM_PROVIDER_ENTRY_KEYS;
  const builtInModelKeys: ReadonlyArray<string> = LLM_MODEL_SETTINGS_KEYS;

  for (const key of extensionProviderKeys) {
    if (builtInProviderKeys.includes(key)) {
      throw new Error(`${label}: extension provider key '${key}' collides with a built-in provider key.`);
    }
  }

  for (const key of extensionModelKeys) {
    if (builtInModelKeys.includes(key)) {
      throw new Error(`${label}: extension model key '${key}' collides with a built-in model key.`);
    }
  }

  for (const transport of extensionTransports) {
    if (transports.includes(transport)) {
      throw new Error(`${label}: extension transport '${transport}' collides with a completion transport.`);
    }
  }

  if (extensionProviderKeys.length > 0 && extension?.parseProviderFields == null) {
    throw new Error(`${label}: an extension that adds provider keys must parse them (parseProviderFields).`);
  }

  if (extensionModelKeys.length > 0 && extension?.parseModelFields == null) {
    throw new Error(`${label}: an extension that adds model keys must parse them (parseModelFields).`);
  }

  if (extensionTransports.length > 0 && extension?.parseProviderEntry == null) {
    throw new Error(`${label}: an extension that owns transports must parse their entries (parseProviderEntry).`);
  }

  const retiredKeys = config.retiredKeys;
  const entryTransports = [...transports, ...extensionTransports];
  const meterings = withLlmProviderFacetNone([...(config.meterings ?? []), ...(extension?.meterings ?? [])]);
  const decisionRoutes = withLlmProviderFacetNone(config.decisionRoutes ?? []);
  const patchKeysNoun = extension?.patchKeysNoun ?? 'patch';
  const { providerEntryBaseType, completionProviderEntryType } = makeLlmModelConfigEntryTypes({ entryTransports, meterings, decisionRoutes });
  const transportRule: ArktypeFieldRule = { must: `be one of ${entryTransports.join(', ')}` };
  const patchHint = extension?.parseProviderPatch == null ? '' : ` To extend a built-in provider with ${patchKeysNoun} keys only, carry those keys alone.`;

  return {
    label,
    transports,
    defaultTransport,
    extensionTransports,
    entryTransports,
    meterings,
    decisionRoutes,
    providerKeys: [...LLM_PROVIDER_ENTRY_KEYS, ...extensionProviderKeys],
    modelKeys: [...LLM_MODEL_SETTINGS_KEYS, ...extensionModelKeys],
    implicitProviders: uniqueLlmModelConfigList(config.implicitProviders),
    retiredKeys: {
      file: retiredKeys?.file ?? new Map(),
      provider: retiredKeys?.provider ?? new Map(),
      model: retiredKeys?.model ?? new Map(),
      profile: retiredKeys?.profile ?? new Map()
    },
    patchKeysNoun,
    extension,
    providerEntryBaseType,
    providerEntryBaseRules: { transport: transportRule, baseUrl: LLM_PROVIDER_BASE_URL_FIELD_RULE },
    completionProviderEntryType,
    completionProviderEntryRules: {
      transport: transportRule,
      baseUrl: LLM_PROVIDER_BASE_URL_FIELD_RULE,
      // REQUIRED, and a blank one is rejected rather than read as absent: a declared provider that silently inherited
      // the default key bills the wrong account.
      apiKeyEnv: { must: "name the env var supplying this provider's key", remedy: `A declared provider is never billed on another provider's key.${patchHint}` },
      reasoningOff: LLM_REASONING_OFF_FIELD_RULE,
      tokenLimitParam: { must: `be one of ${LLM_TOKEN_LIMIT_PARAMS.join(', ')}` },
      usageAccounting: { must: 'be a boolean' },
      metering: { must: `be one of ${meterings.join(', ')}` },
      decision: { must: `be one of ${decisionRoutes.join(', ')}` }
    }
  };
}
