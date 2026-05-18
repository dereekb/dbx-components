/**
 * Formatter for firebase-model lookups through `dbx_model_lookup`.
 *
 * Brief depth: headline + collapsed field table (no enums, no source).
 * Full depth: everything — identity, parent chain, every field with JSDoc,
 * every declared enum, and the source path for further reading.
 */

import type { FirebaseField, FirebaseModel, FirebaseSubObject } from '../registry/firebase-models.js';

export type LookupDepth = 'brief' | 'full';

/**
 * Optional knobs for {@link formatFirebaseModelEntry}.
 *
 * - `fields`: list of lowercased, trimmed field identifiers. When set, the
 *   fields table is restricted to fields whose `name` or `longName` matches
 *   one of the entries; enums are pruned to only those referenced via
 *   `enumRef` on a kept field. The list is assumed pre-normalized by the
 *   caller (lowercase, deduped, no empty strings).
 */
export interface FormatFirebaseModelEntryOptions {
  readonly fields?: readonly string[];
}

interface FilteredFields {
  readonly kept: readonly FirebaseField[];
  readonly unmatchedFilters: readonly string[];
}

function applyFieldsFilter(model: FirebaseModel, filter: readonly string[]): FilteredFields {
  const filterSet = new Set(filter);
  const matched = new Set<string>();
  const kept: FirebaseField[] = [];
  for (const field of model.fields) {
    const nameLower = field.name.toLowerCase();
    const longNameLower = field.longName.toLowerCase();
    let keep = false;
    if (filterSet.has(nameLower)) {
      matched.add(nameLower);
      keep = true;
    }
    if (filterSet.has(longNameLower)) {
      matched.add(longNameLower);
      keep = true;
    }
    if (field.subObject !== undefined && subObjectMatches(field.subObject, filterSet, matched)) {
      keep = true;
    }
    if (keep) {
      kept.push(field);
    }
  }
  const unmatchedFilters = filter.filter((entry) => !matched.has(entry));
  return { kept, unmatchedFilters };
}

/**
 * Recursively scans a sub-object's fields for any whose name or
 * longName appears in the filter set. Mutates `matched` so the outer
 * `applyFieldsFilter` can report unmatched-filter entries correctly.
 *
 * @param subObject - The sub-object structure to scan.
 * @param filterSet - Lowercased filter entries the caller is looking for.
 * @param matched - Mutable set of filter entries that have matched somewhere.
 * @returns `true` when the sub-object (or any nested sub-object) matches at least one filter entry.
 */
function subObjectMatches(subObject: FirebaseSubObject, filterSet: ReadonlySet<string>, matched: Set<string>): boolean {
  let any = false;
  for (const field of subObject.fields) {
    const nameLower = field.name.toLowerCase();
    const longNameLower = field.longName.toLowerCase();
    if (filterSet.has(nameLower)) {
      matched.add(nameLower);
      any = true;
    }
    if (filterSet.has(longNameLower)) {
      matched.add(longNameLower);
      any = true;
    }
    if (field.subObject !== undefined && subObjectMatches(field.subObject, filterSet, matched)) {
      any = true;
    }
  }
  return any;
}

/**
 * Discriminator for the consumer-side store-class shape that pairs with each
 * FIREBASE_MODELS entry. Mirrors the abstract base classes in
 * `@dereekb/dbx-firebase`. The registry today only contains `'root'` and
 * `'sub-collection'`; the singleton / system-state shapes appear in downstream
 * projects (HelloSubs, demo-firebase) and are documented through the
 * `topic="shapes"` taxonomy.
 */
export type FirebaseModelStoreShape = 'root' | 'sub-collection' | 'root-singleton' | 'singleton-sub' | 'system-state';

/**
 * Derives the store-shape for a FIREBASE_MODELS entry. The registry currently
 * exposes only root and sub-collection identities, so this returns one of
 * those two values; richer shapes are documented via the static taxonomy.
 *
 * @param model - A Firebase model registry entry.
 * @returns The shape this model's consumer-side stores follow.
 */
