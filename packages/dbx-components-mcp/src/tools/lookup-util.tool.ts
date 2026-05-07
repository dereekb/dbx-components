/**
 * `dbx_util_lookup` tool.
 *
 * Util-cluster lookup. Accepts a topic (slug, exported identifier, or the
 * literal `'list'`) and a depth; returns markdown documentation for the
 * matched utility entry.
 *
 * Resolution order:
 *   1. `'list'` / `'catalog'` / `'all'` → catalog grouped by category
 *   2. Exact slug match → single entry
 *   3. Exact export name (case-sensitive — utility names are camelCase) → entry
 *   4. Case-insensitive name match → entry
 *   5. Fuzzy substring across slug + name + tags + description → "did you mean…"
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type Maybe } from '@dereekb/util';
import type { UtilEntryInfo, UtilRegistry } from '../registry/utils-runtime.js';
import { createLookupTool, type FuzzyField, type LookupDepth } from './_lookup.factory.js';
import { type DbxTool } from './types.js';

// MARK: Tool definition
const DBX_UTIL_LOOKUP_TOOL: Tool = {
  name: 'dbx_util_lookup',
  description: [
    'Look up utility functions, classes, factories, and constants opted in across @dereekb/util, @dereekb/date, @dereekb/rxjs, @dereekb/model (and any downstream packages that registered a utils manifest).',
    '',
    'The `topic` accepts:',
    '  • a registry slug ("expiration-details", "is-throttled", …);',
    '  • an exported identifier ("expirationDetails", "isThrottled", "ExpirationDetails");',
    '  • the literal `"list"` for the full utility catalog grouped by category.',
    '',
    'Use `dbx_util_search` instead when you only have an intent keyword ("expiration", "throttle", "memoize") and need ranked candidates.'
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

function utilFuzzyFields(entry: UtilEntryInfo): readonly FuzzyField[] {
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

function appendDeprecationNotice(lines: string[], entry: UtilEntryInfo): void {
  if (entry.deprecated === false || entry.deprecated === '') {
    return;
  }
  const deprecationNote = typeof entry.deprecated === 'string' && entry.deprecated.length > 0 ? entry.deprecated : 'This utility is deprecated.';
  lines.push(`> ⚠️ Deprecated: ${deprecationNote}`, '');
}

function appendFullEntrySections(lines: string[], entry: UtilEntryInfo): void {
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

function formatEntry(entry: UtilEntryInfo, depth: LookupDepth): string {
  const heading = `# ${entry.name}`;
  const lines: string[] = [heading, '', entry.description, '', bullet('slug', `\`${entry.slug}\``), bullet('kind', `\`${entry.kind}\``), bullet('category', `\`${entry.category}\``), bullet('module', `\`${entry.module}\``), bullet('subpath', `\`${entry.subpath}\``), bullet('signature', `\`${entry.signature}\``), ''];

  appendDeprecationNotice(lines, entry);

  if (depth === 'full') {
    appendFullEntrySections(lines, entry);
  } else {
    lines.push(`→ Call \`dbx_util_lookup topic="${entry.slug}" depth="full"\` for the full signature, params, and example.`);
  }

  return lines.join('\n').trimEnd();
}

function formatCatalog(entries: readonly UtilEntryInfo[]): string {
  if (entries.length === 0) {
    return ['# Utility catalog', '', 'No utilities have been registered yet.', '', 'Add a `@dbxUtil` JSDoc tag to a function/class/const, then run `nx run dbx-components-mcp:generate-manifests`.'].join('\n');
  }
  const lines: string[] = ['# Utility catalog', '', `${entries.length} entries.`, ''];
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
    lines.push(`- \`${entry.slug}\` → \`${entry.name}\` *(${entry.kind})* — ${entry.description.split('\n')[0]}`);
  }
  return lines.join('\n').trimEnd();
}

function formatNotFound(normalized: string, candidates: readonly UtilEntryInfo[]): string {
  const lines: string[] = [`No utility matched \`${normalized}\`.`, ''];
  if (candidates.length > 0) {
    lines.push('Did you mean one of these?', '');
    for (const entry of candidates) {
      lines.push(`- \`${entry.slug}\` → \`${entry.name}\` *(${entry.kind})* — ${entry.description.split('\n')[0]}`);
    }
  } else {
    lines.push('Try `dbx_util_lookup topic="list"` to browse the catalog, or `dbx_util_search query="<keyword>"` for ranked candidates.');
  }
  return lines.join('\n');
}

function code(value: string): string {
  return '`' + value + '`';
}

// MARK: Tool factory
/**
 * Input to {@link createLookupUtilTool}.
 */
export interface CreateLookupUtilToolInput {
  /**
   * Util registry the tool reads from. The server bootstrap supplies this
   * after loading the bundled `@dereekb/*` utils manifests plus any
   * external manifests declared in `dbx-mcp.config.json`.
   */
  readonly registry: UtilRegistry;
}

/**
 * Creates the `dbx_util_lookup` tool wired to the supplied registry.
 * Tests pass a fixture registry; the production server passes the merged
 * registry from {@link loadUtilRegistry}.
 *
 * @param input - the registry the tool reads from
 * @returns a {@link DbxTool} ready to register with the dispatcher
 */
export function createLookupUtilTool(input: CreateLookupUtilToolInput): DbxTool {
  const { registry } = input;
  const resolveBySlug = (topic: string): Maybe<UtilEntryInfo> => registry.findBySlug(topic);
  const resolveByName = (topic: string): Maybe<UtilEntryInfo> => registry.findByName(topic);
  const resolveByNameInsensitive = (topic: string): Maybe<UtilEntryInfo> => registry.findByNameInsensitive(topic);
  return createLookupTool<UtilEntryInfo>({
    definition: DBX_UTIL_LOOKUP_TOOL,
    entries: registry.all,
    resolvers: [resolveBySlug, resolveByName, resolveByNameInsensitive],
    fuzzyFields: utilFuzzyFields,
    formatCatalog,
    formatEntry,
    formatNotFound
  });
}
