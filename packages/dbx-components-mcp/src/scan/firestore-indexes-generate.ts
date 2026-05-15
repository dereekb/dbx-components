/**
 * `firestore.indexes.json` generator.
 *
 * Consumes the {@link ModelFirebaseIndexRegistry} and produces the
 * canonical `firestore.indexes.json` payload (composites + fieldOverrides)
 * Firebase deploys against. Encodes the live-deploy shape observed in
 * HelloSubs:
 *
 *   - Every composite ends with a `__name__` tiebreaker whose direction
 *     matches the last orderBy in the entry.
 *   - Every composite carries `density: "SPARSE_ALL"`.
 *   - Every COLLECTION_GROUP single-field variant in a `fieldOverrides`
 *     entry is emitted alongside the standard COLLECTION quartet
 *     (ASCENDING/DESCENDING/CONTAINS) so the auto-indexes Firebase would
 *     have created at COLLECTION scope are explicitly preserved.
 *
 * Preserves user-authored content that the analyzer can't produce:
 *
 *   - `fieldOverrides[]` entries whose `(collection, fieldPath)` no
 *     analyzed factory touches (TTL flags, hand-trimmed overrides like
 *     `sjs.adat`, vector indexes, etc.).
 *   - `indexes[]` entries tied to slugs that carry the
 *     `@dbxModelFirebaseIndexManual` JSDoc tag — round-tripped untouched.
 *
 * Returns the new JSON + a structured diff (`added`, `removed`,
 * `unchanged`) so the CLI / MCP tool can render a clear CI report.
 */

import { type DerivedComposite, type DerivedFieldOverrideVariant, type DerivedIndexField, type FirestoreIndexOrder , DEFAULT_FIRESTORE_INDEX_DENSITY } from '../manifest/model-firebase-index-schema.js';
import type { ModelFirebaseIndexEntryInfo } from '../registry/model-firebase-index-runtime.js';

// MARK: firestore.indexes.json shape
/**
 * `firestore.indexes.json` top-level shape.
 */
export interface FirestoreIndexesJson {
  readonly indexes: readonly FirestoreIndexJsonEntry[];
  readonly fieldOverrides: readonly FirestoreFieldOverrideJsonEntry[];
}

/**
 * One `indexes[]` entry. Mirrors the Firestore Admin API schema with the
 * `density` field included (Firebase CLI emits this on every export).
 */
export interface FirestoreIndexJsonEntry {
  readonly collectionGroup: string;
  readonly queryScope: 'COLLECTION' | 'COLLECTION_GROUP';
  readonly fields: readonly FirestoreIndexJsonField[];
  readonly density?: 'SPARSE_ALL' | 'SPARSE_ANY' | 'DENSE';
}

/**
 * One `fields[]` member of an `indexes[]` entry. Includes the `__name__`
 * tiebreaker the generator appends at emission time.
 */
export interface FirestoreIndexJsonField {
  readonly fieldPath: string;
  readonly order?: 'ASCENDING' | 'DESCENDING';
  readonly arrayConfig?: 'CONTAINS';
}

/**
 * One `fieldOverrides[]` entry.
 */
export interface FirestoreFieldOverrideJsonEntry {
  readonly collectionGroup: string;
  readonly fieldPath: string;
  readonly ttl?: boolean;
  readonly indexes: readonly FirestoreFieldOverrideJsonVariant[];
}

/**
 * One variant inside a `fieldOverrides[].indexes` array.
 */
export interface FirestoreFieldOverrideJsonVariant {
  readonly queryScope: 'COLLECTION' | 'COLLECTION_GROUP';
  readonly order?: 'ASCENDING' | 'DESCENDING';
  readonly arrayConfig?: 'CONTAINS';
}

// MARK: Generator input/output
/**
 * Input to {@link generateFirestoreIndexesJson}.
 */
export interface GenerateFirestoreIndexesJsonInput {
  /**
   * Every entry the registry knows about. Entries with `skip = true` or
   * `manual = true` are filtered out by the generator — manual entries
   * are preserved via {@link existingJson}.
   */
  readonly entries: readonly ModelFirebaseIndexEntryInfo[];
  /**
   * The current on-disk `firestore.indexes.json` if any, used to preserve
   * user-authored content the generator can't reproduce.
   */
  readonly existingJson?: FirestoreIndexesJson;
}

