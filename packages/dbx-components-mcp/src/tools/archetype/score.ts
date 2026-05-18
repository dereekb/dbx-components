/**
 * Pure scoring core for the model-archetype recommender.
 *
 * Given a {@link ArchetypeQuestionnaire} and the {@link MODEL_ARCHETYPES} catalog,
 * produces a ranked list of {@link ScoredArchetype} entries with confidence,
 * matched-dimension breakdowns, and short-circuit detection for framework
 * archetypes. No I/O; deterministic; easy to test.
 *
 * Weighting algorithm summary (mirrors `§5.2`):
 *   - `docIdSource`: 3 (top-tier discriminator)
 *   - `parentRelation`: 3
 *   - `syncMode`: 3
 *   - `isDenormalization` / `isExternalMirror` / `isEventLog` / `hasInheritance`: 2
 *     - `isEventLog` bumps to 3 when `mutability='immutable'` AND `syncMode='append-only'`
 *   - `userRelation`: 2
 *   - `aggregatesFrom non-empty + isSiblingAggregate=true`: 3
 *   - `hasLifecycleStates` / `hasSensitiveFields` / `needsFineGrainedPermissions`
 *     / `hasArchiveCounterpart`: 1
 *   - `involvesFileUpload` / `sendsMessageToUser` / `isMultiCheckpointWorkflow`
 *     / `isSubsystemSingleton`: hard match (framework / singleton short-circuit)
 *
 * Mismatch on a 2+ weight subtracts the weight. Unset answers contribute zero.
 */

import { MODEL_ARCHETYPES, type ModelArchetypeInfo, type ModelArchetypeSlug } from '../../registry/archetypes.js';
import type { ArchetypeQuestionnaire } from './types.js';

/**
 * Per-dimension scoring breakdown for one archetype.
 */
export interface ScoredArchetypeMatch {
  readonly dimension: string;
  readonly weight: number;
  readonly contribution: number;
  readonly note: string;
}

/**
 * One archetype's score against the questionnaire.
 */
export interface ScoredArchetype {
  readonly archetype: ModelArchetypeInfo;
  readonly score: number;
  readonly maxScore: number;
  readonly confidence: number;
  readonly matches: readonly ScoredArchetypeMatch[];
  readonly mismatches: readonly ScoredArchetypeMatch[];
  readonly shortCircuited: boolean;
}

/**
 * Result of running the scorer across the full catalog.
 *
 * - `ranked`: every archetype sorted descending by score.
 * - `top`: the highest-scoring archetype.
 * - `tied`: secondary tied archetypes within `0.10` of `top.confidence`.
 *   Empty when no ties exist.
 */
export interface ScoreCatalogResult {
  readonly ranked: readonly ScoredArchetype[];
  readonly top: ScoredArchetype;
  readonly tied: readonly ScoredArchetype[];
  readonly shortCircuited: boolean;
}

/**
 * Slugs that take a hard-match shortcut. When the corresponding questionnaire
 * flag is `true`, scoring returns the framework archetype outright with
 * confidence `1.0`.
 */
const FRAMEWORK_SHORT_CIRCUITS: { readonly flag: keyof ArchetypeQuestionnaire; readonly slug: ModelArchetypeSlug }[] = [
  { flag: 'isMultiCheckpointWorkflow', slug: 'notification-task' },
  { flag: 'isSubsystemSingleton', slug: 'system-state-singleton' },
  { flag: 'involvesFileUpload', slug: 'storagefile-purpose' },
  { flag: 'sendsMessageToUser', slug: 'notification-template' }
];

/**
 * Special root-singleton-aggregate combo: `aggregatesFrom` non-empty +
 * `isSiblingAggregate=true` + `docIdSource='fixed'` → strong push toward
 * `root-singleton-aggregate`. Implemented as a soft +3 boost in the scorer
 * rather than a hard short-circuit so the user-keyed cases still get a chance
 * to win when the docIdSource disagrees.
 */
const ROOT_SINGLETON_AGGREGATE_BOOST_SLUG: ModelArchetypeSlug = 'root-singleton-aggregate';

interface DimensionScoreInput {
  readonly dimension: string;
  readonly weight: number;
  readonly answer: unknown;
  readonly expected: readonly unknown[] | undefined;
}

