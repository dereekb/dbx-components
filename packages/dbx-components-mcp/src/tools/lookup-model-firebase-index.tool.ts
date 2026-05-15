/**
 * `dbx_model_firebase_index_lookup` tool.
 *
 * Firebase-index cluster lookup. Accepts a topic (slug, exported
 * identifier, or the literal `'list'`) and a depth; returns markdown
 * documentation for the matched query-factory entry — its target model,
 * resolved collection name, scope, constraint sequence, and the
 * composite-index / `fieldOverrides` contributions the factory implies.
 *
 * Resolution order:
 *   1. `'list'` / `'catalog'` / `'all'` → catalog grouped by collection
 *   2. Exact slug match → single entry
 *   3. Exact export name → entry
 *   4. Fuzzy substring across slug + name + model + tags + description → "did you mean…"
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type Maybe } from '@dereekb/util';
import type { DerivedComposite, DerivedFieldOverride } from '../manifest/model-firebase-index-schema.js';
import type { ModelFirebaseIndexEntryInfo, ModelFirebaseIndexRegistry } from '../registry/model-firebase-index-runtime.js';
import { createLookupTool, type FuzzyField, type LookupDepth } from './_lookup.factory.js';
import { type DbxTool } from './types.js';

// MARK: Tool definition
const DBX_MODEL_FIREBASE_INDEX_LOOKUP_TOOL: Tool = {
  name: 'dbx_model_firebase_index_lookup',
  description: [
    'Look up Firestore-query factories opted in across @dereekb/firebase (and any downstream packages that registered a model-firebase-index manifest).',
    '',
    'Firebase-index entries are `*.query.ts` factories tagged with `@dbxModelFirebaseIndex` — each one declares a query against a Firestore model, and the registry records the composite-index and `fieldOverrides[]` entries the query requires in `firestore.indexes.json`.',
    '',
    'The `topic` accepts:',
    '  • a registry slug ("job-location-weeks-dirty-for-job-district-day-sync", …);',
    '  • an exported identifier ("jobLocationWeeksDirtyForJobDistrictDaySyncQuery", …);',
    '  • the literal `"list"` for the full catalog grouped by collection.',
    '',
    'Use `dbx_model_firebase_index_search` (when available) for intent-based ranking.',
    'Use `dbx_model_firebase_index_list_app` to see which firebase indexes a specific app uses.',
    "Use `dbx_model_firebase_index_validate_app` to check an app's `firestore.indexes.json` against what its tagged factories require."
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Slug, export name, or "list".' },
      depth: { type: 'string', enum: ['brief', 'full'], default: 'full', description: 'Detail level for single-entry hits.' }
    },
    required: ['topic']
  }
};

function fuzzyFields(entry: ModelFirebaseIndexEntryInfo): readonly FuzzyField[] {
  const fields: FuzzyField[] = [
    { value: entry.slug, weight: 4 },
    { value: entry.name, weight: 4 },
    { value: entry.model, weight: 3 },
    { value: entry.collection, weight: 3 },
    { value: entry.category, weight: 1 },
    { value: entry.description.slice(0, 120), weight: 1 }
  ];
  for (const tag of entry.tags) {
    fields.push({ value: tag, weight: 2 });
  }
  return fields;
}

// MARK: Formatting
function bullet(label: string, value: string): string {
  return `- **${label}:** ${value}`;
}

function formatParamsTable(params: readonly { readonly name: string; readonly type: string; readonly description: string; readonly optional: boolean }[]): string {
  const lines: string[] = ['| Param | Type | Optional | Description |', '| --- | --- | --- | --- |'];
  for (const param of params) {
    lines.push(`| \`${param.name}\` | \`${param.type}\` | ${param.optional ? 'yes' : 'no'} | ${param.description} |`);
  }
  return lines.join('\n');
}

function formatComposite(composite: DerivedComposite): string {
  const fieldLines = composite.fields
    .map((f) => {
      if (f.arrayConfig !== undefined) {
        return `  - \`${f.fieldPath}\` (array-contains)`;
      }
      return `  - \`${f.fieldPath}\` ${f.order === 'DESCENDING' ? 'DESC' : 'ASC'}`;
    })
    .join('\n');
  return `- **${composite.queryScope}** on \`${composite.collectionGroup}\`\n${fieldLines}`;
}

function formatFieldOverride(fieldOverride: DerivedFieldOverride): string {
  const variantLines = fieldOverride.variants
    .map((v) => {
      if (v.arrayConfig !== undefined) {
        return `  - ${v.queryScope} array-contains`;
      }
      return `  - ${v.queryScope} ${v.order === 'DESCENDING' ? 'DESC' : 'ASC'}`;
    })
    .join('\n');
  return `- \`${fieldOverride.collectionGroup}.${fieldOverride.fieldPath}\`\n${variantLines}`;
}

function appendDeprecationNotice(lines: string[], entry: ModelFirebaseIndexEntryInfo): void {
  if (entry.deprecated === false || entry.deprecated === '') {
    return;
  }
  const deprecationNote = typeof entry.deprecated === 'string' && entry.deprecated.length > 0 ? entry.deprecated : 'This factory is deprecated.';
  lines.push(`> ⚠️ Deprecated: ${deprecationNote}`, '');
}

function appendFullEntrySections(lines: string[], entry: ModelFirebaseIndexEntryInfo): void {
  if (entry.params.length > 0) {
    lines.push('## Params', '', formatParamsTable(entry.params), '');
  }
  if (entry.returns.length > 0) {
    lines.push(`**Returns:** \`${entry.returns}\``, '');
  }
  if (entry.derivedComposites.length > 0) {
    lines.push('## Composite indexes required', '', entry.derivedComposites.map(formatComposite).join('\n\n'), '');
  }
  if (entry.derivedFieldOverrides.length > 0) {
    lines.push('## fieldOverrides contributions', '', entry.derivedFieldOverrides.map(formatFieldOverride).join('\n\n'), '');
  }
  if (entry.derivedComposites.length === 0 && entry.derivedFieldOverrides.length === 0 && !entry.skip) {
    lines.push("_This factory requires no composite index or fieldOverride — Firestore's automatic single-field COLLECTION-scope index covers it._", '');
  }
  if (entry.example.length > 0) {
    lines.push('## Example', '', '```ts', entry.example, '```', '');
  }
  if (entry.tags.length > 0) {
    lines.push(`Tags: ${entry.tags.map((t) => code(t)).join(', ')}`, '');
  }
  if (entry.relatedSlugs.length > 0) {
    lines.push(`→ Related: ${entry.relatedSlugs.map((s) => code(s)).join(', ')}`);
  }
  if (entry.skillRefs.length > 0) {
    lines.push(`→ Skills: ${entry.skillRefs.map((s) => code(s)).join(', ')}`);
  }
}

function formatEntry(entry: ModelFirebaseIndexEntryInfo, depth: LookupDepth): string {
  const heading = `# ${entry.name}`;
  const lines: string[] = [
    heading,
    '',
    entry.description,
    '',
    bullet('slug', `\`${entry.slug}\``),
    bullet('model', `\`${entry.model}\``),
    bullet('collection', `\`${entry.collection}\``),
    bullet('scope', `\`${entry.scope}\``),
    bullet('nested', entry.isNested ? 'yes (subcollection)' : 'no (root collection)'),
    bullet('category', `\`${entry.category}\``),
    bullet('module', `\`${entry.module}\``),
    bullet('subpath', `\`${entry.subpath}\``),
    bullet('signature', `\`${entry.signature}\``),
    bullet('flags', `${entry.skip ? '`skip` ' : ''}${entry.manual ? '`manual` ' : ''}`.trim() || 'none'),
    ''
  ];

  appendDeprecationNotice(lines, entry);

  if (depth === 'full') {
    appendFullEntrySections(lines, entry);
  } else {
    lines.push(`→ Call \`dbx_model_firebase_index_lookup topic="${entry.slug}" depth="full"\` for the full constraint sequence and derived index list.`);
  }

  return lines.join('\n').trimEnd();
}

function formatCatalog(entries: readonly ModelFirebaseIndexEntryInfo[]): string {
  if (entries.length === 0) {
    return ['# Firebase-index catalog', '', 'No `@dbxModelFirebaseIndex`-tagged factories have been registered yet.', '', 'Add the tag to a `*.query.ts` factory, then run `nx run dbx-components-mcp:generate-manifests`.'].join('\n');
  }
  const lines: string[] = ['# Firebase-index catalog', '', `${entries.length} entries.`, ''];
  const sorted = [...entries].sort((a, b) => {
    const byCollection = a.collection.localeCompare(b.collection);
    return byCollection === 0 ? a.slug.localeCompare(b.slug) : byCollection;
  });
  let lastCollection: string | undefined;
  for (const entry of sorted) {
    if (entry.collection !== lastCollection) {
      lines.push('', `## ${entry.collection}  *(${entry.model})*`, '');
      lastCollection = entry.collection;
    }
    const scopeBadge = entry.scope === 'COLLECTION_GROUP' ? ' *(group)*' : '';
    const flagBadge = `${entry.skip ? ' *skip*' : ''}${entry.manual ? ' *manual*' : ''}`;
    const compositeCount = entry.derivedComposites.length;
    const overrideCount = entry.derivedFieldOverrides.reduce((sum, f) => sum + f.variants.length, 0);
    const indexNote = compositeCount === 0 && overrideCount === 0 ? 'auto-indexed' : `${compositeCount} composite${compositeCount === 1 ? '' : 's'} • ${overrideCount} override${overrideCount === 1 ? '' : 's'}`;
    lines.push(`- \`${entry.slug}\` → \`${entry.name}\`${scopeBadge}${flagBadge} — ${indexNote}`);
  }
  return lines.join('\n').trimEnd();
}

function formatNotFound(normalized: string, candidates: readonly ModelFirebaseIndexEntryInfo[]): string {
  const lines: string[] = [`No firebase-index entry matched \`${normalized}\`.`, ''];
  if (candidates.length > 0) {
    lines.push('Did you mean one of these?', '');
    for (const entry of candidates) {
      lines.push(`- \`${entry.slug}\` → \`${entry.name}\` *(${entry.collection})* — ${entry.description.split('\n')[0]}`);
    }
  } else {
    lines.push('Try `dbx_model_firebase_index_lookup topic="list"` to browse the catalog.');
  }
  return lines.join('\n');
}

function code(value: string): string {
  return '`' + value + '`';
}

// MARK: Tool factory
/**
 * Input to {@link createLookupModelFirebaseIndexTool}.
 */
export interface CreateLookupModelFirebaseIndexToolInput {
  readonly registry: ModelFirebaseIndexRegistry;
}

/**
 * Creates the `dbx_model_firebase_index_lookup` tool wired to the supplied
 * registry.
 *
 * @param input - the registry the tool reads from
 * @returns a {@link DbxTool} ready to register with the dispatcher
 * @__NO_SIDE_EFFECTS__
 */
export function createLookupModelFirebaseIndexTool(input: CreateLookupModelFirebaseIndexToolInput): DbxTool {
  const { registry } = input;
  const resolveBySlug = (topic: string): Maybe<ModelFirebaseIndexEntryInfo> => registry.findBySlug(topic);
  const resolveByName = (topic: string): Maybe<ModelFirebaseIndexEntryInfo> => registry.findByName(topic);
  return createLookupTool<ModelFirebaseIndexEntryInfo>({
    definition: DBX_MODEL_FIREBASE_INDEX_LOOKUP_TOOL,
    entries: registry.all,
    resolvers: [resolveBySlug, resolveByName],
    fuzzyFields,
    formatCatalog,
    formatEntry,
    formatNotFound
  });
}
