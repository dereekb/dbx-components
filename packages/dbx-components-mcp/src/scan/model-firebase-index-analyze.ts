/**
 * Index analyzer.
 *
 * Consumes the {@link ExtractedModelFirebaseIndexEntry}s produced by the
 * extractor and decides, per `(collection, scope, constraintSequence)`,
 * whether the query requires a composite index, a `fieldOverrides[]`
 * variant, or neither (because Firestore's automatic single-field
 * `COLLECTION`-scope index already covers the query). Encodes Firestore's
 * field-order rule for composites:
 *
 *   1. Equality (`==`, `in`) fields first, in source order.
 *   2. A single range/inequality field next (direction taken from any
 *      explicit `orderBy` on the same field, else ASCENDING).
 *   3. An optional `array-contains` field.
 *   4. Remaining `orderBy` fields in source order, with their declared
 *      direction.
 *
 * The `__name__` tiebreaker is NOT appended here — the generator does that
 * at emission time, picking the direction to match the last orderBy.
 *
 * Returns one `derivedComposites` + one `derivedFieldOverrides` set per
 * entry. The generator merges these across entries when building
 * `firestore.indexes.json` (dedupe, canonical sort, COLLECTION-quartet
 * companion fieldOverrides).
 */

import { type ConstraintSequence, type ConstraintSequenceEntry, type DerivedComposite, type DerivedFieldOverride, type DerivedFieldOverrideVariant, type DerivedIndexField, type FirestoreIndexOrder, type FirestoreQueryScope, type FirestoreWhereOperator , DEFAULT_FIRESTORE_INDEX_DENSITY } from '../manifest/model-firebase-index-schema.js';
import type { ExtractedModelFirebaseIndexEntry } from './model-firebase-index-extract.js';

// MARK: Public types
/**
 * Per-factory analyzer output. The entry order matches the extractor's
 * input order so warnings + diagnostics can point back to the factory.
 */
export interface AnalyzedEntry {
  readonly extractedEntry: ExtractedModelFirebaseIndexEntry;
  readonly derivedComposites: readonly DerivedComposite[];
  readonly derivedFieldOverrides: readonly DerivedFieldOverride[];
  readonly warnings: readonly AnalyzerWarning[];
}

/**
 * Discriminated union of non-fatal events emitted during analysis.
 */
export type AnalyzerWarning = { readonly kind: 'multiple-range-fields'; readonly factoryName: string; readonly fields: readonly string[] } | { readonly kind: 'orderby-conflict'; readonly factoryName: string; readonly field: string; readonly directions: readonly string[] } | { readonly kind: 'unsupported-array-contains-any'; readonly factoryName: string; readonly field: string };

const EQUALITY_OPERATORS: ReadonlySet<FirestoreWhereOperator> = new Set(['==', 'in']);
const RANGE_OPERATORS: ReadonlySet<FirestoreWhereOperator> = new Set(['<', '<=', '>', '>=', '!=', 'not-in']);
const ARRAY_OPERATORS: ReadonlySet<FirestoreWhereOperator> = new Set(['array-contains', 'array-contains-any']);

// MARK: Entry point
/**
 * Runs the analyzer over every extracted entry.
 *
 * @param entries - the extracted entries to analyze
 * @returns one analyzed result per input entry
 */
export function analyzeModelFirebaseIndexEntries(entries: readonly ExtractedModelFirebaseIndexEntry[]): readonly AnalyzedEntry[] {
  const out: AnalyzedEntry[] = [];
  for (const entry of entries) {
    out.push(analyzeEntry(entry));
  }
  return out;
}

/**
 * Runs the analyzer over a single extracted entry.
 *
 * @param entry - the extracted entry to analyze
 * @returns the analyzed result
 */
export function analyzeEntry(entry: ExtractedModelFirebaseIndexEntry): AnalyzedEntry {
  if (entry.skip || entry.manual || entry.constraintSequences.length === 0) {
    return {
      extractedEntry: entry,
      derivedComposites: [],
      derivedFieldOverrides: [],
      warnings: []
    };
  }

  const composites: DerivedComposite[] = [];
  const fieldOverrides = new Map<string, DerivedFieldOverrideVariant[]>();
  const warnings: AnalyzerWarning[] = [];

  for (const sequence of entry.constraintSequences) {
    const result = analyzeSequence({ sequence, collection: entry.collection, scope: entry.scope, factoryName: entry.name });
    for (const warning of result.warnings) {
      warnings.push(warning);
    }
    if (result.kind === 'composite') {
      composites.push(result.composite);
    } else if (result.kind === 'fieldOverride') {
      const key = result.fieldOverride.fieldPath;
      const list = fieldOverrides.get(key) ?? [];
      if (!list.some((v) => fieldOverrideVariantEquals(v, result.fieldOverride.variant))) {
        list.push(result.fieldOverride.variant);
      }
      fieldOverrides.set(key, list);
    }
  }

  const derivedFieldOverrides: DerivedFieldOverride[] = [];
  for (const [fieldPath, variants] of fieldOverrides) {
    derivedFieldOverrides.push({ collectionGroup: entry.collection, fieldPath, variants });
  }

  return {
    extractedEntry: entry,
    derivedComposites: composites,
    derivedFieldOverrides,
    warnings
  };
}