/**
 * Diff shape returned alongside the new JSON. Each list carries the
 * canonical-key form of the index (or override) for inclusion in CI
 * reports.
 */
export interface FirestoreIndexesDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly unchanged: readonly string[];
  readonly fieldOverridesAdded: readonly string[];
  readonly fieldOverridesRemoved: readonly string[];
  readonly fieldOverridesUnchanged: readonly string[];
}

/**
 * Output of {@link generateFirestoreIndexesJson}.
 */
export interface GenerateFirestoreIndexesJsonResult {
  readonly json: FirestoreIndexesJson;
  readonly diff: FirestoreIndexesDiff;
}

// MARK: Entry point
/**
 * Generates a canonical `firestore.indexes.json` payload from the
 * registry, preserving user-authored content from any prior on-disk
 * version.
 *
 * @param input - the entries and (optionally) the existing JSON to merge against
 * @returns the new JSON payload plus a diff against the existing version
 */
export function generateFirestoreIndexesJson(input: GenerateFirestoreIndexesJsonInput): GenerateFirestoreIndexesJsonResult {
  const { entries, existingJson } = input;

  const manualSlugs = new Set<string>();
  const generatedComposites: FirestoreIndexJsonEntry[] = [];
  const overrideVariants = new Map<string, DerivedFieldOverrideVariant[]>();

  for (const entry of entries) {
    if (entry.skip) {
      continue;
    }
    if (entry.manual) {
      manualSlugs.add(entry.slug);
      continue;
    }
    for (const composite of entry.derivedComposites) {
      generatedComposites.push(buildCompositeJson(composite));
    }
    for (const fieldOverride of entry.derivedFieldOverrides) {
      const key = `${fieldOverride.collectionGroup}::${fieldOverride.fieldPath}`;
      const list = overrideVariants.get(key) ?? [];
      for (const variant of fieldOverride.variants) {
        if (!list.some((v) => variantsEqual(v, variant))) {
          list.push(variant);
        }
      }
      overrideVariants.set(key, list);
    }
  }

  // Drop duplicate composites the generator produced (multiple factories
  // can require the same index — only emit one entry).
  const dedupedComposites = dedupeCompositesPreservingFirst(generatedComposites);

  // Build field overrides from the analyzed variants, padding with the
  // standard COLLECTION quartet so Firebase doesn't drop the auto indexes.
  const generatedFieldOverrides = buildFieldOverrideEntries(overrideVariants);

  // Round-trip any user-authored fieldOverrides the generator hasn't
  // already produced (TTL flags, disable-auto entries, hand-trimmed
  // overrides like `sjs.adat`, etc.).
  const preservedFieldOverrides = pickPreservedFieldOverrides({ existingJson, generatedFieldOverrides });

  const allFieldOverrides = [...generatedFieldOverrides, ...preservedFieldOverrides];

  // Same for any composites tied to @Manual slugs — preserve verbatim.
  // We can't link composites back to their slug, so the simpler rule
  // applied here: if the existing JSON has composites for collections
  // that no factory touches, keep them. Authors that want a hand-tuned
  // composite alongside a derived one on the same collection should mark
  // their factory @Manual.
  const preservedComposites = pickPreservedComposites({ existingJson, generatedComposites: dedupedComposites });

  const allComposites = [...dedupedComposites, ...preservedComposites];

  // Canonical sort everything for byte-stable output.
  const sortedComposites = [...allComposites].sort(compareComposites);
  const sortedFieldOverrides = [...allFieldOverrides].sort(compareFieldOverrides);

  const json: FirestoreIndexesJson = {
    indexes: sortedComposites,
    fieldOverrides: sortedFieldOverrides
  };

  const diff = computeDiff({ existingJson, json });

  return { json, diff };
}

/**
 * Serializes `firestore.indexes.json` with stable key ordering and a
 * trailing newline so `--check` mode can byte-compare against the
 * committed file without false-positive whitespace diffs.
 *
 * @param json - the indexes payload to serialise
 * @returns the canonical string form
 */
export function serializeFirestoreIndexesJson(json: FirestoreIndexesJson): string {
  return `${JSON.stringify(json, null, 2)}\n`;
}

