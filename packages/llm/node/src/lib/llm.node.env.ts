/**
 * The **environment vocabulary** of `@dereekb/llm/node` — which variable NAMES a host reads, and the two primitives
 * every reader here goes through.
 *
 * Every name is a parameter. {@link DEFAULT_LLM_ENV_NAMES} holds conventional defaults (the vendors' own key names, and
 * `LLM_`-prefixed names for the rest); a host with its own prefix spreads the defaults and lists its names first, so
 * `MYAPP_OPENAI_API_KEY` wins over `OPENAI_API_KEY` without the library knowing either.
 */

import { type Maybe } from '@dereekb/util';
import { type LlmModelTierKey, type LlmStrategyId } from '@dereekb/llm';

// MARK: Primitives
/**
 * An environment view — `process.env` is assignable, and a spec passes a plain record.
 */
export type LlmEnvView = Readonly<Record<string, Maybe<string>>>;

/**
 * Env var NAMES in priority order: the first one set wins. An empty list is never read — the way a host switches a
 * knob off.
 */
export type LlmEnvVarNames = ReadonlyArray<string>;

/**
 * One env var that was set: its name and its TRIMMED value (never blank).
 */
export interface LlmEnvEntry {
  /**
   * The variable that supplied the value — named in messages so an operator knows what to change or rotate.
   */
  readonly name: string;
  /**
   * The trimmed value.
   */
  readonly value: string;
}

/**
 * Config for {@link firstLlmEnvEntry} / {@link firstLlmEnvValue}.
 */
export interface LlmEnvLookupConfig {
  /**
   * The environment to read. Default `process.env`.
   */
  readonly env?: Maybe<LlmEnvView>;
  /**
   * The names to try, in priority order.
   */
  readonly names: LlmEnvVarNames;
}

/**
 * The FIRST of a priority-ordered list of env vars that holds a value, with the name that supplied it.
 *
 * Whitespace-only counts as unset and the value comes back trimmed: an exported-but-empty variable (a shell's
 * `export KEY=`) would otherwise shadow a real key listed after it, and a trailing newline pasted with a key would
 * reach the wire as part of the credential.
 *
 * @param config - The environment (default `process.env`) and the names in priority order.
 * @returns The first set variable's name and trimmed value, or `undefined` when none is set.
 */
export function firstLlmEnvEntry(config: LlmEnvLookupConfig): Maybe<LlmEnvEntry> {
  const env = config.env ?? process.env;
  let result: Maybe<LlmEnvEntry>;

  for (const name of config.names) {
    const value = env[name]?.trim();

    if (value != null && value.length > 0) {
      result = { name, value };
      break;
    }
  }

  return result;
}

/**
 * The trimmed value of the first set variable among `names` ({@link firstLlmEnvEntry}), for a reader that does not
 * need to know which one supplied it.
 *
 * @param config - The environment (default `process.env`) and the names in priority order.
 * @returns The first set value, trimmed, or `undefined` when none is set.
 */
export function firstLlmEnvValue(config: LlmEnvLookupConfig): Maybe<string> {
  return firstLlmEnvEntry(config)?.value;
}

// MARK: Names
/**
 * The env var names of ONE provider an environment configures on its own — no `models.json` entry needed. The env
 * defaults are how a bare `OPENAI_API_KEY` on a fresh machine is enough to make a call.
 */
export interface LlmEnvProviderNames {
  /**
   * The instance id the provider registers under (and the name an explicit default-provider selection matches).
   */
  readonly id: LlmStrategyId;
  /**
   * The completion adapter kind serving it. Default {@link id}. A provider whose transport has no registered completion
   * adapter is skipped: the host did not install that entry, so its key means nothing here.
   */
  readonly transport?: Maybe<LlmStrategyId>;
  /**
   * The key vars, in priority order.
   */
  readonly apiKey: LlmEnvVarNames;
  /**
   * The base URL vars. Unset ⇒ the adapter's own default endpoint applies when the strategy is built.
   */
  readonly baseUrl?: Maybe<LlmEnvVarNames>;
  /**
   * The token-limit-param vars. Lenient: an unrecognized value is ignored, so a typo never reddens startup.
   */
  readonly tokenLimitParam?: Maybe<LlmEnvVarNames>;
  /**
   * The reasoning-off encoding vars. Lenient, like {@link tokenLimitParam}.
   */
  readonly reasoningOff?: Maybe<LlmEnvVarNames>;
  /**
   * The usage-accounting vars. `1` / `true` (any case) turn it on; anything else leaves the key ABSENT, so a strict
   * endpoint keeps receiving the body it always did.
   */
  readonly usageAccounting?: Maybe<LlmEnvVarNames>;
  /**
   * Ranks this provider AFTER the declared ones and makes it the default when nothing else is keyed — the catch-all
   * gateway a host falls back on.
   */
  readonly fallback?: Maybe<boolean>;
}