export function firebaseModelStoreShape(model: FirebaseModel): FirebaseModelStoreShape {
  const result: FirebaseModelStoreShape = model.parentIdentityConst ? 'sub-collection' : 'root';
  return result;
}

const STORE_SHAPE_LABEL: Readonly<Record<FirebaseModelStoreShape, string>> = {
  root: 'root',
  'sub-collection': 'sub-collection',
  'root-singleton': 'root-singleton',
  'singleton-sub': 'singleton-sub',
  'system-state': 'system-state'
};

/**
 * Renders a single Firebase model entry as markdown — identity, store shape,
 * source path, and a fields table whose width depends on `depth`.
 *
 * @param model - The registry entry to render.
 * @param depth - `'brief'` for fields-only or `'full'` for type/converter columns + enums.
 * @param options - Optional knobs (e.g. `fields` filter)
 * @returns The markdown body the tool emits as content.
 */
export function formatFirebaseModelEntry(model: FirebaseModel, depth: LookupDepth, options?: FormatFirebaseModelEntryOptions): string {
  const identityLine = model.parentIdentityConst ? `\`${model.identityConst}\` — subcollection of \`${model.parentIdentityConst}\`` : `\`${model.identityConst}\` — root collection`;
  const shape = firebaseModelStoreShape(model);
  const shapeLabel = model.collectionKind ? `\`${STORE_SHAPE_LABEL[shape]}\` · collectionKind \`${model.collectionKind}\`` : `\`${STORE_SHAPE_LABEL[shape]}\``;

  const filter = options?.fields;
  const filtered = filter === undefined ? undefined : applyFieldsFilter(model, filter);
  const fieldsToRender: readonly FirebaseField[] = filtered ? filtered.kept : model.fields;
  const totalFields = model.fields.length;
  const fieldsHeader = filtered ? `## Fields (${fieldsToRender.length} of ${totalFields})` : `## Fields (${totalFields})`;

  const lines: string[] = [`# ${model.name}`, ''];
  if (model.description) {
    lines.push(model.description, '');
  }
  lines.push(`**Package:** \`${model.sourcePackage}\``, `**Identity:** ${identityLine}`, `**Collection:** \`${model.modelType}\` · prefix \`${model.collectionPrefix}\``, `**Store shape:** ${shapeLabel} (see \`dbx_model_lookup topic="shapes"\` for the full taxonomy)`);
  const keyingLabel = formatUserKeyingLabel(model);
  if (keyingLabel) lines.push(`**User keying:** ${keyingLabel}`);
  const archetypeLabel = formatArchetypeLabel(model);
  if (archetypeLabel) lines.push(`**Archetype:** ${archetypeLabel}`);
  lines.push(`**Source:** \`${model.sourceFile}\``, '', fieldsHeader, '');

  if (filtered) {
    lines.push(`_Showing ${fieldsToRender.length} of ${totalFields} fields (filtered by \`fields\`)._`, '');
  }

  appendFieldsTable(lines, fieldsToRender, depth);

  if (depth === 'full') {
    appendCrossModelReferences(lines, model, fieldsToRender);
    appendSyncFlagsSection(lines, fieldsToRender);
    const enumsToRender = filtered ? prunedEnumsForFields(model, fieldsToRender) : model.enums;
    appendEnumsSection(lines, enumsToRender);
  }

  if (filtered) {
    appendFilterFooters(lines, filtered);
  }

  return lines.join('\n').trimEnd();
}

function appendFieldsTable(lines: string[], fields: readonly FirebaseField[], depth: LookupDepth): void {
  if (depth === 'brief') {
    lines.push('| Field | Description |', '|-------|-------------|');
    for (const field of fields) {
      const desc = describeField(field);
      lines.push(`| \`${formatFieldLabel(field)}\` | ${desc} |`);
    }
  } else {
    lines.push('| Field | Description | Type | Converter |', '|-------|-------------|------|-----------|');
    for (const field of fields) {
      const desc = describeField(field);
      const ts = field.tsType ? `\`${field.tsType}\`` : '–';
      const conv = field.converter.length > 0 ? `\`${field.converter}\`` : '–';
      lines.push(`| \`${formatFieldLabel(field)}\` | ${desc} | ${ts} | ${conv} |`);
    }
  }
  appendSubObjectSections(lines, fields, depth);
}