function scoreDimension(input: DimensionScoreInput): ScoredArchetypeMatch | undefined {
  let result: ScoredArchetypeMatch | undefined;
  const { dimension, weight, answer, expected } = input;
  if (answer === undefined || answer === null) return undefined;
  if (!expected || expected.length === 0) return undefined;
  const answerLabel = JSON.stringify(answer);
  if (expected.includes(answer)) {
    result = {
      dimension,
      weight,
      contribution: weight,
      note: `answer \`${answerLabel}\` matched expected ${JSON.stringify(expected)}`
    };
  } else if (weight >= 2) {
    // Mismatch on a 2+-weight dimension subtracts the weight.
    result = {
      dimension,
      weight,
      contribution: -weight,
      note: `answer \`${answerLabel}\` did not match expected ${JSON.stringify(expected)}`
    };
  }
  return result;
}

interface BoolDimensionScoreInput {
  readonly dimension: string;
  readonly weight: number;
  readonly answer: boolean | undefined;
  readonly expected: boolean | undefined;
}

function scoreBoolDimension(input: BoolDimensionScoreInput): ScoredArchetypeMatch | undefined {
  let result: ScoredArchetypeMatch | undefined;
  const { dimension, weight, answer, expected } = input;
  if (answer === undefined) return undefined;
  if (expected === undefined) return undefined;
  if (answer === expected) {
    result = { dimension, weight, contribution: weight, note: `${dimension}=${expected} (match)` };
  } else if (weight >= 2) {
    result = { dimension, weight, contribution: -weight, note: `${dimension}: answered ${answer}, expected ${expected}` };
  }
  return result;
}

/**
 * Scores one archetype against the questionnaire.
 *
 * @param archetype - The archetype catalog entry to score.
 * @param q - The caller's filled questionnaire.
 * @returns A {@link ScoredArchetype} carrying the breakdown.
 */
