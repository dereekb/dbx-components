/**
 * The **named-tier registry** — the map of open {@link LlmModelTierKey} handles → {@link LlmModelTierValue} that a
 * capability's (or a single dispatch's) `tier` resolves against. A capability names a TIER (`tier: 'strong'`), not a
 * raw slug, and the host declares what each tier means. The strategy still receives a concrete {@link LlmModelId} —
 * tiers live strictly ABOVE the transport.
 *
 * **Fail-loud, no silent fallback.** An unknown tier key throws at resolution: a typo'd `tier` on a descriptor or a
 * bad default-tier setting reddens a build or test rather than silently downgrading to the default model.
 *
 * **Growable value type.** A tier value is a bare slug OR a rich {@link LlmModelTierConfig} (`{ model,
 * maxOutputTokens?, reasoning? }`), and every reader goes through {@link llmTierModelOf} / {@link llmTierConfigOf}
 * (never the value directly), so widening the value touches only this module and the output-control reader.
 *
 * **No slugs.** The default KEYS (`fast`, `strong`, `off`) are library vocabulary; a slug never is. A host brings its
 * own base tier map ({@link ResolveLlmModelTiersConfig.base}).
 */

import { type Maybe } from '@dereekb/util';
import { type LlmModelId, type LlmModelTierConfig, type LlmModelTierKey, type LlmModelTierValue } from './llm.value';

/**
 * A COMPLETE, effective tier map — the resolved registry a dispatch resolves against. Use it for the resolved map
 * (after {@link resolveLlmModelTiers}); a host's raw (possibly partial) declaration uses
 * {@link LlmPartialModelTierMap}.
 */
export type LlmModelTierMap = Readonly<Record<LlmModelTierKey, LlmModelTierValue>>;

/**
 * A host's RAW (possibly partial) tier declaration — any subset of tier keys (`{ strong }` alone is valid), merged
 * over the host's base map by {@link resolveLlmModelTiers} to yield a complete {@link LlmModelTierMap}.
 */
export type LlmPartialModelTierMap = Readonly<Partial<Record<LlmModelTierKey, LlmModelTierValue>>>;

/**
 * The tier a capability or dispatch routes to when it names none — the cheap `fast` tier the frequent capabilities
 * run on.
 */
export const DEFAULT_LLM_MODEL_TIER: LlmModelTierKey = 'fast';

/**
 * The tier a DECODE-CLASS retry (a no-JSON / parse-error / truncated completion) escalates to when the host names
 * none — `strong`. Without a default, a decode retry re-asks the identical model with the identical prompt and
 * predictably gets the same undecodable reply: a full billed completion bought for nothing.
 *
 * Defaulting it is NECESSARY but not SUFFICIENT: a profile that pins `fast` and `strong` to the SAME slug makes an
 * "escalated" retry the identical model wearing a different label. The retry ladder catches that by comparing the
 * resolved escalation slug against the slug the attempt actually used, and moves a different lever instead.
 *
 * It resolves only when the host's map declares `strong`. The IMPLICIT default resolves DEFENSIVELY — a tier map
 * with no `strong` key yields no escalation rather than throwing — while an EXPLICIT host-set key still fails loud
 * through {@link resolveLlmModelTier}.
 */
export const DEFAULT_LLM_DECODE_RETRY_TIER: LlmModelTierKey = 'strong';

/**
 * The sentinel a host writes as its decode-retry tier to pin decode escalation OFF. Without it, defaulting the tier
 * would leave no way to say "re-ask the same model, on purpose".
 */
export const LLM_DECODE_RETRY_TIER_OFF = 'off';

/**
 * Normalize a tier VALUE → the concrete model slug — the single reader the value type hides behind. A bare slug is
 * itself; a config exposes its {@link LlmModelTierConfig.model}.
 *
 * @param value - The tier value (a bare slug or a rich config).
 * @returns The concrete model slug.
 */
export function llmTierModelOf(value: LlmModelTierValue): LlmModelId {
  return typeof value === 'string' ? value : value.model;
}