/**
 * Renders the field label shown in the catalog table. Includes the
 * `@dbxModelVariable` long-name in parentheses when it differs from
 * the short name — `bg (embeddedBillingGroups)` — so readers see both
 * the persisted key and the human-readable expansion without leaving
 * the table.
 *
 * @param field - The field to label.
 * @returns The label text (without the surrounding backticks)
 */
function formatFieldLabel(field: FirebaseField): string {
  return field.longName && field.longName !== field.name ? `${field.name} (${field.longName})` : field.name;
}

function appendSubObjectSections(lines: string[], fields: readonly FirebaseField[], depth: LookupDepth): void {
  for (const field of fields) {
    if (field.subObject === undefined) continue;
    appendSubObjectSection({ lines, parentLabel: formatFieldLabel(field), subObject: field.subObject, depth, headingLevel: 3 });
  }
}

interface AppendSubObjectSectionInput {
  readonly lines: string[];
  readonly parentLabel: string;
  readonly subObject: FirebaseSubObject;
  readonly depth: LookupDepth;
  readonly headingLevel: number;
}

function appendSubObjectSection(input: AppendSubObjectSectionInput): void {
  const { lines, parentLabel, subObject, depth, headingLevel } = input;
  const heading = '#'.repeat(Math.min(Math.max(headingLevel, 2), 6));
  const kindLabel = SUB_OBJECT_KIND_LABEL[subObject.factoryKind];
  lines.push('', `${heading} Sub-object: \`${parentLabel}\` → \`${subObject.interfaceName}\` (${kindLabel})`, '');
  if (depth === 'brief') {
    lines.push('| Field | Description |', '|-------|-------------|');
    for (const field of subObject.fields) {
      const desc = describeField(field);
      lines.push(`| \`${formatFieldLabel(field)}\` | ${desc} |`);
    }
  } else {
    lines.push('| Field | Description | Type |', '|-------|-------------|------|');
    for (const field of subObject.fields) {
      const desc = describeField(field);
      const ts = field.tsType ? `\`${field.tsType}\`` : '–';
      lines.push(`| \`${formatFieldLabel(field)}\` | ${desc} | ${ts} |`);
    }
  }
  for (const field of subObject.fields) {
    if (field.subObject === undefined) continue;
    appendSubObjectSection({
      lines,
      parentLabel: `${parentLabel}.${formatFieldLabel(field)}`,
      subObject: field.subObject,
      depth,
      headingLevel: headingLevel + 1
    });
  }
}

const SUB_OBJECT_KIND_LABEL: Readonly<Record<FirebaseSubObject['factoryKind'], string>> = {
  object: 'embedded object',
  array: 'embedded array',
  map: 'embedded map'
};

function describeField(field: FirebaseField): string {
  return (field.description ?? '–').replaceAll('|', String.raw`\|`).replaceAll('\n', ' ');
}

/**
 * Renders the inline "User keying" label for a model. Mirrors the source-of-
 * truth marker types (`UserRelatedById`, `UserRelated`) on the model interface.
 * Returns `undefined` when neither applies so the caller can skip the line
 * entirely.
 *
 * @param model - the registry entry to inspect
 * @returns the human-readable label, or `undefined` for non-user models
 */
/**
 * Renders the inline "Archetype" label for a model when one was populated by
 * the extractor (heuristic or `@dbxModelArchetype` JSDoc override). Returns
 * `undefined` when no archetype is tagged so the caller can skip the line.
 *
 * @param model - The registry entry to inspect.
 * @returns The human-readable label, or `undefined` for un-archetype models.
 */
