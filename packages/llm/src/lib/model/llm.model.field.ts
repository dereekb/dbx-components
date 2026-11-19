/**
 * The ONE set of field checks behind every hand-edited model declaration — a tier value (`llm.model.tier.parse.ts`),
 * a model config file's provider and per-slug entries (`config/llm.model.config.parse.ts`) and a routing block
 * (`llm.model.routing.ts`). arktype does the validating; this module turns its first error into the operator-facing
 * message (`<label>.<field> must <rule> (got <value>). <remedy>`) and owns the retired / unknown key check.
 *
 * An extension (a host's own provider or model keys) uses the same two helpers, so its messages read like the
 * library's.
 */

import { filterUndefinedValues, isPlainObject, type Maybe } from '@dereekb/util';
import { ArkErrors, type Type } from 'arktype';
import { LLM_REASONING_EFFORTS } from './llm.model.wire';
import { type LlmModelOutputControls, type LlmModelProviderRef, type LlmModelSelection, type LlmModelTierConfig, type LlmReasoningConfig } from './llm.value';

// MARK: Keys
/**
 * Input to {@link assertLlmModelConfigKeys}.
 */
export interface AssertLlmModelConfigKeysInput {
  /**
   * The schema label every message is prefixed with (`llm models`). Omitted ⇒ no prefix.
   */
  readonly schemaLabel?: Maybe<string>;
  /**
   * What the message names as the object (`models.json providers['gateway']`).
   */
  readonly label: string;
  /**
   * The object whose keys are checked.
   */
  readonly entry: Readonly<Record<string, unknown>>;
  /**
   * Retired keys → the remedy sentence that tells the operator what replaced them. Checked BEFORE the allowed list, so a
   * retired key reports its remedy rather than reading as a typo.
   */
  readonly retired?: Maybe<ReadonlyMap<string, string>>;
  /**
   * The allowed keys, in the order the message lists them. Omitted ⇒ only the retired check runs (an extensible level
   * whose extension keys are checked by the extension).
   */
  readonly allowed?: Maybe<ReadonlyArray<string>>;
}

/**
 * The prefix a message carries for a schema label (`'llm models: '`), or `''`.
 *
 * @param schemaLabel - The schema label, if any.
 * @returns The message prefix.
 */
export function llmModelConfigMessagePrefix(schemaLabel: Maybe<string>): string {
  return schemaLabel ? `${schemaLabel}: ` : '';
}

/**
 * Fail loud on a retired key (with its remedy), then on any key outside {@link AssertLlmModelConfigKeysInput.allowed}.
 *
 * @param input - The labels, the object, and the retired / allowed key lists.
 * @throws {Error} On the first retired or unknown key.
 */
export function assertLlmModelConfigKeys(input: AssertLlmModelConfigKeysInput): void {
  const { label, entry, retired, allowed } = input;
  const prefix = llmModelConfigMessagePrefix(input.schemaLabel);
  const keys = Object.keys(entry);

  for (const key of keys) {
    const remedy = retired?.get(key);

    if (remedy != null) {
      throw new Error(`${prefix}${label} has retired key '${key}'. ${remedy}`);
    }
  }

  if (allowed != null) {
    for (const key of keys) {
      if (!allowed.includes(key)) {
        throw new Error(`${prefix}${label} has unknown key '${key}' (allowed: ${allowed.join(', ')}).`);
      }
    }
  }
}

// MARK: Field rules
/**
 * What an operator is told when one field fails: `<label>.<field> must <must> (got <value>). <remedy>`.
 */
export interface LlmModelConfigFieldRule {
  /**
   * The requirement, completing "must …" (`'be a boolean'`, `'be one of low, medium, high'`).
   */
  readonly must: string;
  /**
   * An optional sentence appended after the value (`'Remove the key to use the default provider.'`).
   */
  readonly remedy?: Maybe<string>;
  /**
   * For a nested object field: the rules of ITS fields, so a nested failure names `field.nestedField`.
   */
  readonly fields?: Maybe<Readonly<Record<string, LlmModelConfigFieldRule>>>;
  /**
   * For a nested object field: its allowed keys, in order — an unknown nested key fails loud.
   */
  readonly keys?: Maybe<ReadonlyArray<string>>;
}

