/**
 * `dbx_pipe_lookup` tool.
 *
 * Pipe-cluster lookup. Accepts a topic (slug, Angular pipe name, class name,
 * or the literal `'list'`) and a depth; returns markdown documentation for
 * the matched pipe entry.
 *
 * Resolution order:
 *   1. `'list'` / `'catalog'` / `'all'` → catalog
 *   2. Exact slug match → single entry
 *   3. Pipe name match (case sensitive — Angular pipes are camelCase) → entry
 *   4. Class name match → entry
 *   5. Fuzzy substring → "did you mean…"
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type Maybe } from '@dereekb/util';
import type { PipeEntryInfo, PipeRegistry } from '../registry/pipes-runtime.js';
import { createLookupTool, type FuzzyField, type LookupDepth } from './_lookup.factory.js';
import { type DbxTool } from './types.js';

// MARK: Tool definition
const DBX_PIPE_LOOKUP_TOOL: Tool = {
  name: 'dbx_pipe_lookup',
  description: [
    'Look up the @dereekb/dbx-core Angular pipe surface — value pipes (`dollarAmount`, `cutText`, `getValue`/`getValueOnce`), the async helper (`asObservable`), the `prettyjson` debug pipe, and the date pipe family.',
    '',
    'The `topic` accepts:',
    '  • a registry slug ("dollar-amount", "get-value", "date-distance", …);',
    '  • an Angular pipe name ("dollarAmount", "cutText", "dateTimeRange");',
    '  • a class name ("DollarAmountPipe", "DateDistancePipe");',
    '  • the literal `"list"` for the full pipe catalog.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Slug, pipe name, class name, or "list".' },
      depth: { type: 'string', enum: ['brief', 'full'], default: 'full', description: 'Detail level for single-entry hits.' }
    },
    required: ['topic']
  }
};

function pipeFuzzyFields(entry: PipeEntryInfo): readonly FuzzyField[] {
  return [
    { value: entry.slug, weight: 3 },
    { value: entry.pipeName, weight: 3 },
    { value: entry.className, weight: 2 },
    { value: entry.description, weight: 1 }
  ];
}

// MARK: Formatting
function bullet(label: string, value: string): string {
  return `- **${label}:** ${value}`;
}

function formatArgsTable(args: readonly { readonly name: string; readonly type: string; readonly description: string; readonly required: boolean }[]): string {
  const lines: string[] = ['| Arg | Type | Required | Description |', '| --- | --- | --- | --- |'];
  for (const arg of args) {
    lines.push(`| \`${arg.name}\` | \`${arg.type}\` | ${arg.required ? 'yes' : 'no'} | ${arg.description} |`);
  }
  return lines.join('\n');
}

function formatEntry(entry: PipeEntryInfo, depth: LookupDepth): string {
  const lines: string[] = [`# ${entry.className}`, '', entry.description, '', bullet('slug', `\`${entry.slug}\``), bullet('pipe', `\`${entry.pipeName}\``), bullet('category', `\`${entry.category}\``), bullet('purity', `\`${entry.purity}\``), bullet('input', `\`${entry.inputType}\``), bullet('output', `\`${entry.outputType}\``), bullet('module', `\`${entry.module}\``), ''];

  if (depth === 'full') {
    if (entry.args.length > 0) {
      lines.push('## Args', '', formatArgsTable(entry.args), '');
    }
    lines.push('## Example', '', '```html', entry.example, '```');
    if (entry.relatedSlugs.length > 0) {
      const relatedText = entry.relatedSlugs.map((s) => code(s)).join(', ');
      lines.push('', `→ Related: ${relatedText}`);
    }
    if (entry.skillRefs.length > 0) {
      const skillsText = entry.skillRefs.map((s) => code(s)).join(', ');
      lines.push('', `→ Skills: ${skillsText}`);
    }
  } else {
    lines.push(`→ Call \`dbx_pipe_lookup topic="${entry.slug}" depth="full"\` for args and the example.`);
  }

  return lines.join('\n');
}

function formatCatalog(entries: readonly PipeEntryInfo[]): string {
  const lines: string[] = ['# Pipe catalog', '', `${entries.length} entries.`, ''];
  let lastCategory: Maybe<string>;
  for (const entry of entries) {
    if (entry.category !== lastCategory) {
      lines.push('', `## ${entry.category}`, '');
      lastCategory = entry.category;
    }
    lines.push(`- \`${entry.slug}\` → \`${entry.pipeName}\` (${entry.className})`, `  ${entry.description}`);
  }
  return lines.join('\n').trimEnd();
}

function formatNotFound(normalized: string, candidates: readonly PipeEntryInfo[]): string {
  const lines: string[] = [`No pipe entry matched \`${normalized}\`.`, ''];
  if (candidates.length > 0) {
    lines.push('Did you mean one of these?', '');
    for (const entry of candidates) {
      lines.push(`- \`${entry.slug}\` → \`${entry.pipeName}\` (${entry.className}) — ${entry.description}`);
    }
  } else {
    lines.push('Try `dbx_pipe_lookup topic="list"` to browse the catalog.');
  }
  return lines.join('\n');
}

function code(value: string): string {
  return '`' + value + '`';
}

// MARK: Tool factory
/**
 * Input to {@link createLookupPipeTool}.
 */
export interface CreateLookupPipeToolInput {
  /**
   * Pipe registry the tool reads from. The server bootstrap supplies this
   * after loading the bundled `@dereekb/dbx-core` pipes manifest plus any
   * external manifests declared in `dbx-mcp.config.json`.
   */
  readonly registry: PipeRegistry;
}

/**
 * Creates the `dbx_pipe_lookup` tool wired to the supplied registry. Tests
 * pass a fixture registry; the production server passes the merged registry
 * from {@link loadPipeRegistry}.
 *
 * @param input - the registry the tool reads from
 * @returns a {@link DbxTool} ready to register with the dispatcher
 */
export function createLookupPipeTool(input: CreateLookupPipeToolInput): DbxTool {
  const { registry } = input;
  const resolveBySlug = (topic: string): Maybe<PipeEntryInfo> => registry.findBySlug(topic);
  const resolveByPipeName = (topic: string): Maybe<PipeEntryInfo> => registry.findByPipeName(topic);
  const resolveByClassName = (topic: string): Maybe<PipeEntryInfo> => registry.findByClassName(topic);
  return createLookupTool<PipeEntryInfo>({
    definition: DBX_PIPE_LOOKUP_TOOL,
    entries: registry.all,
    resolvers: [resolveBySlug, resolveByPipeName, resolveByClassName],
    fuzzyFields: pipeFuzzyFields,
    formatCatalog,
    formatEntry,
    formatNotFound
  });
}