// MARK: Single-sequence analysis
interface AnalyzeSequenceInput {
  readonly sequence: ConstraintSequence;
  readonly collection: string;
  readonly scope: FirestoreQueryScope;
  readonly factoryName: string;
}

type AnalyzeSequenceResult = { readonly kind: 'composite'; readonly composite: DerivedComposite; readonly warnings: readonly AnalyzerWarning[] } | { readonly kind: 'fieldOverride'; readonly fieldOverride: { readonly fieldPath: string; readonly variant: DerivedFieldOverrideVariant }; readonly warnings: readonly AnalyzerWarning[] } | { readonly kind: 'auto'; readonly warnings: readonly AnalyzerWarning[] };

interface BucketedConstraints {
  readonly equalities: readonly ConstraintSequenceEntry[];
  readonly ranges: readonly ConstraintSequenceEntry[];
  readonly arrays: readonly ConstraintSequenceEntry[];
  readonly orderBys: readonly ConstraintSequenceEntry[];
  readonly distinctFieldCount: number;
}

function bucketConstraints(entries: readonly ConstraintSequenceEntry[]): BucketedConstraints {
  const equalities: ConstraintSequenceEntry[] = [];
  const ranges: ConstraintSequenceEntry[] = [];
  const arrays: ConstraintSequenceEntry[] = [];
  const orderBys: ConstraintSequenceEntry[] = [];
  const seenEqualityFields = new Set<string>();
  const seenRangeFields = new Set<string>();
  const seenArrayFields = new Set<string>();
  const distinctFields = new Set<string>();

  for (const entry of entries) {
    distinctFields.add(entry.fieldPath);
    if (entry.kind === 'orderBy') {
      orderBys.push(entry);
      continue;
    }
    const op = entry.operator ?? '==';
    if (EQUALITY_OPERATORS.has(op)) {
      if (!seenEqualityFields.has(entry.fieldPath)) {
        seenEqualityFields.add(entry.fieldPath);
        equalities.push(entry);
      }
    } else if (RANGE_OPERATORS.has(op)) {
      if (!seenRangeFields.has(entry.fieldPath)) {
        seenRangeFields.add(entry.fieldPath);
        ranges.push(entry);
      }
    } else if (ARRAY_OPERATORS.has(op) && !seenArrayFields.has(entry.fieldPath)) {
        seenArrayFields.add(entry.fieldPath);
        arrays.push(entry);
      }
  }

  return {
    equalities,
    ranges,
    arrays,
    orderBys,
    distinctFieldCount: distinctFields.size
  };
}

function analyzeSequence(input: AnalyzeSequenceInput): AnalyzeSequenceResult {
  const { sequence, collection, scope, factoryName } = input;
  const buckets = bucketConstraints(sequence.entries);
  const warnings: AnalyzerWarning[] = [];

  if (buckets.ranges.length > 1) {
    warnings.push({ kind: 'multiple-range-fields', factoryName, fields: buckets.ranges.map((r) => r.fieldPath) });
  }
  for (const arrayEntry of buckets.arrays) {
    if (arrayEntry.operator === 'array-contains-any') {
      warnings.push({ kind: 'unsupported-array-contains-any', factoryName, field: arrayEntry.fieldPath });
    }
  }

  if (buckets.distinctFieldCount === 0) {
    return { kind: 'auto', warnings };
  }

  if (isSingleFieldQuery(buckets)) {
    return analyzeSingleField({ buckets, collection, scope, warnings });
  }

  return analyzeMultiField({ buckets, sequenceEntries: sequence.entries, collection, scope, factoryName, warnings });
}

function isSingleFieldQuery(buckets: BucketedConstraints): boolean {
  return buckets.distinctFieldCount === 1;
}

// MARK: Single-field path
interface AnalyzeSingleFieldInput {
  readonly buckets: BucketedConstraints;
  readonly collection: string;
  readonly scope: FirestoreQueryScope;
  readonly warnings: AnalyzerWarning[];
}

function analyzeSingleField(input: AnalyzeSingleFieldInput): AnalyzeSequenceResult {
  const { buckets, collection, scope, warnings } = input;

  if (scope === 'COLLECTION') {
    return { kind: 'auto', warnings };
  }

  const fieldPath = pickFirstFieldFromBuckets(buckets);
  if (fieldPath === undefined) {
    return { kind: 'auto', warnings };
  }

  let variant: DerivedFieldOverrideVariant;
  if (buckets.arrays.length === 1) {
    variant = { queryScope: 'COLLECTION_GROUP', arrayConfig: 'CONTAINS' };
  } else if (buckets.orderBys.length === 1) {
    const direction = buckets.orderBys[0].direction ?? 'asc';
    variant = { queryScope: 'COLLECTION_GROUP', order: orderForDirection(direction) };
  } else {
    variant = { queryScope: 'COLLECTION_GROUP', order: 'ASCENDING' };
  }

  void collection;
  return { kind: 'fieldOverride', fieldOverride: { fieldPath, variant }, warnings };
}

