/**
 * Equivalence helpers for `dbx_color_smell_check`.
 *
 * Two color literals are considered duplicates when their normalised
 * signatures match. The `exact` mode preserves whatever the author wrote;
 * `normalized` collapses casing, expands short hex, and applies the same
 * defaults the directive does at runtime.
 */

import type { NormalizedColorConfig } from './types.js';

/**
 * Equivalence mode controlling how aggressively literals are collapsed
 * before grouping.
 *
 * - `exact` — preserve every field as written (no casing or hex changes).
 * - `normalized` — lowercase hex values, expand `#fff` to `#ffffff`, and
 *   treat missing `tone` / `tonal` fields as the directive defaults.
 */
export type ColorSmellEquivalenceMode = 'exact' | 'normalized';

/**
 * Default value applied to `tone` when normalising a literal that omits
 * it. Matches the runtime default the directive uses for opaque colors.
 */
export const DEFAULT_NORMALIZED_TONE = 100;

/**
 * Default value applied to `tonal` when normalising a literal that omits
 * it. The directive treats missing `tonal` as `false`.
 */
export const DEFAULT_NORMALIZED_TONAL = false;

/**
 * Normalises a raw literal's fields according to {@link mode}. Returns
 * the same shape used to compute the grouping signature so callers can
 * stash the normalised view on the finding for display.
 *
 * @param raw - The as-authored color config (subset that the parser captured)
 * @param mode - Equivalence mode controlling default expansion.
 * @returns The normalised config used for signature comparison.
 */
export function normalizeColorConfig(raw: NormalizedColorConfig, mode: ColorSmellEquivalenceMode): NormalizedColorConfig {
  const result: { -readonly [K in keyof NormalizedColorConfig]: NormalizedColorConfig[K] } = {};
  if (raw.color !== undefined) result.color = normalizeColorString(raw.color, mode);
  if (raw.contrast !== undefined) result.contrast = normalizeColorString(raw.contrast, mode);
  if (mode === 'normalized') {
    result.tone = raw.tone ?? DEFAULT_NORMALIZED_TONE;
    result.tonal = raw.tonal ?? DEFAULT_NORMALIZED_TONAL;
  } else {
    if (raw.tone !== undefined) result.tone = raw.tone;
    if (raw.tonal !== undefined) result.tonal = raw.tonal;
  }
  return result;
}

/**
 * Builds the deterministic signature string used for grouping. The
 * signature is stable across runs because the keys are sorted and
 * undefined fields are omitted.
 *
 * @param normalized - The normalised config produced by {@link normalizeColorConfig}
 * @returns The signature string (`color=#ff0066|contrast=white|tone=100|tonal=false`)
 */
export function signatureFor(normalized: NormalizedColorConfig): string {
  const parts: string[] = [];
  if (normalized.color !== undefined) parts.push(`color=${normalized.color}`);
  if (normalized.contrast !== undefined) parts.push(`contrast=${normalized.contrast}`);
  if (normalized.tone !== undefined) parts.push(`tone=${normalized.tone}`);
  if (normalized.tonal !== undefined) parts.push(`tonal=${normalized.tonal}`);
  return parts.join('|');
}

function normalizeColorString(value: string, mode: ColorSmellEquivalenceMode): string {
  let result = value.trim();
  if (mode === 'normalized') {
    result = result.toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(result)) {
      result = `#${result[1]}${result[1]}${result[2]}${result[2]}${result[3]}${result[3]}`;
    } else if (/^#[0-9a-f]{4}$/.test(result)) {
      result = `#${result[1]}${result[1]}${result[2]}${result[2]}${result[3]}${result[3]}${result[4]}${result[4]}`;
    }
  }
  return result;
}
