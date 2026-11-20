/**
 * The PURE validator for a host's declared tier values — the one parser behind every untrusted tier declaration,
 * whichever surface it arrived on: an env var holding tier JSON, a model config file profile
 * (`parseLlmModelConfigFile`), or a future settings block. Each caller passes the `label` its own errors should
 * name, so one implementation produces a message that points at the surface the operator actually edited.
 *
 * Reads NO environment and touches NO filesystem — a host resolves the raw JSON and hands it here.
 *
 * FAIL-LOUD by design. A typo like `maxTokens` for the tier-level `maxOutputTokens`, or a `reasoning.effort` band that
 * is not one of the three, reddens startup rather than being silently dropped — a tier that quietly lost its output
 * cap bills a run at the wrong ceiling and nothing says so.
 */

import { assertObjectKeys, parseArktypeFieldsWithMessages, schemaLabelMessagePrefix } from '@dereekb/model';
import { isPlainObject, type Maybe } from '@dereekb/util';
import { ArkErrors } from 'arktype';
import { LLM_MODEL_TIER_CONFIG_FIELD_RULES, LLM_MODEL_TIER_CONFIG_KEYS, toCanonicalLlmModelOutputControls } from './llm.model.field';
import { llmModelSlugType, llmModelTierConfigType } from './llm.model.type';
import { type LlmModelTierConfig, type LlmModelTierKey, type LlmModelTierValue } from './llm.value';

/**
 * Config for {@link parseLlmModelTierValue}.
 */
export interface ParseLlmModelTierValueConfig {
  /**
   * The schema label every message is prefixed with (`llm models: …`) — set when the value sits inside a labelled
   * config file. Omitted ⇒ no prefix (an env var name is its own surface).
   */
  readonly schemaLabel?: Maybe<string>;
  /**
   * What the error messages name as the SURFACE the bad value came from — an env var name, or a file and profile
   * (`models.json profiles['free']`), so an operator is told which thing to go edit.
   */
  readonly label: string;
  /**
   * The tier key this value is declared under (named in the error message).
   */
  readonly tierKey: LlmModelTierKey;
  /**
   * The candidate value — a bare model-slug string or a rich `{ model, maxOutputTokens?, reasoning? }` object.
   */
  readonly value: unknown;
}

/**
 * Parse and validate ONE tier value — a bare model-slug string OR a rich `{ model, maxOutputTokens?, reasoning? }`
 * config. FAIL-LOUD on a blank or untrimmed slug (a slug is matched exactly, never trimmed), an unknown config key, a
 * missing `model`, a token cap that is not a positive integer (`maxOutputTokens`, `reasoning.maxTokens`), or a
 * malformed `reasoning` block.
 *
 * @param config - The labels and tier key for the error message, and the candidate value.
 * @returns The parsed {@link LlmModelTierValue}; a config value is re-assembled in canonical key order.
 * @throws {Error} When the value shape is invalid.
 */
export function parseLlmModelTierValue(config: ParseLlmModelTierValueConfig): LlmModelTierValue {
  const { schemaLabel, label, tierKey, value } = config;
  const at = `${label}['${tierKey}']`;
  const prefix = schemaLabelMessagePrefix(schemaLabel);
  let out: LlmModelTierValue;

  if (typeof value === 'string') {
    const slug = llmModelSlugType(value);

    if (slug instanceof ArkErrors) {
      throw new TypeError(`${prefix}${at} must be a non-empty, trimmed model slug (got ${JSON.stringify(value)}).`);
    }

    out = slug;
  } else if (isPlainObject(value)) {
    assertObjectKeys({ schemaLabel, label: at, entry: value, allowed: LLM_MODEL_TIER_CONFIG_KEYS });
    const parsed = parseArktypeFieldsWithMessages({ schemaLabel, label: at, value, type: llmModelTierConfigType, keys: LLM_MODEL_TIER_CONFIG_KEYS, rules: LLM_MODEL_TIER_CONFIG_FIELD_RULES });
    const tierConfig: LlmModelTierConfig = { model: parsed.model, ...toCanonicalLlmModelOutputControls(parsed) };
    out = tierConfig;
  } else {
    throw new Error(`${prefix}${at} must be a non-empty, trimmed model slug or a { model, maxOutputTokens?, reasoning? } object (got ${JSON.stringify(value)}).`);
  }

  return out;
}

/**
 * Config for {@link parseLlmModelTierMap}.
 */
export interface ParseLlmModelTierMapConfig {
  /**
   * The schema label every message is prefixed with ({@link ParseLlmModelTierValueConfig.schemaLabel}).
   */
  readonly schemaLabel?: Maybe<string>;
  /**
   * What the error messages name as the surface the map came from ({@link ParseLlmModelTierValueConfig.label}).
   */
  readonly label: string;
  /**
   * The candidate `{ tierKey: value }` object.
   */
  readonly value: unknown;
}

/**
 * Parse and validate a whole `{ tierKey: modelSlug | config }` object — the shape both an env var's tier JSON and one
 * model config file profile carry. FAIL-LOUD on a non-object top level or any malformed entry.
 *
 * @param config - The label for the error messages, and the candidate object.
 * @returns The parsed tier map (empty when the object declared no keys).
 * @throws {Error} When the top level is not a JSON object, or any value is malformed.
 */
export function parseLlmModelTierMap(config: ParseLlmModelTierMapConfig): Record<LlmModelTierKey, LlmModelTierValue> {
  const { schemaLabel, label, value } = config;

  if (!isPlainObject(value)) {
    throw new Error(`${schemaLabelMessagePrefix(schemaLabel)}${label} must be a JSON object of { tierKey: modelSlug | { model, maxOutputTokens?, reasoning? } }.`);
  }

  const out: Record<LlmModelTierKey, LlmModelTierValue> = {};

  for (const [tierKey, entry] of Object.entries(value)) {
    out[tierKey] = parseLlmModelTierValue({ schemaLabel, label, tierKey, value: entry });
  }

  return out;
}