function pickFirstFieldFromBuckets(buckets: BucketedConstraints): string | undefined {
  let result: string | undefined;
  if (buckets.equalities.length > 0) {
    result = buckets.equalities[0].fieldPath;
  } else if (buckets.ranges.length > 0) {
    result = buckets.ranges[0].fieldPath;
  } else if (buckets.arrays.length > 0) {
    result = buckets.arrays[0].fieldPath;
  } else if (buckets.orderBys.length > 0) {
    result = buckets.orderBys[0].fieldPath;
  }
  return result;
}

// MARK: Multi-field path
interface AnalyzeMultiFieldInput {
  readonly buckets: BucketedConstraints;
  readonly sequenceEntries: readonly ConstraintSequenceEntry[];
  readonly collection: string;
  readonly scope: FirestoreQueryScope;
  readonly factoryName: string;
  readonly warnings: AnalyzerWarning[];
}

function analyzeMultiField(input: AnalyzeMultiFieldInput): AnalyzeSequenceResult {
  const { buckets, collection, scope, factoryName, sequenceEntries, warnings } = input;

  const fields: DerivedIndexField[] = [];
  const placedFields = new Set<string>();

  const orderByByField = collectOrderByDirections({ orderBys: buckets.orderBys, factoryName, warnings });

  // Walk where/array constraints in source order so equality/range/array
  // appear in the composite in the same order the author wrote them.
  // Firestore composites accept any order among equality fields, but the
  // deployed index has a fixed shape — matching source order keeps the
  // generated JSON aligned with hand-deployed indexes.
  for (const entry of sequenceEntries) {
    if (entry.kind !== 'where') {
      continue;
    }
    if (placedFields.has(entry.fieldPath)) {
      continue;
    }
    const op = entry.operator ?? '==';
    if (EQUALITY_OPERATORS.has(op)) {
      fields.push({ fieldPath: entry.fieldPath, order: 'ASCENDING' });
      placedFields.add(entry.fieldPath);
    } else if (RANGE_OPERATORS.has(op)) {
      const direction = orderByByField.get(entry.fieldPath) ?? 'asc';
      fields.push({ fieldPath: entry.fieldPath, order: orderForDirection(direction) });
      placedFields.add(entry.fieldPath);
    } else if (ARRAY_OPERATORS.has(op)) {
      fields.push({ fieldPath: entry.fieldPath, arrayConfig: 'CONTAINS' });
      placedFields.add(entry.fieldPath);
    }
  }

  // Append orderBy fields that haven't already been placed by a range
  // constraint. They retain source order among themselves and inherit each
  // declaration's direction.
  for (const orderBy of buckets.orderBys) {
    if (placedFields.has(orderBy.fieldPath)) {
      continue;
    }
    const direction = orderBy.direction ?? 'asc';
    fields.push({ fieldPath: orderBy.fieldPath, order: orderForDirection(direction) });
    placedFields.add(orderBy.fieldPath);
  }

  if (fields.length < 2) {
    return { kind: 'auto', warnings };
  }

  const composite: DerivedComposite = {
    collectionGroup: collection,
    queryScope: scope,
    fields,
    density: DEFAULT_FIRESTORE_INDEX_DENSITY
  };
  return { kind: 'composite', composite, warnings };
}

interface CollectOrderByDirectionsInput {
  readonly orderBys: readonly ConstraintSequenceEntry[];
  readonly factoryName: string;
  readonly warnings: AnalyzerWarning[];
}

function collectOrderByDirections(input: CollectOrderByDirectionsInput): ReadonlyMap<string, 'asc' | 'desc'> {
  const { orderBys, factoryName, warnings } = input;
  const out = new Map<string, 'asc' | 'desc'>();
  const conflicts = new Map<string, Set<'asc' | 'desc'>>();
  for (const orderBy of orderBys) {
    const direction = orderBy.direction ?? 'asc';
    const existing = out.get(orderBy.fieldPath);
    if (existing === undefined) {
      out.set(orderBy.fieldPath, direction);
    } else if (existing !== direction) {
      const set = conflicts.get(orderBy.fieldPath) ?? new Set<'asc' | 'desc'>([existing]);
      set.add(direction);
      conflicts.set(orderBy.fieldPath, set);
    }
  }
  for (const [field, dirs] of conflicts) {
    warnings.push({ kind: 'orderby-conflict', factoryName, field, directions: [...dirs] });
  }
  return out;
}

// MARK: Helpers
function orderForDirection(direction: 'asc' | 'desc'): FirestoreIndexOrder {
  return direction === 'desc' ? 'DESCENDING' : 'ASCENDING';
}

function fieldOverrideVariantEquals(a: DerivedFieldOverrideVariant, b: DerivedFieldOverrideVariant): boolean {
  return a.queryScope === b.queryScope && a.order === b.order && a.arrayConfig === b.arrayConfig;
}