function formatArchetypeLabel(model: FirebaseModel): string | undefined {
  let result: string | undefined;
  const slugs = model.archetypes ?? [];
  if (slugs.length > 0) {
    const labels = slugs.map((slug) => {
      const axesParts: string[] = [];
      const slugAxes = model.archetypeAxesBySlug?.[slug];
      if (slugAxes) {
        for (const [k, v] of Object.entries(slugAxes)) {
          axesParts.push(`${k}=\`${v}\``);
        }
      }
      const axesText = axesParts.length > 0 ? ` (${axesParts.join(', ')})` : '';
      return `\`${slug}\`${axesText}`;
    });
    const lookupHints = slugs.map((slug) => `\`dbx_model_archetype_lookup slug="${slug}"\``).join(' / ');
    result = `${labels.join(' + ')} — call ${lookupHints} for catalog details`;
  }
  return result;
}

function formatUserKeyingLabel(model: FirebaseModel): string | undefined {
  let result: string | undefined;
  if (model.userKeyedById && model.hasUserUidField) {
    result = 'doc id is the Firebase Auth uid (`UserRelatedById`) · also carries an explicit `uid` field (`UserRelated`)';
  } else if (model.userKeyedById) {
    result = 'doc id is the Firebase Auth uid (`UserRelatedById`)';
  } else if (model.hasUserUidField) {
    result = 'carries an explicit `uid` field referencing the Firebase Auth user (`UserRelated`)';
  }
  return result;
}

/**
 * Field-tsType suffixes that signal a cross-model reference. The capture group preceding the
 * suffix is treated as the referenced model name (e.g. `WorkerKey` → `Worker`). Generic primary-
 * key types like `FirestoreModelKey` / `FirestoreModelId` are filtered out separately because
 * they're too broad to act as cross-model pointers.
 */
const CROSS_REF_SUFFIX_RE = /^([A-Z][A-Za-z0-9]*?)(ModelKey|ModelIdRef|Key|KeyRef|Id|IdRef)$/;
const CROSS_REF_GENERIC_TYPES: ReadonlySet<string> = new Set(['FirestoreModelKey', 'FirestoreModelId', 'FirestoreModelIdRef', 'FirestoreModelKeyRef']);

interface CrossModelReference {
  readonly fieldName: string;
  readonly typeName: string;
  readonly referencedModelName: string;
  readonly array: boolean;
}

function unwrapTsType(raw: string): { readonly inner: string; readonly array: boolean } {
  let result = raw.trim();
  let array = false;
  // Strip a single Maybe<…> wrapper.
  const maybeMatch = /^Maybe<\s*(.+)\s*>$/.exec(result);
  if (maybeMatch) {
    result = maybeMatch[1].trim();
  }
  // Strip readonly prefix and trailing [] from arrays. ReadonlyArray<T> is also handled.
  const readonlyArrayMatch = /^ReadonlyArray<\s*(.+)\s*>$/.exec(result);
  if (readonlyArrayMatch) {
    result = readonlyArrayMatch[1].trim();
    array = true;
  } else {
    const arrayMatch = /^(?:readonly\s+)?(.+?)(\s*\[\s*\])$/.exec(result);
    if (arrayMatch) {
      result = arrayMatch[1].trim();
      array = true;
    }
  }
  return { inner: result, array };
}

function detectCrossModelReferences(model: FirebaseModel, fields: readonly FirebaseField[]): readonly CrossModelReference[] {
  const out: CrossModelReference[] = [];
  for (const field of fields) {
    if (!field.tsType) continue;
    const { inner, array } = unwrapTsType(field.tsType);
    if (CROSS_REF_GENERIC_TYPES.has(inner)) continue;
    const m = CROSS_REF_SUFFIX_RE.exec(inner);
    if (!m) continue;
    const referencedModelName = m[1];
    // Skip self-references — a model's own primary-key types aren't cross-refs.
    if (referencedModelName === model.name) continue;
    out.push({ fieldName: field.name, typeName: inner, referencedModelName, array });
  }
  return out;
}

