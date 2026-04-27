/**
 * `dbx_filter_lookup` tool.
 *
 * Filter-cluster lookup. Accepts a topic (slug, class name, directive selector
 * with or without brackets, or the literal `'list'`) and a depth; returns
 * markdown documentation for the matched filter entry.
 *
 * Resolution order:
 *   1. `'list'` / `'catalog'` / `'all'` → catalog
 *   2. Exact slug match → single entry
 *   3. Directive selector match (with or without brackets) → directive entry
 *   4. Class name match → entry
 *   5. Fuzzy substring → "did you mean…"
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type Maybe } from '@dereekb/util';
import type { FilterEntryInfo, FilterRegistry } from '../registry/filters-runtime.js';
import { createLookupTool, type FuzzyField, type LookupDepth } from './_lookup.factory.js';
import { type DbxTool } from './types.js';

// MARK: Tool definition
const DBX_FILTER_LOOKUP_TOOL: Tool = {
  name: 'dbx_filter_lookup',
  description: [
    'Look up the @dereekb/dbx-core filter directive surface — `[dbxFilterSource]`, `[dbxFilterMap]`, source/connector pairings, plus the `ClickableFilterPreset` pattern.',
    '',
    'The `topic` accepts:',
    '  • a registry slug ("source", "source-connector", "map", "map-source", "clickable-preset");',
    '  • a directive selector with or without brackets ("[dbxFilterSource]", "dbxFilterMap");',
    '  • a class name ("DbxFilterSourceDirective");',
    '  • the literal `"list"` for the full filter catalog.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Slug, selector, class name, or "list".' },
      depth: { type: 'string', enum: ['brief', 'full'], default: 'full', description: 'Detail level for single-entry hits.' }
    },
    required: ['topic']
  }
};

function filterFuzzyFields(entry: FilterEntryInfo): readonly FuzzyField[] {
  return [
    { value: entry.slug, weight: 3 },
    { value: entry.className, weight: 2 },
    { value: entry.selector, weight: 2 },
    { value: entry.description, weight: 1 }
  ];
}

// MARK: Formatting
function bullet(label: string, value: string): string {
  return `- **${label}:** ${value}`;
}

function formatInputsTable(inputs: readonly { readonly name: string; readonly type: string; readonly description: string }[]): string {
  const lines: string[] = ['| Input | Type | Description |', '| --- | --- | --- |'];
  for (const input of inputs) {
    lines.push(`| \`${input.name}\` | \`${input.type}\` | ${input.description} |`);
  }
  return lines.join('\n');
}

function formatEntry(entry: FilterEntryInfo, depth: LookupDepth): string {
  const lines: string[] = [`# ${entry.className}`, '', entry.description, '', bullet('slug', `\`${entry.slug}\``), bullet('kind', `\`${entry.kind}\``)];
  if (entry.selector) {
    lines.push(bullet('selector', `\`${entry.selector}\``));
  }
  lines.push(bullet('module', `\`${entry.module}\``), '');

  if (depth === 'full') {
    if (entry.inputs.length > 0) {
      lines.push('## Inputs', '', formatInputsTable(entry.inputs), '');
    }
    const fence = entry.kind === 'pattern' ? 'ts' : 'html';
    lines.push('## Example', '', '```' + fence, entry.example, '```');
    if (entry.relatedSlugs.length > 0) {
      const relatedText = entry.relatedSlugs.map((s) => code(s)).join(', ');
      lines.push('', `→ Related: ${relatedText}`);
    }
    if (entry.skillRefs.length > 0) {
      const skillsText = entry.skillRefs.map((s) => code(s)).join(', ');
      lines.push('', `→ Skills: ${skillsText}`);
    }
  } else {
    lines.push(`→ Call \`dbx_filter_lookup topic="${entry.slug}" depth="full"\` for inputs and the example.`);
  }

  return lines.join('\n');
}

function formatCatalog(entries: readonly FilterEntryInfo[]): string {
  const lines: string[] = ['# Filter catalog', '', `${entries.length} entries.`, ''];
  for (const entry of entries) {
    const selector = entry.selector ? ` \`${entry.selector}\`` : '';
    lines.push(`- \`${entry.slug}\` → ${entry.className}${selector}`, `  ${entry.description}`);
  }
  return lines.join('\n').trimEnd();
}

function formatNotFound(normalized: string, candidates: readonly FilterEntryInfo[]): string {
  const lines: string[] = [`No filter entry matched \`${normalized}\`.`, ''];
  if (candidates.length > 0) {
    lines.push('Did you mean one of these?', '');
    for (const entry of candidates) {
      const selector = entry.selector ? ` \`${entry.selector}\`` : '';
      lines.push(`- \`${entry.slug}\` → ${entry.className}${selector} — ${entry.description}`);
    }
  } else {
    lines.push('Try `dbx_filter_lookup topic="list"` to browse the catalog.');
  }
  return lines.join('\n');
}

function code(value: string): string {
  return '`' + value + '`';
}

// MARK: Tool factory
/**
 * Input to {@link createLookupFilterTool}.
 */
export interface CreateLookupFilterToolInput {
  /**
   * Filter registry the tool reads from. The server bootstrap supplies this
   * after loading the bundled `@dereekb/dbx-core` filters manifest plus any
   * external manifests declared in `dbx-mcp.config.json`.
   */
  readonly registry: FilterRegistry;
}

/**
 * Creates the `dbx_filter_lookup` tool wired to the supplied registry. Tests
 * pass a fixture registry; the production server passes the merged registry
 * from {@link loadFilterRegistry}.
 *
 * @param input - the registry the tool reads from
 * @returns a {@link DbxTool} ready to register with the dispatcher
 */
export function createLookupFilterTool(input: CreateLookupFilterToolInput): DbxTool {
  const { registry } = input;
  const resolveBySlug = (topic: string): Maybe<FilterEntryInfo> => registry.findBySlug(topic);
  const resolveBySelector = (topic: string): Maybe<FilterEntryInfo> => registry.findBySelector(topic);
  const resolveByClassName = (topic: string): Maybe<FilterEntryInfo> => registry.findByClassName(topic);
  return createLookupTool<FilterEntryInfo>({
    definition: DBX_FILTER_LOOKUP_TOOL,
    entries: registry.all,
    resolvers: [resolveBySlug, resolveBySelector, resolveByClassName],
    fuzzyFields: filterFuzzyFields,
    formatCatalog,
    formatEntry,
    formatNotFound
  });
}
