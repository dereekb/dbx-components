/**
 * The key lists, message rule tables and canonical assemblers of llm's model declarations — a tier value
 * (`llm.model.tier.parse.ts`), a model config file's provider and per-slug entries (`config/llm.model.config.parse.ts`)
 * and a routing block (`llm.model.routing.ts`). The checks they feed (`assertObjectKeys`,
 * `parseArktypeFieldsWithMessages`) live in `@dereekb/model`, which turns arktype's first error into the operator-facing
 * message (`<label>.<field> must <rule> (got <value>). <remedy>`).
 *
 * An extension (a host's own provider or model keys) calls those two checks directly, so its messages read like the
 * library's.
 *
 * **Why a field set is still declared beside its arktype type, not derived from it.** The arktype type, the `*_KEYS`
 * list, the `*_FIELD_RULES` table and the canonical assembly are four representations of one set. They cannot yet
 * collapse into one arktype declaration without moving pinned messages or written bytes:
 *
 * - arktype normalizes an object's props to required keys first, then optional keys sorted ALPHABETICALLY — in
 *   `.props` and in the order its errors come back. So `{ effort?, maxTokens?, exclude?, enabled? }` reads back as
 *   `effort, enabled, exclude, maxTokens`. A key list read off the type would change which failing field is reported
 *   first and the key order `flattenLlmModelConfigFile` writes. `*_KEYS` therefore stays the order's one declaration;
 *   `llm.model.field.spec.ts` pins the arktype behaviour this rests on, so the collapse is revisited if it changes.
 * - A rule COULD ride the prop as meta (`type(...).configure({ must, remedy })` survives on `.props[i].value.meta`),
 *   but that trades the compile-time exhaustiveness of {@link ArktypeFieldRules} for a runtime lookup, so the tables
 *   stay.
 * - `'+': 'reject'` reports `<key> must be removed`, not the pinned unknown-key message, so `assertObjectKeys` (and
 *   the retired-key pre-pass) stays in front of the type.
 * - The assemblers are not uniform: most trim or keep specific fields byte for byte, and extensions append theirs,
 *   so they stay per set.
 */

import { type ArktypeFieldRule, type ArktypeFieldRules } from '@dereekb/model';
import { LLM_REASONING_EFFORTS } from './llm.model.wire';
import { type LlmModelOutputControls, type LlmModelProviderRef, type LlmModelSelection, type LlmModelTierConfig, type LlmReasoningConfig } from './llm.value';

// MARK: Key lists
/**
 * The keys a reasoning block may carry, in canonical (output and message) order.
 */
export const LLM_REASONING_CONFIG_KEYS = ['effort', 'maxTokens', 'exclude', 'enabled'] as const satisfies ReadonlyArray<keyof LlmReasoningConfig>;

/**
 * The keys of the output controls, in canonical order.
 */
export const LLM_MODEL_OUTPUT_CONTROLS_KEYS = ['maxOutputTokens', 'reasoning'] as const satisfies ReadonlyArray<keyof LlmModelOutputControls>;

/**
 * The keys of a model selection, in canonical order.
 */
export const LLM_MODEL_SELECTION_KEYS = ['model', 'tier'] as const satisfies ReadonlyArray<keyof LlmModelSelection>;

/**
 * The keys of a provider reference.
 */
export const LLM_MODEL_PROVIDER_REF_KEYS = ['provider'] as const satisfies ReadonlyArray<keyof LlmModelProviderRef>;

/**
 * The keys a rich tier config (the object arm of a tier value) may carry, in canonical order — an unknown key fails
 * loud.
 */
export const LLM_MODEL_TIER_CONFIG_KEYS = ['model', ...LLM_MODEL_OUTPUT_CONTROLS_KEYS] as const satisfies ReadonlyArray<keyof LlmModelTierConfig>;

// MARK: Rule tables
/**
 * The rule for a model slug field.
 */
const LLM_MODEL_SLUG_FIELD_RULE: ArktypeFieldRule = { must: 'be a non-empty, trimmed model slug' };

/**
 * The rule for a token-count field.
 */
const LLM_TOKEN_COUNT_FIELD_RULE: ArktypeFieldRule = { must: 'be a positive integer' };

/**
 * The messages for a reasoning block's fields.
 */
export const LLM_REASONING_CONFIG_FIELD_RULES: ArktypeFieldRules<LlmReasoningConfig> = {
  effort: { must: `be one of ${LLM_REASONING_EFFORTS.join(', ')}` },
  maxTokens: LLM_TOKEN_COUNT_FIELD_RULE,
  exclude: { must: 'be a boolean' },
  enabled: { must: 'be a boolean' }
};

/**
 * The messages for the output controls.
 */
export const LLM_MODEL_OUTPUT_CONTROLS_FIELD_RULES: ArktypeFieldRules<LlmModelOutputControls> = {
  maxOutputTokens: LLM_TOKEN_COUNT_FIELD_RULE,
  reasoning: { must: 'be an object', fields: LLM_REASONING_CONFIG_FIELD_RULES, keys: LLM_REASONING_CONFIG_KEYS }
};

/**
 * The messages for a model selection.
 */
export const LLM_MODEL_SELECTION_FIELD_RULES: ArktypeFieldRules<LlmModelSelection> = {
  model: LLM_MODEL_SLUG_FIELD_RULE,
  tier: { must: 'be a non-blank tier key' }
};

/**
 * The messages for a provider reference.
 */
export const LLM_MODEL_PROVIDER_REF_FIELD_RULES: ArktypeFieldRules<LlmModelProviderRef> = {
  provider: { must: 'be a non-blank provider name' }
};

/**
 * The messages for a rich tier config.
 */
export const LLM_MODEL_TIER_CONFIG_FIELD_RULES: ArktypeFieldRules<LlmModelTierConfig> = {
  model: LLM_MODEL_SLUG_FIELD_RULE,
  ...LLM_MODEL_OUTPUT_CONTROLS_FIELD_RULES
};

// MARK: Assembly
/**
 * A reasoning block re-assembled in canonical key order ({@link LLM_REASONING_CONFIG_KEYS}), absent keys omitted — so
 * a parsed block never aliases, or inherits the key order of, the raw JSON.
 *
 * @param reasoning - The validated block.
 * @returns The canonical copy.
 */
export function toCanonicalLlmReasoningConfig(reasoning: LlmReasoningConfig): LlmReasoningConfig {
  const { effort, maxTokens, exclude, enabled } = reasoning;
  return {
    ...(effort == null ? {} : { effort }),
    ...(maxTokens == null ? {} : { maxTokens }),
    ...(exclude == null ? {} : { exclude }),
    ...(enabled == null ? {} : { enabled })
  };
}

/**
 * The output controls re-assembled in canonical key order, absent keys omitted.
 *
 * @param controls - The validated controls.
 * @returns The canonical copy.
 */
export function toCanonicalLlmModelOutputControls(controls: LlmModelOutputControls): LlmModelOutputControls {
  const { maxOutputTokens, reasoning } = controls;
  return {
    ...(maxOutputTokens == null ? {} : { maxOutputTokens }),
    ...(reasoning == null ? {} : { reasoning: toCanonicalLlmReasoningConfig(reasoning) })
  };
}