/**
 * Every env var name `@dereekb/llm/node` reads. A FULL object: build a host's own by spreading
 * {@link DEFAULT_LLM_ENV_NAMES}, so a knob it does not mention keeps the default instead of going silent.
 */
export interface LlmEnvNames {
  /**
   * The providers an environment configures on its own, in rank order.
   */
  readonly providers: ReadonlyArray<LlmEnvProviderNames>;
  /**
   * The explicit default-provider selection.
   */
  readonly defaultProvider: LlmEnvVarNames;
  /**
   * The explicit model config file path. A path set here that does not exist fails the read loud.
   */
  readonly modelsFile: LlmEnvVarNames;
  /**
   * The per-run profile override, which wins over the file's `active`.
   */
  readonly modelProfile: LlmEnvVarNames;
  /**
   * The bulk tier map, as JSON.
   */
  readonly modelTiers: LlmEnvVarNames;
  /**
   * One slug var per tier. Each wins over the same key in {@link modelTiers}: the targeted knob beats the bulk one.
   */
  readonly tierModels: Readonly<Record<LlmModelTierKey, LlmEnvVarNames>>;
  /**
   * Which tier is the default.
   */
  readonly defaultTier: LlmEnvVarNames;
  /**
   * Which tier a malformed completion is retried on (`off` pins retries to the same model).
   */
  readonly decodeRetryTier: LlmEnvVarNames;
}

/**
 * The default env var names: the vendors' own key and base-URL names, and `LLM_`-prefixed names for the rest.
 *
 * OpenAI is the keyed default; OpenRouter is the fallback, so it serves only when nothing else is keyed (or is
 * selected explicitly).
 */
export const DEFAULT_LLM_ENV_NAMES: LlmEnvNames = {
  providers: [
    { id: 'openai', apiKey: ['OPENAI_API_KEY'], baseUrl: ['OPENAI_BASE_URL'], tokenLimitParam: ['LLM_OPENAI_TOKEN_LIMIT_PARAM'], reasoningOff: ['LLM_OPENAI_REASONING_OFF'], usageAccounting: ['LLM_OPENAI_USAGE_ACCOUNTING'] },
    { id: 'openrouter', apiKey: ['OPENROUTER_API_KEY'], fallback: true }
  ],
  defaultProvider: ['LLM_PROVIDER'],
  modelsFile: ['LLM_MODELS_FILE'],
  modelProfile: ['LLM_MODEL_PROFILE'],
  modelTiers: ['LLM_MODEL_TIERS'],
  tierModels: { fast: ['LLM_MODEL'], strong: ['LLM_MODEL_STRONG'] },
  defaultTier: ['LLM_DEFAULT_TIER'],
  decodeRetryTier: ['LLM_DECODE_RETRY_TIER']
};

/**
 * Every env-default provider's key var names, in provider then priority order — the list a hermetic test lane
 * blanks so a developer's own keys never reach it.
 *
 * @param names - The env names. Default {@link DEFAULT_LLM_ENV_NAMES}.
 * @returns The key var names.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function llmEnvApiKeyNamesOf(names?: Maybe<LlmEnvNames>): LlmEnvVarNames {
  return (names ?? DEFAULT_LLM_ENV_NAMES).providers.flatMap((provider) => provider.apiKey);
}

/**
 * Config for {@link hasLlmProviderKeyInEnv}.
 */
export interface HasLlmProviderKeyInEnvConfig {
  /**
   * The environment to read. Default `process.env`.
   */
  readonly env?: Maybe<LlmEnvView>;
  /**
   * The env names. Default {@link DEFAULT_LLM_ENV_NAMES}.
   */
  readonly names?: Maybe<LlmEnvNames>;
}

/**
 * Whether ANY env-default provider has a key — the provider-agnostic "is a backend configured at all" gate, so a gate
 * never hard-codes one vendor's key name.
 *
 * @param config - The environment and the env names.
 * @returns `true` when at least one key var holds a non-blank value.
 */
export function hasLlmProviderKeyInEnv(config?: Maybe<HasLlmProviderKeyInEnvConfig>): boolean {
  return firstLlmEnvEntry({ env: config?.env, names: llmEnvApiKeyNamesOf(config?.names) }) != null;
}