/**
 * Normalize a tier VALUE → its full {@link LlmModelTierConfig} — the output-control reader a dispatcher uses to pull
 * a tier's `maxOutputTokens` / `reasoning`. A bare-slug tier normalizes to `{ model }` (no output controls), a config
 * tier passes through unchanged.
 *
 * @param value - The tier value (a bare slug or a rich config).
 * @returns The tier config.
 */
export function llmTierConfigOf(value: LlmModelTierValue): LlmModelTierConfig {
  return typeof value === 'string' ? { model: value } : value;
}

/**
 * Resolve a tier KEY → model slug against a tier map. FAILS LOUD on an unknown key, so a typo'd tier is a red build
 * or test, not a silent fallback.
 *
 * @param tiers - The active tier map.
 * @param key - The tier key to resolve.
 * @returns The concrete model slug.
 * @throws {Error} When `key` is not present in `tiers`.
 */
export function resolveLlmModelTier(tiers: LlmModelTierMap, key: LlmModelTierKey): LlmModelId {
  return llmTierModelOf(resolveLlmModelTierValue(tiers, key));
}

/**
 * Resolve a tier KEY → its full {@link LlmModelTierValue} against a tier map — the fail-loud sibling of
 * {@link resolveLlmModelTier} that keeps the config (not just the slug), so a dispatcher can read the tier's
 * `maxOutputTokens` / `reasoning` output controls.
 *
 * @param tiers - The active tier map.
 * @param key - The tier key to resolve.
 * @returns The tier value (a bare slug or a rich config).
 * @throws {Error} When `key` is not present in `tiers`.
 */
export function resolveLlmModelTierValue(tiers: LlmModelTierMap, key: LlmModelTierKey): LlmModelTierValue {
  const value = tiers[key] as Maybe<LlmModelTierValue>;

  if (value == null) {
    const keys = Object.keys(tiers);
    throw new Error(`unknown model tier '${key}' (have: ${keys.length === 0 ? '(none)' : keys.join(', ')}).`);
  }

  return value;
}

/**
 * Config for {@link resolveLlmModelTiers}.
 */
export interface ResolveLlmModelTiersConfig {
  /**
   * The host's built-in tier map, the floor every declaration merges over. The library ships no slugs, so a host
   * that wants `fast` to resolve without declaring it passes its own base here.
   */
  readonly base?: Maybe<LlmPartialModelTierMap>;
  /**
   * The host's tier declaration, merged OVER {@link base} (arbitrary keys allowed, any subset).
   */
  readonly modelTiers?: Maybe<LlmPartialModelTierMap>;
  /**
   * Which tier is the default (the model a tier-less / model-less call routes to); omitted ⇒
   * {@link DEFAULT_LLM_MODEL_TIER} (`fast`).
   */
  readonly defaultTier?: Maybe<LlmModelTierKey>;
}

/**
 * The resolved tier registry — the effective tier map and the resolved default tier.
 */
export interface LlmResolvedModelTiers {
  /**
   * The effective tier map (the base with the host's declaration merged on top).
   */
  readonly tiers: LlmModelTierMap;
  /**
   * The resolved default tier key.
   */
  readonly defaultTier: LlmModelTierKey;
}

/**
 * Merge a host's declared tiers OVER its base map and resolve the default tier — the one place a host turns its
 * optional tier settings into the effective registry. Fails loud when the default tier does not resolve in the merged
 * map (a bad default-tier setting is a config error, not a fallback).
 *
 * @param config - The base map, the host's declaration and the default-tier override.
 * @returns The effective tier map and resolved default tier.
 * @throws {Error} When the resolved default tier is not present in the merged map.
 */
export function resolveLlmModelTiers(config: ResolveLlmModelTiersConfig): LlmResolvedModelTiers {
  // Merge explicitly (not a spread) so an OPTIONAL key never poisons the complete map's value type with `undefined`.
  const merged: Record<LlmModelTierKey, LlmModelTierValue> = {};

  for (const layer of [config.base, config.modelTiers]) {
    if (layer != null) {
      for (const [key, value] of Object.entries(layer)) {
        if (value != null) {
          merged[key] = value;
        }
      }
    }
  }

  const tiers: LlmModelTierMap = merged;
  const defaultTier = config.defaultTier ?? DEFAULT_LLM_MODEL_TIER;
  resolveLlmModelTier(tiers, defaultTier);
  return { tiers, defaultTier };
}