// MARK: Internals - composite construction
function buildCompositeJson(composite: DerivedComposite): FirestoreIndexJsonEntry {
  const fields: FirestoreIndexJsonField[] = composite.fields.map((field) => buildIndexField(field));
  // Append __name__ tiebreaker. Direction follows the last ordered field.
  const lastOrdered = [...composite.fields].reverse().find((f) => f.order !== undefined);
  const tiebreakerOrder: FirestoreIndexOrder = lastOrdered?.order ?? 'ASCENDING';
  fields.push({ fieldPath: '__name__', order: tiebreakerOrder });
  return {
    collectionGroup: composite.collectionGroup,
    queryScope: composite.queryScope,
    fields,
    density: composite.density ?? DEFAULT_FIRESTORE_INDEX_DENSITY
  };
}

function buildIndexField(field: DerivedIndexField): FirestoreIndexJsonField {
  if (field.arrayConfig !== undefined) {
    return { fieldPath: field.fieldPath, arrayConfig: field.arrayConfig };
  }
  return { fieldPath: field.fieldPath, order: field.order ?? 'ASCENDING' };
}

function dedupeCompositesPreservingFirst(composites: readonly FirestoreIndexJsonEntry[]): FirestoreIndexJsonEntry[] {
  const seen = new Set<string>();
  const out: FirestoreIndexJsonEntry[] = [];
  for (const composite of composites) {
    const key = compositeKey(composite);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(composite);
    }
  }
  return out;
}

function compositeKey(composite: FirestoreIndexJsonEntry): string {
  const fields = composite.fields
    .map((f) => {
      if (f.arrayConfig !== undefined) {
        return `${f.fieldPath}:array:${f.arrayConfig}`;
      }
      return `${f.fieldPath}:${f.order ?? 'ASCENDING'}`;
    })
    .join('|');
  return `${composite.collectionGroup}::${composite.queryScope}::${fields}`;
}

// MARK: Internals - fieldOverride construction
function buildFieldOverrideEntries(overrideVariants: ReadonlyMap<string, readonly DerivedFieldOverrideVariant[]>): FirestoreFieldOverrideJsonEntry[] {
  const entries: FirestoreFieldOverrideJsonEntry[] = [];
  for (const [key, variants] of overrideVariants) {
    const [collectionGroup, fieldPath] = key.split('::');
    const variantList = padWithCollectionQuartet(variants);
    entries.push({
      collectionGroup,
      fieldPath,
      ttl: false,
      indexes: variantList
    });
  }
  return entries;
}

function padWithCollectionQuartet(variants: readonly DerivedFieldOverrideVariant[]): readonly FirestoreFieldOverrideJsonVariant[] {
  const collectionGroupVariants = variants.filter((v) => v.queryScope === 'COLLECTION_GROUP');
  if (collectionGroupVariants.length === 0) {
    // No COLLECTION_GROUP variant required — no need to override the
    // auto indexes Firebase already provides at COLLECTION scope.
    return [];
  }
  const out: FirestoreFieldOverrideJsonVariant[] = [
    { queryScope: 'COLLECTION', order: 'ASCENDING' },
    { queryScope: 'COLLECTION', order: 'DESCENDING' },
    { queryScope: 'COLLECTION', arrayConfig: 'CONTAINS' }
  ];
  for (const variant of collectionGroupVariants) {
    if (!out.some((v) => variantJsonEqual(v, variant))) {
      out.push({ ...variant });
    }
  }
  return out;
}

function variantsEqual(a: DerivedFieldOverrideVariant, b: DerivedFieldOverrideVariant): boolean {
  return a.queryScope === b.queryScope && a.order === b.order && a.arrayConfig === b.arrayConfig;
}

function variantJsonEqual(a: FirestoreFieldOverrideJsonVariant, b: FirestoreFieldOverrideJsonVariant): boolean {
  return a.queryScope === b.queryScope && a.order === b.order && a.arrayConfig === b.arrayConfig;
}

// MARK: Internals - preservation
interface PickPreservedFieldOverridesInput {
  readonly existingJson?: FirestoreIndexesJson;
  readonly generatedFieldOverrides: readonly FirestoreFieldOverrideJsonEntry[];
}