/**
 * One {@link LlmModelConfigFieldRule} per key of `T` — exhaustive, so a field added to a declaration without a message
 * fails to compile.
 */
export type LlmModelConfigFieldRules<T> = { readonly [K in keyof T & string]-?: LlmModelConfigFieldRule };

/**
 * Config for {@link parseLlmModelConfigFields}.
 */
export interface ParseLlmModelConfigFieldsConfig<T extends object> {
  /**
   * The schema label every message is prefixed with. Omitted ⇒ no prefix.
   */
  readonly schemaLabel?: Maybe<string>;
  /**
   * What the message names as the object (`MODEL_TIERS['fast']`).
   */
  readonly label: string;
  /**
   * The object to validate (the caller has already checked it is a plain object and checked its top-level keys).
   */
  readonly value: Readonly<Record<string, unknown>>;
  /**
   * The arktype object type that validates the fields. An extension declares its own with `'+': 'delete'` so the
   * result carries only its keys.
   */
  readonly type: Type<T>;
  /**
   * The checked keys in message order: when several fields fail, the first in this list is reported.
   */
  readonly keys: ReadonlyArray<keyof T & string>;
  /**
   * The message rule per key.
   */
  readonly rules: LlmModelConfigFieldRules<T>;
}

/**
 * Render a raw value for a `(got …)` clause.
 *
 * @param value - The raw value.
 * @returns Its JSON rendering; `undefined` and non-finite numbers by `String`.
 */
function llmModelConfigGotOf(value: unknown): string {
  return value === undefined || (typeof value === 'number' && !Number.isFinite(value)) ? String(value) : JSON.stringify(value);
}

/**
 * A copy of `value` without its `undefined`-valued keys, at the top level and inside each nested rule object — an
 * `undefined` value means "absent", as it always has for these parsers (arktype rejects an explicit `undefined`).
 *
 * @param value - The object.
 * @param rules - The rules, naming which keys are nested objects.
 * @returns The stripped copy.
 */
function stripLlmModelConfigUndefined(value: Readonly<Record<string, unknown>>, rules: Readonly<Record<string, LlmModelConfigFieldRule>>): Record<string, unknown> {
  const out = filterUndefinedValues({ ...value });

  for (const [key, rule] of Object.entries(rules)) {
    const nested = out[key];

    if (rule.fields != null && isPlainObject(nested)) {
      out[key] = stripLlmModelConfigUndefined(nested, rule.fields);
    }
  }

  return out;
}

/**
 * Validate an object's fields with an arktype type and report the FIRST failing field (by
 * {@link ParseLlmModelConfigFieldsConfig.keys} order) in the library's message format. Nested rule objects get their
 * unknown keys checked first.
 *
 * Library parsers assemble their own result from the returned value (canonical key order, trimming); an extension
 * can return it as-is.
 *
 * @param config - The labels, the object, the type, the key order and the rules.
 * @returns The validated value, typed by the arktype type.
 * @throws {Error} On an unknown nested key or the first failing field.
 */
