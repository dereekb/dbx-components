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

import { type Maybe } from '@dereekb/util';
import { type LlmProviderStatusProviderId } from '../../strategy/llm.provider.status';
import { type LlmPartialModelTierMap } from '../llm.model.tier';
import { type LlmReasoningOffEncoding, type LlmTokenLimitParam } from '../llm.model.wire';
import { type LlmModelId, type LlmStrategyId } from '../llm.value';

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
 * The profile names that select NO profile (compared lower-cased), so an operator can switch profiles off with a
 * per-run override without editing the file.
 */
export const LLM_MODEL_PROFILE_OFF: ReadonlySet<string> = new Set(['off', 'none', '']);

/**
 * The value a provider's `metering` / `decision` key uses to say "this provider has no such facet" (meters nothing /
 * serves no decisions). Always legal, and always listed last in an error message.
 */
export const LLM_PROVIDER_FACET_NONE = 'none';

/**
 * The top-level keys a model config file may carry — an unknown one fails loud.
 */
export const LLM_MODEL_CONFIG_FILE_KEYS: ReadonlyArray<string> = ['active', 'providers', 'profiles', 'models', 'notes', '$schema'];

/**
 * The keys a completion provider entry may carry; an extension appends its own ({@link LlmModelConfigSchema.providerKeys}).
 */
export const LLM_PROVIDER_ENTRY_KEYS: ReadonlyArray<string> = ['transport', 'baseUrl', 'apiKeyEnv', 'reasoningOff', 'tokenLimitParam', 'usageAccounting', 'metering', 'decision'];

/**
 * The keys that say WHICH backend and account an entry is. An entry carrying none of them is a PATCH
 * ({@link isLlmProviderPatchValue}) when the schema's extension parses patches.
 */
export const LLM_PROVIDER_IDENTITY_KEYS: ReadonlyArray<string> = ['transport', 'baseUrl', 'apiKeyEnv'];

/**
 * The keys that only mean something on a provider that serves completions — an extension's entry parser refuses them
 * on the provider kinds it owns.
 */
export const LLM_PROVIDER_COMPLETION_ONLY_KEYS: ReadonlyArray<string> = ['reasoningOff', 'tokenLimitParam', 'usageAccounting', 'decision'];

/**
 * The keys a per-slug `models` entry may carry; an extension appends its own ({@link LlmModelConfigSchema.modelKeys}).
 */
export const LLM_MODEL_SETTINGS_KEYS: ReadonlyArray<string> = ['provider', 'reasoningOff', 'vision', 'promptAddendum'];

// MARK: Entries
/**
 * What every `providers` entry carries, whichever kind it is.
 */
export interface LlmProviderEntryBase {
  /**
   * The transport (the strategy KIND) this provider is served by. The entry's NAME is the strategy instance id a slug
   * or routing rule binds to. Absent on disk ⇒ the schema's default transport.
   */
  readonly transport: LlmStrategyId;
  /**
   * The endpoint base URL. Absent ⇒ the transport's own default.
   */
  readonly baseUrl?: string;
  /**
   * WHICH env var supplies this provider's key — the var NAME, never the secret.
   */
  readonly apiKeyEnv?: string;
}

/**
 * ONE declared completion provider — a NAMED, separately-configured backend instance. Several may share one transport;
 * that is the point (a LAN-served local model beside a remote gateway, two keys against one gateway).
 *
 * A binding belongs on the SLUG ({@link LlmModelSettings.provider}), not on a profile: which key may bill a slug is a
 * fact about the model (a free slug may be entitled on only one account) and must hold however the slug was selected.
 */
