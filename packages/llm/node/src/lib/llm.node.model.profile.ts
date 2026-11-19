/**
 * **Profile and tier selection from the environment** — the per-run override, the default tier and the tier vars.
 *
 * The precedence a host builds from these, widest to narrowest: the env tier vars > the active profile (a per-run
 * override over the file's `active`) > the host's tier base — `resolveLlmModelTiers({ base, modelTiers: {
 * ...profile?.tiers, ...tierEnv.modelTiers }, defaultTier: tierEnv.defaultTier })`.
 */

import { errorMessageOf, type Maybe } from '@dereekb/util';
import {
  type LlmModelConfigBaseTypes,
  type LlmModelConfigFile,
  type LlmModelConfigSchema,
  type LlmModelConfigTypes,
  type LlmModelId,
  llmModelProfileDefaultModel,
  type LlmModelTierKey,
  type LlmModelTierValue,
  type LlmPartialModelTierMap,
  type LlmResolvedModelProfile,
  parseLlmModelTierMap,
  resolveLlmModelProfile
} from '@dereekb/llm';
import { DEFAULT_LLM_ENV_NAMES, firstLlmEnvEntry, firstLlmEnvValue, type LlmEnvNames, type LlmEnvView } from './llm.node.env';

// MARK: Profile
/**
 * Config for {@link resolveLlmModelProfileFromEnv}.
 */
export interface ResolveLlmModelProfileFromEnvConfig<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes> {
  /**
   * The environment to read. Default `process.env`.
   */
  readonly env?: Maybe<LlmEnvView>;
  /**
   * The env names; {@link LlmEnvNames.modelProfile} names the override. Default {@link DEFAULT_LLM_ENV_NAMES}.
   */
  readonly names?: Maybe<LlmEnvNames>;
  /**
   * The EFFECTIVE file (`loadEffectiveLlmModelConfigFile`), so the override may name a built-in profile.
   */
  readonly file?: Maybe<LlmModelConfigFile<X>>;
  /**
   * The file path errors name — pass the effective load's `filePath`, so a selection that resolves against no file
   * still says where the operator should have put it.
   */
  readonly source?: Maybe<string>;
  /**
   * The schema (its label prefixes the error).
   */
  readonly schema: LlmModelConfigSchema<X>;
}

/**
 * The active profile, and which env var selected it.
 */
export interface LlmModelProfileFromEnv extends LlmResolvedModelProfile {
  /**
   * The variable that selected the profile — present only when {@link LlmResolvedModelProfile.selectedBy} is
   * `'override'`, so a startup line can name it.
   */
  readonly overrideEnv?: string;
}

/**
 * Resolve the ACTIVE profile — the env override over the file's own `active`.
 *
 * `undefined` when nothing selects a profile (no `active`, no override, or `off` / `none`), so a host's "no profile"
 * path is a null check. A name nothing defines THROWS, naming the variable (or `<path>.active`): a run asked for one
 * profile and would otherwise silently bill the host's defaults.
 *
 * @param config - The environment, the env names, the effective file, its path and the schema.
 * @returns The resolved profile, or `undefined` when none is selected.
 * @throws {Error} When the selected profile is not defined.
 */
export function resolveLlmModelProfileFromEnv<X extends LlmModelConfigTypes = LlmModelConfigBaseTypes>(config: ResolveLlmModelProfileFromEnvConfig<X>): Maybe<LlmModelProfileFromEnv> {
  const { file, source, schema } = config;
  const names = config.names ?? DEFAULT_LLM_ENV_NAMES;
  const override = firstLlmEnvEntry({ env: config.env, names: names.modelProfile });
  const resolved = resolveLlmModelProfile({ file, override: override?.value, overrideLabel: override?.name, source, schema });
  return resolved?.selectedBy === 'override' && override != null ? { ...resolved, overrideEnv: override.name } : resolved;
}

/**
 * Config for {@link llmModelProfileDefaultModelFromEnv}.
 */
export interface LlmModelProfileDefaultModelFromEnvConfig {
  /**
   * The resolved profile.
   */
  readonly profile: Maybe<LlmResolvedModelProfile>;
  /**
   * The environment to read. Default `process.env`.
   */
  readonly env?: Maybe<LlmEnvView>;
  /**
   * The env names; {@link LlmEnvNames.defaultTier} names the default tier. Default {@link DEFAULT_LLM_ENV_NAMES}.
   */
  readonly names?: Maybe<LlmEnvNames>;
}