function appendCrossModelReferences(lines: string[], model: FirebaseModel, fields: readonly FirebaseField[]): void {
  const refs = detectCrossModelReferences(model, fields);
  if (refs.length === 0) return;
  lines.push('', '## Cross-model references', '', '| Field | Type | References |', '|-------|------|------------|');
  for (const ref of refs) {
    const typeDisplay = ref.array ? `\`${ref.typeName}[]\`` : `\`${ref.typeName}\``;
    lines.push(`| \`${ref.fieldName}\` | ${typeDisplay} | **${ref.referencedModelName}** |`);
  }
}

function appendSyncFlagsSection(lines: string[], fields: readonly FirebaseField[]): void {
  const flagged = fields.filter((f) => f.syncFlag !== undefined && f.syncFlag.length > 0);
  if (flagged.length === 0) return;
  lines.push('', '## Sync flags', '', '| Field | Synchronizes |', '|-------|--------------|');
  for (const field of flagged) {
    const desc = (field.syncFlag ?? '').replaceAll('|', String.raw`\|`).replaceAll('\n', ' ');
    lines.push(`| \`${field.name}\` | ${desc} |`);
  }
}

function appendEnumsSection(lines: string[], enums: readonly FirebaseModel['enums'][number][]): void {
  if (enums.length > 0) {
    lines.push('', '## Enums', '');
    for (const en of enums) {
      lines.push(`### ${en.name}`, '');
      if (en.description) {
        lines.push(en.description, '');
      }
      for (const value of en.values) {
        const desc = value.description ? ` — ${value.description}` : '';
        lines.push(`- \`${value.name} = ${value.value}\`${desc}`);
      }
      lines.push('');
    }
  }
}

function appendFilterFooters(lines: string[], filtered: FilteredFields): void {
  if (filtered.unmatchedFilters.length > 0) {
    const formatted = filtered.unmatchedFilters.map((entry) => `\`${entry}\``).join(', ');
    lines.push('', `_Unmatched filters: ${formatted}._`);
  }
  if (filtered.kept.length === 0) {
    lines.push('', '_No fields matched. Drop `fields` to see the full model._');
  }
}

function prunedEnumsForFields(model: FirebaseModel, kept: readonly FirebaseField[]): readonly FirebaseModel['enums'][number][] {
  const referenced = new Set<string>();
  for (const field of kept) {
    if (field.enumRef !== undefined) {
      referenced.add(field.enumRef);
    }
  }
  return referenced.size === 0 ? [] : model.enums.filter((en) => referenced.has(en.name));
}

/**
 * Renders the catalog view (root vs. subcollection split) so callers can
 * browse the registry before deciding which entry to drill into.
 *
 * The optional `downstream` argument adds a "Downstream models" section
 * grouped by source package, listing every detected downstream entry the
 * runtime catalog assembled.
 *
 * @param models - the entries to list, typically the upstream registry
 * @param downstream - downstream-only entries grouped per package (optional)
 * @returns the markdown body the tool emits as content
 */
/**
 * Renders the optional "Downstream models" section grouped by source
 * package. Each package gets a `### \`pkg\`` heading and its models
 * sorted alphabetically.
 *
 * @param downstream - Downstream-only entries (already filtered for scope)
 * @returns The markdown lines to splice into the catalog body.
 */
function formatDownstreamSection(downstream: readonly FirebaseModel[]): readonly string[] {
  const lines: string[] = ['', '## Downstream models', ''];
  const byPackage = new Map<string, FirebaseModel[]>();
  for (const model of downstream) {
    const bucket = byPackage.get(model.sourcePackage) ?? [];
    bucket.push(model);
    byPackage.set(model.sourcePackage, bucket);
  }
  const packageNames = [...byPackage.keys()].sort((a, b) => a.localeCompare(b));
  for (const pkg of packageNames) {
    lines.push(`### \`${pkg}\``, '');
    const bucket = byPackage.get(pkg) ?? [];
    bucket.sort((a, b) => a.name.localeCompare(b.name));
    for (const model of bucket) {
      const parent = model.parentIdentityConst ? ` (under \`${model.parentIdentityConst}\`)` : '';
      lines.push(`- \`${model.collectionPrefix}\` → **${model.name}**${parent} (${model.fields.length} fields)`);
    }
    lines.push('');
  }
  return lines;
}