export interface LlmCompletionProviderEntry extends LlmProviderEntryBase {
  /**
   * REQUIRED on a completion provider, and deliberately so: the usual reason a second provider exists is that it bills
   * a different key, and a provider that silently inherited the default one would bill the wrong account.
   */
  readonly apiKeyEnv: string;
  /**
   * The PROVIDER-level reasoning-OFF wire encoding — the default for every slug this provider serves. Two-level by
   * necessity: the same slug served by two providers can differ (a local build that rejects `reasoning_effort`
   * beside a gateway that honours it), so the per-slug {@link LlmModelSettings.reasoningOff} still wins over this.
   */
  readonly reasoningOff?: LlmReasoningOffEncoding;
  /**
   * Which request key carries the completion-length cap — a property of the ENDPOINT, so it belongs here rather than
   * in a global setting every provider would share.
   */
  readonly tokenLimitParam?: LlmTokenLimitParam;
  /**
   * Opt into aggregator usage accounting so the reply carries a cost. OFF by default because a strict
   * OpenAI-compatible endpoint (a local vLLM) may reject the unknown param.
   */
  readonly usageAccounting?: boolean;
  /**
   * The account-metering source for this provider's quota reads — one of the schema's meterings, or
   * {@link LLM_PROVIDER_FACET_NONE}. Absent ⇒ inferred from the provider's base URL by a registered metering adapter
   * (`llmProviderMeteringOf`); a provider that meters nothing should say `'none'`.
   */
  readonly metering?: LlmProviderStatusProviderId;
  /**
   * The decision route this provider serves decisions through — one of the schema's decision routes, or
   * {@link LLM_PROVIDER_FACET_NONE}. Absent ⇒ the route a registered decision adapter serves for the transport
   * (`llmProviderDecisionRouteOf`), else `'none'`.
   */
  readonly decision?: LlmStrategyId;
}

/**
 * The per-SLUG facts of a `models` entry. They apply to a slug however it was selected, so they are not scoped to (or
 * overridden by) the active profile.
 */
export interface LlmModelSettings {
  /**
   * The provider NAME that serves this slug. Shape-checked by the parse; that the name resolves is checked over the
   * MERGED file ({@link LlmModelConfigFile}), where a binding to a built-in provider is finally visible.
   */
  readonly provider?: LlmStrategyId;
  /**
   * This slug's reasoning-OFF encoding — wins over the provider's and the host's.
   */
  readonly reasoningOff?: LlmReasoningOffEncoding;
  /**
   * Whether this slug accepts image content parts. Default OFF: a text-only model answers a multimodal body with a
   * `400`, while a vision model called with plain text just answers from the descriptions.
   */
  readonly vision?: boolean;
  /**
   * Text PREPENDED to every dispatch that resolves to this slug, so it rides in the cacheable prefix. A blank one is
   * rejected rather than read as absent — an operator who cleared the text but kept the key meant to say something.
   */
  readonly promptAddendum?: string;
}

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
 * A completion provider entry with the extension's provider fields.
 */
export type LlmCompletionProviderEntryOf<X extends LlmModelConfigTypes> = LlmCompletionProviderEntry & X['providerFields'];

/**
 * Any parsed `providers` entry: a completion provider, or an entry of a transport the extension owns.
 */
export type LlmProviderEntryOf<X extends LlmModelConfigTypes> = LlmCompletionProviderEntryOf<X> | X['extensionProviderEntry'];

/**
 * A per-slug `models` entry with the extension's model fields.
 */
export type LlmModelSettingsOf<X extends LlmModelConfigTypes> = LlmModelSettings & X['modelFields'];

/**
 * The `providers` block, keyed by provider name.
 */
export type LlmProviderEntryMap<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> = Readonly<Record<LlmStrategyId, LlmProviderEntryOf<X>>>;

/**
 * The `models` block, keyed by model slug.
 */
export type LlmModelSettingsMap<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> = Readonly<Partial<Record<LlmModelId, LlmModelSettingsOf<X>>>>;

/**
 * The parsed shape of a model config file.
 */
