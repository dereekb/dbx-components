/**
 * `dbx_model_snapshot_field_lookup` tool.
 *
 * Snapshot-field-cluster lookup. Accepts a topic (slug, exported
 * identifier, or the literal `'list'`) and a depth; returns markdown
 * documentation for the matched snapshot-field entry.
 *
 * Resolution order:
 *   1. `'list'` / `'catalog'` / `'all'` → catalog grouped by category
 *   2. Exact slug match → single entry
 *   3. Exact export name (case-sensitive — snapshot-field names are camelCase) → entry
 *   4. Case-insensitive name match → entry
 *   5. Fuzzy substring across slug + name + tags + description → "did you mean…"
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type Maybe } from '@dereekb/util';
import type { ModelSnapshotFieldEntryInfo, ModelSnapshotFieldRegistry } from '../registry/model-snapshot-fields-runtime.js';
import { createLookupTool, type FuzzyField, type LookupDepth } from './_lookup.factory.js';
import { type DbxTool } from './types.js';

// MARK: Tool definition
const DBX_MODEL_SNAPSHOT_FIELD_LOOKUP_TOOL: Tool = {
  name: 'dbx_model_snapshot_field_lookup',
  description: [
    'Look up snapshot-field factories and reusable field constants opted in across @dereekb/firebase (and any downstream packages that registered a model-snapshot-fields manifest).',
    '',
    'Snapshot fields are the building blocks composed inside `snapshotConverterFunctions<T>({ fields: { ... } })` to convert Firestore documents to/from app models — `firestoreString`, `firestoreDate`, `firestoreObjectArray`, `optionalFirestoreBoolean`, `firestoreModelKeyString`, etc.',
    '',
    'The `topic` accepts:',
    '  • a registry slug ("firestore-date", "optional-firestore-array", …);',
    '  • an exported identifier ("firestoreDate", "optionalFirestoreArray", "firestoreModelKeyString");',
    '  • the literal `"list"` for the full catalog grouped by category (primitive, date, array, map, object, model-key, geo, …).',
    '',
    'Use `dbx_model_snapshot_field_search` instead when you only have an intent keyword ("date", "encoded array", "model key") and need ranked candidates.',
    'Use `dbx_model_snapshot_field_list_app` when you want to see which snapshot fields a specific app actually uses.'
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

function fuzzyFields(entry: ModelSnapshotFieldEntryInfo): readonly FuzzyField[] {
  const fields: FuzzyField[] = [
    { value: entry.slug, weight: 4 },
    { value: entry.name, weight: 4 },
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

function appendDeprecationNotice(lines: string[], entry: ModelSnapshotFieldEntryInfo): void {
  if (entry.deprecated === false || entry.deprecated === '') {
    return;
  }
  const deprecationNote = typeof entry.deprecated === 'string' && entry.deprecated.length > 0 ? entry.deprecated : 'This snapshot field is deprecated.';
  lines.push(`> ⚠️ Deprecated: ${deprecationNote}`, '');
}

function appendFullEntrySections(lines: string[], entry: ModelSnapshotFieldEntryInfo): void {
  if (entry.params.length > 0) {
    lines.push('## Params', '', formatParamsTable(entry.params), '');
  }
  if (entry.returns.length > 0) {
    lines.push(`**Returns:** \`${entry.returns}\``, '');
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

function formatEntry(entry: ModelSnapshotFieldEntryInfo, depth: LookupDepth): string {
  const heading = `# ${entry.name}`;
  const lines: string[] = [heading, '', entry.description, '', bullet('slug', `\`${entry.slug}\``), bullet('kind', `\`${entry.kind}\``), bullet('category', `\`${entry.category}\``), bullet('module', `\`${entry.module}\``), bullet('subpath', `\`${entry.subpath}\``), bullet('optional', entry.optional ? 'yes (use this for `Maybe<T>` fields)' : 'no (required)'), bullet('signature', `\`${entry.signature}\``), ''];

  appendDeprecationNotice(lines, entry);

  if (depth === 'full') {
    appendFullEntrySections(lines, entry);
  } else {
    lines.push(`→ Call \`dbx_model_snapshot_field_lookup topic="${entry.slug}" depth="full"\` for the full signature, params, and example.`);
  }

  return lines.join('\n').trimEnd();
}

function formatCatalog(entries: readonly ModelSnapshotFieldEntryInfo[]): string {
  if (entries.length === 0) {
    return ['# Snapshot-field catalog', '', 'No snapshot fields have been registered yet.', '', 'Add a `@dbxModelSnapshotField` JSDoc tag to a function/const, then run `nx run dbx-components-mcp:generate-manifests`.'].join('\n');
  }
  const lines: string[] = ['# Snapshot-field catalog', '', `${entries.length} entries.`, ''];
  const sorted = [...entries].sort((a, b) => {
    const byCategory = a.category.localeCompare(b.category);
    return byCategory === 0 ? a.slug.localeCompare(b.slug) : byCategory;
  });
  let lastCategory: string | undefined;
  for (const entry of sorted) {
    if (entry.category !== lastCategory) {
      lines.push('', `## ${entry.category}`, '');
      lastCategory = entry.category;
    }
    const optBadge = entry.optional ? ' *(optional)*' : '';
    lines.push(`- \`${entry.slug}\` → \`${entry.name}\`${optBadge} *(${entry.kind})* — ${entry.description.split('\n')[0]}`);
  }
  return lines.join('\n').trimEnd();
}

function formatNotFound(normalized: string, candidates: readonly ModelSnapshotFieldEntryInfo[]): string {
  const lines: string[] = [`No snapshot field matched \`${normalized}\`.`, ''];
  if (candidates.length > 0) {
    lines.push('Did you mean one of these?', '');
    for (const entry of candidates) {
      const optBadge = entry.optional ? ' *(optional)*' : '';
      lines.push(`- \`${entry.slug}\` → \`${entry.name}\`${optBadge} *(${entry.kind})* — ${entry.description.split('\n')[0]}`);
    }
  } else {
    lines.push('Try `dbx_model_snapshot_field_lookup topic="list"` to browse the catalog, or `dbx_model_snapshot_field_search query="<keyword>"` for ranked candidates.');
  }
  return lines.join('\n');
}

function code(value: string): string {
  return '`' + value + '`';
}

// MARK: Tool factory
/**
 * Input to {@link createLookupModelSnapshotFieldTool}.
 */