/**
 * Renders the upstream firebase-model catalog (one bullet per root, one
 * per subcollection) and optionally a downstream-models section grouped
 * by source package. Used as the response body of `dbx_model_lookup`
 * when the caller asks for the full catalog rather than a single entry.
 *
 * @param models - The entries to list, typically the upstream registry.
 * @param downstream - Downstream-only entries grouped per package (optional)
 * @returns The markdown body the tool emits as content.
 */
export function formatFirebaseModelCatalog(models: readonly FirebaseModel[], downstream?: readonly FirebaseModel[]): string {
  const roots = models.filter((m) => !m.parentIdentityConst);
  const subs = models.filter((m) => m.parentIdentityConst);
  const lines: string[] = [`# Firebase model catalog`, '', `${models.length} upstream models (${roots.length} root, ${subs.length} subcollection).`, '', '## Root collections', ''];
  for (const model of roots) {
    lines.push(`- \`${model.collectionPrefix}\` → **${model.name}** (${model.fields.length} fields)`);
  }
  if (subs.length > 0) {
    lines.push('', '## Subcollections', '');
    for (const model of subs) {
      lines.push(`- \`${model.collectionPrefix}\` → **${model.name}** (under \`${model.parentIdentityConst}\`, ${model.fields.length} fields)`);
    }
  }
  if (downstream && downstream.length > 0) {
    lines.push(...formatDownstreamSection(downstream));
  }
  lines.push('Use `dbx_model_lookup topic="<Name>"` or `dbx_model_lookup topic="<prefix>"` for full model details, or `dbx_model_decode` to decode a raw document.', 'See `dbx_model_lookup topic="shapes"` for the consumer-side store-shape taxonomy (root, sub-collection, singletons, system-state).');
  return lines.join('\n').trimEnd();
}

/**
 * Static markdown describing the five consumer-side store-class shapes a
 * Firebase model can take. Surfaces the abstract base classes in
 * `@dereekb/dbx-firebase`, file conventions, and concrete examples — including
 * downstream models (HelloSubs, demo) that aren't in the FIREBASE_MODELS
 * registry but follow the same patterns.
 *
 * @returns A self-contained markdown reference for the shape taxonomy.
 */
