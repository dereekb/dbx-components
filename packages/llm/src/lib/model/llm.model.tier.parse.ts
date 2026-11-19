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

import { type LlmModelTierConfig, type LlmModelTierKey, type LlmModelTierValue, type LlmReasoningConfig } from './llm.value';
import { isPlainObject } from '@dereekb/util';

/**
 * The keys a rich tier CONFIG value (the object arm of a tier entry) may carry — an unknown key fails loud.
 */
const LLM_MODEL_TIER_CONFIG_KEYS: ReadonlySet<string> = new Set(['model', 'maxOutputTokens', 'reasoning']);

/**
 * The keys a tier config's `reasoning` block may carry (unknown ⇒ fail loud).
 */
const LLM_REASONING_CONFIG_KEYS: ReadonlySet<string> = new Set(['effort', 'maxTokens', 'exclude', 'enabled']);

/**
 * The allowed `reasoning.effort` bands.
 */
const LLM_REASONING_EFFORT_BANDS: ReadonlySet<string> = new Set(['low', 'medium', 'high']);

/**
 * Config for {@link parseLlmModelTierValue}.
 */
export interface ParseLlmModelTierValueConfig {
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
 * Input to {@link parseLlmTierReasoning}.
 */
interface ParseLlmTierReasoningInput {
  readonly label: string;
  readonly tierKey: LlmModelTierKey;
  readonly raw: Readonly<Record<string, unknown>>;
}

/**
 * Parse and validate a tier config's `reasoning` block — FAIL-LOUD on an unknown key, a bad `effort` band, a
 * non-positive `maxTokens`, or a non-boolean `exclude` / `enabled`.
 *
 * @param input - The label and tier key for the error message, and the candidate reasoning object.
 * @returns The validated {@link LlmReasoningConfig}.
 * @throws {Error} When any field is malformed.
 */
function parseLlmTierReasoning(input: ParseLlmTierReasoningInput): LlmReasoningConfig {
  const { label, tierKey, raw } = input;
  const at = `${label}['${tierKey}'].reasoning`;

  for (const key of Object.keys(raw)) {
    if (!LLM_REASONING_CONFIG_KEYS.has(key)) {
      throw new Error(`${at} has unknown key '${key}' (allowed: ${Array.from(LLM_REASONING_CONFIG_KEYS).join(', ')}).`);
    }
  }

  const effort = raw['effort'];

  if (effort !== undefined && (typeof effort !== 'string' || !LLM_REASONING_EFFORT_BANDS.has(effort))) {
    throw new Error(`${at}.effort must be one of ${Array.from(LLM_REASONING_EFFORT_BANDS).join(' | ')}.`);
  }

  const maxTokens = raw['maxTokens'];

  if (maxTokens !== undefined && (typeof maxTokens !== 'number' || !Number.isFinite(maxTokens) || maxTokens <= 0)) {
    throw new Error(`${at}.maxTokens must be a positive number.`);
  }

  const exclude = raw['exclude'];

  if (exclude !== undefined && typeof exclude !== 'boolean') {
    throw new Error(`${at}.exclude must be a boolean.`);
  }

  const enabled = raw['enabled'];

  if (enabled !== undefined && typeof enabled !== 'boolean') {
    throw new Error(`${at}.enabled must be a boolean.`);
  }

  return {
    ...(effort === undefined ? {} : { effort: effort as LlmReasoningConfig['effort'] }),
    ...(maxTokens === undefined ? {} : { maxTokens }),
    ...(exclude === undefined ? {} : { exclude }),
    ...(enabled === undefined ? {} : { enabled })
  };
}

/**
 * Parse and validate ONE tier value — a bare model-slug string OR a rich `{ model, maxOutputTokens?, reasoning? }`
 * config. FAIL-LOUD on an empty slug, an unknown config key, a missing / empty `model`, a non-positive
 * `maxOutputTokens`, or a malformed `reasoning` block.
 *
 * @param config - The label and tier key for the error message, and the candidate value.
 * @returns The parsed {@link LlmModelTierValue}.
 * @throws {Error} When the value shape is invalid.
 */
export function parseLlmModelTierValue(config: ParseLlmModelTierValueConfig): LlmModelTierValue {
  const { label, tierKey, value } = config;
  const at = `${label}['${tierKey}']`;
  let out: LlmModelTierValue;

  if (typeof value === 'string') {
    if (value.length === 0) {
      throw new Error(`${at} must be a non-empty model-slug string.`);
    }

    out = value;
  } else if (isPlainObject(value)) {
    const obj = value;

    for (const key of Object.keys(obj)) {
      if (!LLM_MODEL_TIER_CONFIG_KEYS.has(key)) {
        throw new Error(`${at} has unknown key '${key}' (allowed: ${Array.from(LLM_MODEL_TIER_CONFIG_KEYS).join(', ')}).`);
      }
    }

    const model = obj['model'];

    if (typeof model !== 'string' || model.length === 0) {
      throw new Error(`${at}.model must be a non-empty model-slug string.`);
    }

    const maxOutputTokens = obj['maxOutputTokens'];

    if (maxOutputTokens !== undefined && (typeof maxOutputTokens !== 'number' || !Number.isFinite(maxOutputTokens) || maxOutputTokens <= 0)) {
      throw new Error(`${at}.maxOutputTokens must be a positive number.`);
    }

    const rawReasoning = obj['reasoning'];

    if (rawReasoning !== undefined && !isPlainObject(rawReasoning)) {
      throw new Error(`${at}.reasoning must be an object.`);
    }

    const reasoning = rawReasoning === undefined ? undefined : parseLlmTierReasoning({ label, tierKey, raw: rawReasoning as Record<string, unknown> });
    const tierConfig: LlmModelTierConfig = { model, ...(maxOutputTokens === undefined ? {} : { maxOutputTokens }), ...(reasoning === undefined ? {} : { reasoning }) };
    out = tierConfig;
  } else {
    throw new Error(`${at} must be a non-empty model-slug string or a { model, maxOutputTokens?, reasoning? } object.`);
  }

  return out;
}

/**
 * Config for {@link parseLlmModelTierMap}.
 */
export interface ParseLlmModelTierMapConfig {
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
  const { label, value } = config;

  if (!isPlainObject(value)) {
    throw new Error(`${label} must be a JSON object of { tierKey: modelSlug | { model, maxOutputTokens?, reasoning? } }.`);
  }

  const out: Record<LlmModelTierKey, LlmModelTierValue> = {};

  for (const [tierKey, entry] of Object.entries(value)) {
    out[tierKey] = parseLlmModelTierValue({ label, tierKey, value: entry });
  }

  return out;
}