/**
 * The single slug a resolved profile means for a caller that routes through no tier registry (a test lane that knows
 * one model) — the profile's DEFAULT tier, honouring the default-tier variable.
 *
 * @param config - The profile, the environment and the env names.
 * @returns The default tier's slug, or `undefined` when the profile declares no such tier.
 */
export function llmModelProfileDefaultModelFromEnv(config: LlmModelProfileDefaultModelFromEnvConfig): Maybe<LlmModelId> {
  const names = config.names ?? DEFAULT_LLM_ENV_NAMES;
  return llmModelProfileDefaultModel({ profile: config.profile, defaultTier: firstLlmEnvValue({ env: config.env, names: names.defaultTier }) });
}

// MARK: Tiers
/**
 * Config for {@link resolveLlmModelTierEnv}.
 */
export interface ResolveLlmModelTierEnvConfig {
  /**
   * The environment to read. Default `process.env`.
   */
  readonly env?: Maybe<LlmEnvView>;
  /**
   * The env names. Default {@link DEFAULT_LLM_ENV_NAMES}.
   */
  readonly names?: Maybe<LlmEnvNames>;
  /**
   * The schema label a malformed tier JSON's message is prefixed with (`llm models`). Omitted ⇒ no prefix.
   */
  readonly schemaLabel?: Maybe<string>;
}

/**
 * The tier settings an environment declares. Every key is absent when undeclared, so a bare environment changes
 * nothing.
 */
export interface LlmModelTierEnvSettings {
  /**
   * The declared tiers — the bulk JSON with the per-tier vars laid over it.
   */
  readonly modelTiers?: LlmPartialModelTierMap;
  /**
   * The default tier.
   */
  readonly defaultTier?: LlmModelTierKey;
  /**
   * The decode-retry tier. An off value (`off` / `none`, any case) passes through unvalidated — the dispatcher reads it
   * with `isLlmOffValue`, and the tier map stays the only validator.
   */
  readonly decodeRetryTier?: LlmModelTierKey;
}

/**
 * Resolve the tier settings from the environment: the bulk tier JSON (fail-loud), with each per-tier slug variable
 * WINNING over the same key in it (the targeted knob beats the bulk declaration), plus the default and decode-retry
 * tiers. Blank values are unset.
 *
 * The JSON goes through `parseLlmModelTierMap`, the one validator every untrusted tier declaration shares (this
 * variable and a file's profiles both), so the two surfaces cannot drift on what a tier value may say.
 *
 * @param config - The environment and the env names.
 * @returns The declared tier settings (`{}` when none is declared).
 * @throws {Error} When the tier JSON is not valid JSON, not an object, or carries a malformed value.
 */
export function resolveLlmModelTierEnv(config?: Maybe<ResolveLlmModelTierEnvConfig>): LlmModelTierEnvSettings {
  const env = config?.env;
  const names = config?.names ?? DEFAULT_LLM_ENV_NAMES;
  const tiers: Record<LlmModelTierKey, LlmModelTierValue> = {};
  const bulk = firstLlmEnvEntry({ env, names: names.modelTiers });

  if (bulk != null) {
    let parsed: unknown;

    try {
      parsed = JSON.parse(bulk.value);
    } catch (e) {
      throw new Error(`${bulk.name} is not valid JSON: ${errorMessageOf(e)}`, { cause: e });
    }

    Object.assign(tiers, parseLlmModelTierMap({ schemaLabel: config?.schemaLabel, label: bulk.name, value: parsed }));
  }

  for (const [tier, tierNames] of Object.entries(names.tierModels)) {
    const model = firstLlmEnvValue({ env, names: tierNames });

    if (model != null) {
      tiers[tier] = model;
    }
  }

  const defaultTier = firstLlmEnvValue({ env, names: names.defaultTier });
  const decodeRetryTier = firstLlmEnvValue({ env, names: names.decodeRetryTier });
  return { ...(Object.keys(tiers).length === 0 ? {} : { modelTiers: tiers }), ...(defaultTier == null ? {} : { defaultTier }), ...(decodeRetryTier == null ? {} : { decodeRetryTier }) };
}
