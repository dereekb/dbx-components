/**
 * Axis-value derivation for the matched archetype.
 *
 * The recommender's output prints the *resolved* axes for the matched
 * archetype (e.g. `single-item-sub.subPurpose=private`,
 * `denormalised-aggregate.keying=bucket-code`). The derivation lives here so
 * the recommender, the lookup tool, and the heuristic extractor can all use
 * one rule set.
 */

import type { ModelArchetypeInfo } from '../../registry/archetypes.js';
import type { ArchetypeQuestionnaire } from './types.js';

/**
 * Resolved axis-value map for a matched archetype, e.g.
 * `{ subPurpose: 'private' }` for `single-item-sub`.
 */
export type ResolvedAxes = { readonly [axisName: string]: string };

/**
 * Sibling map carrying *alternative* axis values that the questionnaire could
 * legitimately also resolve to. Surfaced when the recommender wants to flag a
 * choice rather than silently picking one.
 *
 * Currently populated for `denormalised-aggregate` under a user-keyed sub
 * where both `keying: 'bucket-code'` and `keying: 'composite-flat-key'` are
 * valid (see planning doc `§8.6`).
 */
export type ResolvedAxisAlternatives = { readonly [axisName: string]: readonly string[] };

/**
 * Derives axis values from the questionnaire for the matched archetype.
 *
 * Rules:
 *   - `single-item-sub.subPurpose` is derived from `hasSensitiveFields`,
 *     `needsFineGrainedPermissions`, `aggregatesFrom`, `needsMemberSummary`.
 *   - `denormalised-aggregate.keying` mirrors `docIdSource`.
 *   - `denormalised-aggregate.syncMode` mirrors `syncMode`.
 *   - `reference-registry.hasInheritance` mirrors `hasInheritance`.
 *
 * Unknown axes are left out; callers fall back to "(not resolved)" in the
 * markdown output.
 *
 * @param archetype - The matched archetype catalog entry.
 * @param q - The caller's filled questionnaire.
 * @returns The resolved axes map, possibly empty.
 */
export function deriveAxes(archetype: ModelArchetypeInfo, q: ArchetypeQuestionnaire): ResolvedAxes {
  const axes: { [axisName: string]: string } = {};
  switch (archetype.slug) {
    case 'single-item-sub': {
      const subPurpose = deriveSingleItemSubPurpose(q);
      if (subPurpose) axes.subPurpose = subPurpose;
      break;
    }
    case 'denormalised-aggregate': {
      if (q.docIdSource && ['parent-id', 'bucket-code', 'composite-flat-key', 'numeric-short-id'].includes(q.docIdSource)) {
        axes.keying = q.docIdSource;
      }
      if (q.syncMode && ['trigger-eventual', 'flag-eventual', 'scheduled-rebuild'].includes(q.syncMode)) {
        axes.syncMode = q.syncMode;
      }
      break;
    }
    case 'reference-registry': {
      if (q.hasInheritance !== undefined) axes.hasInheritance = String(q.hasInheritance);
      break;
    }
    default:
      // No axes to derive.
      break;
  }
  return axes;
}

function deriveSingleItemSubPurpose(q: ArchetypeQuestionnaire): string | undefined {
  let result: string | undefined;
  if (q.needsMemberSummary === true) {
    result = 'member-summary';
  } else if ((q.aggregatesFrom?.length ?? 0) > 0 || q.isDenormalization === true) {
    result = 'summary';
  } else if (q.needsFineGrainedPermissions === true) {
    result = 'permission';
  } else if (q.hasSensitiveFields === true) {
    result = 'private';
  } else if (q.hasLifecycleStates === true) {
    result = 'state';
  } else {
    result = 'config';
  }
  return result;
}

/**
 * Returns axis values the questionnaire could *also* legitimately resolve to
 * for the matched archetype. The recommender uses this to flag ambiguous
 * choices instead of silently picking one.
 *
 * Today this fires for `denormalised-aggregate` under a user-keyed sub where
 * the doc id can be either a `bucket-code` (e.g. `<YearWeekCode>`) or a
 * `composite-flat-key` (e.g. `<uid>_<yearweek>`). The recommender's `axes`
 * holds the questionnaire's stated `docIdSource`; this function returns the
 * other valid option so the Shape block renders both.
 *
 * @param archetype - The matched archetype catalog entry.
 * @param q - The caller's filled questionnaire.
 * @returns The alternative axis-value map, possibly empty.
 */
export function deriveAxisAlternatives(archetype: ModelArchetypeInfo, q: ArchetypeQuestionnaire): ResolvedAxisAlternatives {
  const alternatives: { [axisName: string]: string[] } = {};
  if (archetype.slug === 'denormalised-aggregate' && q.parentRelation === 'user-uid') {
    if (q.docIdSource === 'bucket-code') {
      alternatives.keying = ['composite-flat-key'];
    } else if (q.docIdSource === 'composite-flat-key') {
      alternatives.keying = ['bucket-code'];
    }
  }
  return alternatives;
}

/**
 * Field-level add-on detection. Returns the add-on slugs the questionnaire
 * triggers — surfaced on the recommender's "Field-level add-ons" line.
 *
 * @param q - The caller's filled questionnaire.
 * @returns The add-on slugs in priority order.
 */
export function deriveAddons(q: ArchetypeQuestionnaire): readonly string[] {
  const addons: string[] = [];
  if (q.hasLifecycleStates === true) addons.push('state-machine-item');
  if (q.alwaysReadWithParent === true && (q.estimatedItemsPerParent === '0-50' || q.estimatedItemsPerParent === 'unknown')) {
    addons.push('embedded-sub-objects');
  }
  if (q.hasArchiveCounterpart === true) addons.push('active-vs-archive-split');
  // single-item-sub:private add-on (sensitive fields on a *non* single-item-sub primary)
  if (q.hasSensitiveFields === true) addons.push('single-item-sub:private');
  return addons;
}