function pickPreservedFieldOverrides(input: PickPreservedFieldOverridesInput): FirestoreFieldOverrideJsonEntry[] {
  const { existingJson, generatedFieldOverrides } = input;
  if (existingJson === undefined) {
    return [];
  }
  const generatedKeys = new Set(generatedFieldOverrides.map(fieldOverrideKey));
  const out: FirestoreFieldOverrideJsonEntry[] = [];
  for (const fieldOverride of existingJson.fieldOverrides) {
    if (!generatedKeys.has(fieldOverrideKey(fieldOverride))) {
      out.push(fieldOverride);
    }
  }
  return out;
}

interface PickPreservedCompositesInput {
  readonly existingJson?: FirestoreIndexesJson;
  readonly generatedComposites: readonly FirestoreIndexJsonEntry[];
}

function pickPreservedComposites(input: PickPreservedCompositesInput): FirestoreIndexJsonEntry[] {
  const { existingJson, generatedComposites } = input;
  if (existingJson === undefined) {
    return [];
  }
  const generatedCollections = new Set(generatedComposites.map((c) => c.collectionGroup));
  const out: FirestoreIndexJsonEntry[] = [];
  for (const composite of existingJson.indexes) {
    if (!generatedCollections.has(composite.collectionGroup)) {
      out.push(composite);
    }
  }
  return out;
}

function fieldOverrideKey(entry: FirestoreFieldOverrideJsonEntry): string {
  return `${entry.collectionGroup}::${entry.fieldPath}`;
}

// MARK: Internals - sorting
function compareComposites(a: FirestoreIndexJsonEntry, b: FirestoreIndexJsonEntry): number {
  let result = a.collectionGroup.localeCompare(b.collectionGroup);
  if (result === 0) {
    result = a.queryScope.localeCompare(b.queryScope);
  }
  if (result === 0) {
    result = compositeKey(a).localeCompare(compositeKey(b));
  }
  return result;
}

function compareFieldOverrides(a: FirestoreFieldOverrideJsonEntry, b: FirestoreFieldOverrideJsonEntry): number {
  let result = a.collectionGroup.localeCompare(b.collectionGroup);
  if (result === 0) {
    result = a.fieldPath.localeCompare(b.fieldPath);
  }
  return result;
}

// MARK: Internals - diff
interface ComputeDiffInput {
  readonly existingJson?: FirestoreIndexesJson;
  readonly json: FirestoreIndexesJson;
}

function computeDiff(input: ComputeDiffInput): FirestoreIndexesDiff {
  const { existingJson, json } = input;
  const newKeys = new Set(json.indexes.map(compositeKey));
  const oldKeys = new Set((existingJson?.indexes ?? []).map(compositeKey));
  const added: string[] = [];
  const removed: string[] = [];
  const unchanged: string[] = [];
  for (const key of newKeys) {
    if (oldKeys.has(key)) {
      unchanged.push(key);
    } else {
      added.push(key);
    }
  }
  for (const key of oldKeys) {
    if (!newKeys.has(key)) {
      removed.push(key);
    }
  }

  const newOverrideKeys = new Set(json.fieldOverrides.map(fieldOverrideKey));
  const oldOverrideKeys = new Set((existingJson?.fieldOverrides ?? []).map(fieldOverrideKey));
  const fieldOverridesAdded: string[] = [];
  const fieldOverridesRemoved: string[] = [];
  const fieldOverridesUnchanged: string[] = [];
  for (const key of newOverrideKeys) {
    if (oldOverrideKeys.has(key)) {
      fieldOverridesUnchanged.push(key);
    } else {
      fieldOverridesAdded.push(key);
    }
  }
  for (const key of oldOverrideKeys) {
    if (!newOverrideKeys.has(key)) {
      fieldOverridesRemoved.push(key);
    }
  }
  return {
    added: added.sort((a, b) => a.localeCompare(b)),
    removed: removed.sort((a, b) => a.localeCompare(b)),
    unchanged: unchanged.sort((a, b) => a.localeCompare(b)),
    fieldOverridesAdded: fieldOverridesAdded.sort((a, b) => a.localeCompare(b)),
    fieldOverridesRemoved: fieldOverridesRemoved.sort((a, b) => a.localeCompare(b)),
    fieldOverridesUnchanged: fieldOverridesUnchanged.sort((a, b) => a.localeCompare(b))
  };
}