export function scoreArchetypeAgainstQuestionnaire(archetype: ModelArchetypeInfo, q: ArchetypeQuestionnaire): ScoredArchetype {
  const matches: ScoredArchetypeMatch[] = [];
  const mismatches: ScoredArchetypeMatch[] = [];
  let score = 0;
  let maxScore = 0;

  const tally = (m: ScoredArchetypeMatch | undefined): void => {
    if (!m) return;
    if (m.contribution > 0) matches.push(m);
    else mismatches.push(m);
    score += m.contribution;
    maxScore += m.weight;
  };

  // 3-weight dimensions
  tally(scoreDimension({ dimension: 'docIdSource', weight: 3, answer: q.docIdSource, expected: archetype.expected.docIdSource }));
  tally(scoreDimension({ dimension: 'parentRelation', weight: 3, answer: q.parentRelation, expected: archetype.expected.parentRelation }));
  // syncMode special case: event log gets weight 3 when paired with immutable + append-only
  const isEventLogCombo = archetype.slug === 'audit-log' && q.mutability === 'immutable' && q.syncMode === 'append-only';
  tally(scoreDimension({ dimension: 'syncMode', weight: 3, answer: q.syncMode, expected: archetype.expected.syncMode }));

  // 2-weight dimensions
  tally(scoreDimension({ dimension: 'userRelation', weight: 2, answer: q.userRelation, expected: archetype.expected.userRelation }));
  tally(scoreBoolDimension({ dimension: 'isDenormalization', weight: 2, answer: q.isDenormalization, expected: archetype.expected.isDenormalization }));
  tally(scoreBoolDimension({ dimension: 'isExternalMirror', weight: 2, answer: q.isExternalMirror, expected: archetype.expected.isExternalMirror }));
  // isEventLog: weight 3 when the immutable + append-only combo holds and archetype is audit-log
  const isEventLogWeight = isEventLogCombo ? 3 : 2;
  tally(scoreBoolDimension({ dimension: 'isEventLog', weight: isEventLogWeight, answer: q.isEventLog, expected: archetype.expected.isEventLog }));
  tally(scoreBoolDimension({ dimension: 'hasInheritance', weight: 2, answer: q.hasInheritance, expected: archetype.expected.hasInheritance }));
  tally(scoreBoolDimension({ dimension: 'isGroupRoot', weight: 2, answer: q.isGroupRoot, expected: archetype.expected.isGroupRoot }));
  tally(scoreBoolDimension({ dimension: 'isTreeNode', weight: 2, answer: q.isTreeNode, expected: archetype.expected.isTreeNode }));

  // 1-weight dimensions
  tally(scoreBoolDimension({ dimension: 'hasLifecycleStates', weight: 1, answer: q.hasLifecycleStates, expected: archetype.expected.hasLifecycleStates }));
  tally(scoreBoolDimension({ dimension: 'hasSensitiveFields', weight: 1, answer: q.hasSensitiveFields, expected: archetype.expected.hasSensitiveFields }));
  tally(scoreBoolDimension({ dimension: 'needsFineGrainedPermissions', weight: 1, answer: q.needsFineGrainedPermissions, expected: archetype.expected.needsFineGrainedPermissions }));
  tally(scoreBoolDimension({ dimension: 'hasArchiveCounterpart', weight: 1, answer: q.hasArchiveCounterpart, expected: archetype.expected.hasArchiveCounterpart }));

  // instancesPerParent
  tally(scoreDimension({ dimension: 'instancesPerParent', weight: 2, answer: q.instancesPerParent, expected: archetype.expected.instancesPerParent }));

  // mutability
  tally(scoreDimension({ dimension: 'mutability', weight: 1, answer: q.mutability, expected: archetype.expected.mutability }));

  // Root-singleton-aggregate boost: decisive when aggregatesFrom non-empty + isSiblingAggregate=true
  if (archetype.slug === ROOT_SINGLETON_AGGREGATE_BOOST_SLUG) {
    const aggregatesFromNonEmpty = (q.aggregatesFrom?.length ?? 0) > 0;
    if (aggregatesFromNonEmpty && q.isSiblingAggregate === true) {
      const note = 'aggregatesFrom non-empty + isSiblingAggregate=true (decisive for root-singleton-aggregate)';
      const m: ScoredArchetypeMatch = { dimension: 'aggregatesFrom+isSiblingAggregate', weight: 3, contribution: 3, note };
      matches.push(m);
      score += 3;
      maxScore += 3;
    }
  }

  // Framework / singleton short-circuits — when the questionnaire flag is true, the archetype
  // wins outright with confidence 1.0.
  const shortCircuit = FRAMEWORK_SHORT_CIRCUITS.find((sc) => sc.slug === archetype.slug && q[sc.flag] === true);
  let shortCircuited = false;
  if (shortCircuit) {
    shortCircuited = true;
    score = Math.max(score, 100);
    maxScore = Math.max(maxScore, 100);
  }

  const confidence = maxScore > 0 ? Math.round((score / maxScore) * 100) / 100 : 0;
  return { archetype, score, maxScore, confidence, matches, mismatches, shortCircuited };
}

/**
 * Scores every archetype in the catalog against the questionnaire and ranks
 * them. Add-on archetypes (`state-machine-item`, `embedded-sub-objects`,
 * `active-vs-archive-split`) are excluded from the primary ranking — they are
 * returned separately by the recommender.
 *
 * @param q - The caller's filled questionnaire.
 * @returns The ranked list of scored archetypes.
 */
export function scoreCatalog(q: ArchetypeQuestionnaire): ScoreCatalogResult {
  // Pre-check for framework short-circuits — when one fires, only the matching archetype is
  // surfaced as the top result, but we still rank everything for comparison.
  const candidates = MODEL_ARCHETYPES.filter((a) => a.family !== 'addon');
  const scored = candidates.map((a) => scoreArchetypeAgainstQuestionnaire(a, q));
  const ranked = [...scored].sort((a, b) => b.confidence - a.confidence || b.score - a.score);
  const top = ranked[0];
  const tied: ScoredArchetype[] = [];
  if (!top.shortCircuited) {
    for (let i = 1; i < ranked.length; i++) {
      if (top.confidence - ranked[i].confidence <= 0.1 && ranked[i].confidence > 0) {
        tied.push(ranked[i]);
      } else {
        break;
      }
    }
  }
  return { ranked, top, tied, shortCircuited: top.shortCircuited };
}