export interface LlmModelConfigFile<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * WHICH profile is live: a name in {@link profiles}, or an {@link LLM_MODEL_PROFILE_OFF} value / absent for none.
   * A host's per-run override wins over it.
   */
  readonly active?: string;
  /**
   * The declared providers, keyed by name.
   */
  readonly providers?: LlmProviderEntryMap<X>;
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
  readonly providerPatches?: Readonly<Record<LlmStrategyId, X['providerFields']>>;
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
export interface LlmModelConfigExtensionInput {
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
export interface LlmModelConfigExtensionEntryInput<F extends object = object> extends LlmModelConfigExtensionInput {
  /**
   * The entry's transport (one of the extension's).
   */
  readonly transport: LlmStrategyId;
  /**
   * The raw `baseUrl` — already shape-checked (absent or non-blank), untrimmed.
   */
  readonly baseUrl: Maybe<string>;
  /**
   * What {@link LlmModelConfigExtension.parseProviderFields} returned for this entry.
   */
  readonly fields: F;
  /**
   * The schema's full metering list, for a `metering` check.
   */
  readonly meterings: ReadonlyArray<LlmProviderStatusProviderId>;
}

/**
 * The extension seam: what a host adds to the model config.
 *
 * A provider entry naming an owned transport serves no completions — no completion reader mints a strategy for it,
 * and a slug may bind it only when {@link isProviderBindable} says so. A PATCH is a `providers` entry carrying none of
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
  readonly parseProviderFields?: Maybe<(input: LlmModelConfigExtensionInput) => X['providerFields']>;
  /**
   * Transports the extension owns: their entries serve no completions.
   */
  readonly providerTransports?: Maybe<ReadonlyArray<LlmStrategyId>>;
  /**
   * Parses an entry of an owned transport, whole. Required with {@link providerTransports}.
   */
  readonly parseProviderEntry?: Maybe<(input: LlmModelConfigExtensionEntryInput<X['providerFields']>) => X['extensionProviderEntry']>;
  /**
   * Whether a slug may bind an owned-transport entry (e.g. as an entitlement read by a non-completion surface).
   * Absent ⇒ never.
   */
  readonly isProviderBindable?: Maybe<(entry: X['extensionProviderEntry']) => boolean>;
  /**
   * Parses a patch entry. Absent ⇒ an identity-less entry parses as an ordinary entry (and fails on `apiKeyEnv`).
   */
  readonly parseProviderPatch?: Maybe<(input: LlmModelConfigExtensionInput) => X['providerFields']>;
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
  readonly parseModelFields?: Maybe<(input: LlmModelConfigExtensionInput) => X['modelFields']>;
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
}

function uniqueLlmModelConfigList<T extends string>(values: Maybe<ReadonlyArray<T>>): T[] {
  return Array.from(new Set(values ?? []));
}

function withLlmProviderFacetNone<T extends string>(values: ReadonlyArray<T>): T[] {
  return [...uniqueLlmModelConfigList(values).filter((value) => value !== LLM_PROVIDER_FACET_NONE), LLM_PROVIDER_FACET_NONE as T];
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

  for (const key of extensionProviderKeys) {
    if (LLM_PROVIDER_ENTRY_KEYS.includes(key)) {
      throw new Error(`${label}: extension provider key '${key}' collides with a built-in provider key.`);
    }
  }

  for (const key of extensionModelKeys) {
    if (LLM_MODEL_SETTINGS_KEYS.includes(key)) {
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

  return {
    label,
    transports,
    defaultTransport,
    extensionTransports,
    entryTransports: [...transports, ...extensionTransports],
    meterings: withLlmProviderFacetNone([...(config.meterings ?? []), ...(extension?.meterings ?? [])]),
    decisionRoutes: withLlmProviderFacetNone(config.decisionRoutes ?? []),
    providerKeys: [...LLM_PROVIDER_ENTRY_KEYS, ...extensionProviderKeys],
    modelKeys: [...LLM_MODEL_SETTINGS_KEYS, ...extensionModelKeys],
    implicitProviders: uniqueLlmModelConfigList(config.implicitProviders),
    retiredKeys: {
      file: retiredKeys?.file ?? new Map(),
      provider: retiredKeys?.provider ?? new Map(),
      model: retiredKeys?.model ?? new Map(),
      profile: retiredKeys?.profile ?? new Map()
    },
    patchKeysNoun: extension?.patchKeysNoun ?? 'patch',
    ...(extension == null ? {} : { extension })
  };
}

/**
 * Config for {@link llmCompletionProviderEntries}.
 */
export interface LlmCompletionProviderEntriesConfig<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * The `providers` block (absent ⇒ none).
   */
  readonly providers: Maybe<LlmProviderEntryMap<X>>;
  /**
   * The schema naming the transports the extension owns.
   */
  readonly schema: LlmModelConfigSchema<X>;
}

/**
 * The providers that serve completions — every entry whose transport the extension does not own, in declaration
 * order. The only providers a completion reader may mint a strategy for.
 *
 * @param config - The providers and the schema.
 * @returns The completion providers, keyed by name.
 */
export function llmCompletionProviderEntries<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: LlmCompletionProviderEntriesConfig<X>): Readonly<Record<LlmStrategyId, LlmCompletionProviderEntryOf<X>>> {
  const { providers, schema } = config;
  const entries = Object.entries(providers ?? {}).filter(([, entry]) => !schema.extensionTransports.includes(entry.transport));
  return Object.fromEntries(entries) as Record<LlmStrategyId, LlmCompletionProviderEntryOf<X>>;
}