export function parseLlmModelConfigFields<T extends object>(config: ParseLlmModelConfigFieldsConfig<T>): Type<T>['infer'] {
  const { schemaLabel, label, value, type, keys, rules } = config;
  const ruleMap: Readonly<Record<string, LlmModelConfigFieldRule>> = rules;
  const keyList: ReadonlyArray<string> = keys;

  for (const key of keyList) {
    const rule = ruleMap[key];
    const nested = value[key];

    if (rule.keys != null && isPlainObject(nested)) {
      assertLlmModelConfigKeys({ schemaLabel, label: `${label}.${key}`, entry: nested, allowed: rule.keys });
    }
  }

  const stripped = stripLlmModelConfigUndefined(value, ruleMap);
  const result = type(stripped);

  if (result instanceof ArkErrors) {
    const rank = (path: ReadonlyArray<PropertyKey>): [number, number] => {
      const first = keyList.indexOf(String(path[0]));
      const nestedKeys = ruleMap[String(path[0])]?.keys ?? [];
      return [first < 0 ? keyList.length : first, path.length > 1 ? nestedKeys.indexOf(String(path[1])) : -1];
    };

    const [error] = [...result].sort((a, b) => {
      const [a0, a1] = rank(a.path);
      const [b0, b1] = rank(b.path);
      return a0 - b0 || a1 - b1;
    });

    const key = String(error.path[0]);
    const rule: Maybe<LlmModelConfigFieldRule> = ruleMap[key];
    const nestedKey = error.path.length > 1 ? String(error.path[1]) : undefined;
    const nestedRule = nestedKey == null ? undefined : rule?.fields?.[nestedKey];
    const prefix = llmModelConfigMessagePrefix(schemaLabel);
    let message: string;

    if (rule == null) {
      message = `${prefix}${label} ${result.summary}`;
    } else if (nestedRule != null && nestedKey != null) {
      const raw = stripped[key];
      const got = isPlainObject(raw) ? raw[nestedKey] : undefined;
      message = `${prefix}${label}.${key}.${nestedKey} must ${nestedRule.must} (got ${llmModelConfigGotOf(got)}).${nestedRule.remedy ? ` ${nestedRule.remedy}` : ''}`;
    } else {
      message = `${prefix}${label}.${key} must ${rule.must} (got ${llmModelConfigGotOf(stripped[key])}).${rule.remedy ? ` ${rule.remedy}` : ''}`;
    }

    throw new Error(message);
  }

  return result;
}

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
const LLM_MODEL_SLUG_FIELD_RULE: LlmModelConfigFieldRule = { must: 'be a non-empty, trimmed model slug' };

/**
 * The rule for a token-count field.
 */
const LLM_TOKEN_COUNT_FIELD_RULE: LlmModelConfigFieldRule = { must: 'be a positive integer' };

/**
 * The messages for a reasoning block's fields.
 */
export const LLM_REASONING_CONFIG_FIELD_RULES: LlmModelConfigFieldRules<LlmReasoningConfig> = {
  effort: { must: `be one of ${LLM_REASONING_EFFORTS.join(', ')}` },
  maxTokens: LLM_TOKEN_COUNT_FIELD_RULE,
  exclude: { must: 'be a boolean' },
  enabled: { must: 'be a boolean' }
};

/**
 * The messages for the output controls.
 */
export const LLM_MODEL_OUTPUT_CONTROLS_FIELD_RULES: LlmModelConfigFieldRules<LlmModelOutputControls> = {
  maxOutputTokens: LLM_TOKEN_COUNT_FIELD_RULE,
  reasoning: { must: 'be an object', fields: LLM_REASONING_CONFIG_FIELD_RULES, keys: LLM_REASONING_CONFIG_KEYS }
};

/**
 * The messages for a model selection.
 */
export const LLM_MODEL_SELECTION_FIELD_RULES: LlmModelConfigFieldRules<LlmModelSelection> = {
  model: LLM_MODEL_SLUG_FIELD_RULE,
  tier: { must: 'be a non-blank tier key' }
};

/**
 * The messages for a provider reference.
 */
export const LLM_MODEL_PROVIDER_REF_FIELD_RULES: LlmModelConfigFieldRules<LlmModelProviderRef> = {
  provider: { must: 'be a non-blank provider name' }
};

/**
 * The messages for a rich tier config.
 */
export const LLM_MODEL_TIER_CONFIG_FIELD_RULES: LlmModelConfigFieldRules<LlmModelTierConfig> = {
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
export function llmReasoningConfigOf(reasoning: LlmReasoningConfig): LlmReasoningConfig {
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
export function llmModelOutputControlsOf(controls: LlmModelOutputControls): LlmModelOutputControls {
  const { maxOutputTokens, reasoning } = controls;
  return {
    ...(maxOutputTokens == null ? {} : { maxOutputTokens }),
    ...(reasoning == null ? {} : { reasoning: llmReasoningConfigOf(reasoning) })
  };
}