export function formatFirebaseStoreShapeTaxonomy(): string {
  return [
    '# Firebase model store shapes',
    '',
    'Five consumer-side store shapes exist for Firestore-backed models. Each maps to one or two abstract base classes in `@dereekb/dbx-firebase`.',
    '',
    '| Shape | Document base | Collection sibling | Parent-bound | Singleton |',
    '|-------|---------------|--------------------|--------------|-----------|',
    '| `root` | `AbstractDbxFirebaseDocumentStore` | `AbstractDbxFirebaseCollectionStore` | no | no |',
    '| `root-singleton` | `AbstractRootSingleItemDbxFirebaseDocument` | typically none | no | yes (single doc identified by `singleItemIdentifier`) |',
    '| `sub-collection` | `AbstractDbxFirebaseDocumentWithParentStore` | `AbstractDbxFirebaseCollectionWithParentStore` | yes | no |',
    '| `singleton-sub` | `AbstractSingleItemDbxFirebaseDocument` | none | yes | yes (one doc per parent) |',
    '| `system-state` | `AbstractSystemStateDocumentStoreAccessor` | none | no | yes (keyed by a `SystemStateTypeIdentifier` constant) |',
    '',
    '## `root`',
    '',
    'Standard Firestore root collection backing a paired document + collection store.',
    '',
    '- **File names:** `<model>.document.store.ts`, `<model>.document.store.directive.ts`, `<model>.collection.store.ts`, `<model>.collection.store.directive.ts`.',
    '- **Collection accessor:** `<modelCamel>Collection` on the firestore-collections class.',
    '- **Document store config:** `super({ firestoreCollection: inject(<Collections>).<modelCamel>Collection });`',
    '- **Examples:** `Profile`, `Job`, `Worker` (HelloSubs), `Guestbook` (demo), `StorageFile`, `NotificationBox` (`@dereekb/firebase`).',
    '',
    '## `root-singleton`',
    '',
    'Single document in a root collection, identified up-front by a fixed `singleItemIdentifier`. Backing collection produced by `makeRootSingleItemFirestoreCollection`.',
    '',
    '- **Base class:** `AbstractRootSingleItemDbxFirebaseDocument<T, D>` — extends the standard root document store but pins the id and disables `setId`/`setKey`.',
    '- **Collection sibling:** typically not emitted (a singleton has nothing to list).',
    '- **Use case:** app-wide config docs, per-deploy registries.',
    '- **No in-scope examples in `@dereekb/firebase` today; downstream projects can use this for app-config singletons.**',
    '',
    '## `sub-collection`',
    '',
    'Standard sub-collection under a parent model — paired document + collection stores, both with `*WithParentStore` bases.',
    '',
    '- **Base classes:** `AbstractDbxFirebaseDocumentWithParentStore<T, P, D, PD>`, `AbstractDbxFirebaseCollectionWithParentStore<T, P, D, PD>`.',
    '- **Document config:** `super({ collectionFactory: <c>.<m>CollectionFactory, firestoreCollectionLike: <c>.<m>CollectionGroup });`',
    '- **Collection config:** `super({ collectionFactory: <c>.<m>CollectionFactory, collectionGroup: <c>.<m>CollectionGroup });`',
    '- **Parent injection:** `@Optional() @Inject(<Parent>DocumentStore) parent` + `if (parent) { this.setParentStore(parent); }`.',
    '- **Examples:** `JobApplication` under `Job`, `WorkerInterview` under `Worker` (HelloSubs); `GuestbookEntry` under `Guestbook` (demo).',
    '',
    '## `singleton-sub`',
    '',
    'One document per parent — typically `<parent>/private/private` or similar fixed-identifier sub-doc. No collection store; listing is meaningless.',
    '',
    '- **Base class:** `AbstractSingleItemDbxFirebaseDocument<T, P, D, PD>` — extends `AbstractDbxFirebaseDocumentWithParentStore` and overrides `setId`/`setKey` to no-ops.',
    '- **Document config:** identical to `sub-collection` (`collectionFactory` + `firestoreCollectionLike`).',
    '- **Parent injection:** identical to `sub-collection`.',
    '- **No paired collection store.** Often no directive either, depending on whether the singleton is consumed at the template level.',
    '- **Examples:** `ProfilePrivate` under `Profile`, `WorkerPrivate` under `Worker`, `WorkerInterviewPrivate` under `WorkerInterview`, `WorkerNote` under `Worker` (all HelloSubs).',
    '',
    '## `system-state`',
    '',
    'Layered convention on top of the central `SystemState` collection — each consumer registers a `SystemStateTypeIdentifier` constant and a typed accessor that wraps the shared `SystemStateDocumentStore`.',
    '',
    '- **Base class:** `AbstractSystemStateDocumentStoreAccessor<TData>` — constructor takes the type identifier; no Firestore-collections injection, no parent, no directive.',
    '- **File suffix:** `.store.accessor.ts` (not `.document.store.ts`).',
    '- **Function helpers:** `firebaseDocumentStoreCreateFunction`, `firebaseDocumentStoreUpdateFunction`, `firebaseDocumentStoreCrudFunction` — all bound to `this.systemStateDocumentStore`.',
    '- **Examples:** `HellosubsCheckHqCompanySystemStateDocumentStoreAccessor`, `HellosubsCheckHqUnclaimedSystemStateDocumentStoreAccessor` (HelloSubs).',
    '',
    '## Picking a shape when scaffolding',
    '',
    '- Backing Firestore identity has a parent? → `sub-collection` for normal sub-docs, `singleton-sub` if the parent has exactly one of these.',
    '- Root identity backed by `makeRootSingleItemFirestoreCollection`? → `root-singleton`.',
    '- No Firestore identity of its own; lives under the central `SystemState` collection keyed by a type constant? → `system-state`.',
    '- Otherwise → `root`.'
  ].join('\n');
}