export interface CreateLookupModelSnapshotFieldToolInput {
  /**
   * Snapshot-field registry the tool reads from. The server bootstrap
   * supplies this after loading the bundled `@dereekb/firebase`
   * model-snapshot-fields manifest plus any external manifests declared in
   * `dbx-mcp.config.json`.
   */
  readonly registry: ModelSnapshotFieldRegistry;
}

/**
 * Creates the `dbx_model_snapshot_field_lookup` tool wired to the supplied
 * registry. Tests pass a fixture registry; the production server passes
 * the merged registry from {@link loadModelSnapshotFieldRegistry}.
 *
 * @param input - The registry the tool reads from.
 * @returns A {@link DbxTool} ready to register with the dispatcher.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createLookupModelSnapshotFieldTool(input: CreateLookupModelSnapshotFieldToolInput): DbxTool {
  const { registry } = input;
  const resolveBySlug = (topic: string): Maybe<ModelSnapshotFieldEntryInfo> => registry.findBySlug(topic);
  const resolveByName = (topic: string): Maybe<ModelSnapshotFieldEntryInfo> => registry.findByName(topic);
  const resolveByNameInsensitive = (topic: string): Maybe<ModelSnapshotFieldEntryInfo> => registry.findByNameInsensitive(topic);
  return createLookupTool<ModelSnapshotFieldEntryInfo>({
    definition: DBX_MODEL_SNAPSHOT_FIELD_LOOKUP_TOOL,
    entries: registry.all,
    resolvers: [resolveBySlug, resolveByName, resolveByNameInsensitive],
    fuzzyFields,
    formatCatalog,
    formatEntry,
    formatNotFound
  });
}
