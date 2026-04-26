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
import { type } from 'arktype';
import { FILTER_ENTRIES, getFilterEntry, getFilterEntryByClassName, getFilterEntryBySelector, type FilterEntryInfo } from './data/filter-entries.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

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

// MARK: Input validation
const LookupFilterArgsType = type({
  topic: 'string',
  'depth?': "'brief' | 'full'"
});

interface ParsedLookupFilterArgs {
  readonly topic: string;
  readonly depth: 'brief' | 'full';
}

function parseArgs(raw: unknown): ParsedLookupFilterArgs {
  const parsed = LookupFilterArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedLookupFilterArgs = {
    topic: parsed.topic,
    depth: parsed.depth ?? 'full'
  };
  return result;
}

// MARK: Resolution
type LookupFilterMatch = { readonly kind: 'single'; readonly entry: FilterEntryInfo } | { readonly kind: 'catalog' } | { readonly kind: 'not-found'; readonly normalized: string; readonly candidates: readonly FilterEntryInfo[] };

function resolveTopic(rawTopic: string): LookupFilterMatch {
  const trimmed = rawTopic.trim();
  const lowered = trimmed.toLowerCase();
  let result: LookupFilterMatch;

  if (lowered === 'list' || lowered === 'catalog' || lowered === 'all') {
    result = { kind: 'catalog' };
  } else {
    const slugHit = getFilterEntry(trimmed);
    if (slugHit) {
      result = { kind: 'single', entry: slugHit };
    } else {
      const selectorHit = getFilterEntryBySelector(trimmed);
      if (selectorHit) {
        result = { kind: 'single', entry: selectorHit };
      } else {
        const classHit = getFilterEntryByClassName(trimmed);
        if (classHit) {
          result = { kind: 'single', entry: classHit };
        } else {
          result = { kind: 'not-found', normalized: lowered, candidates: fuzzyCandidates(lowered) };
        }
      }
    }
  }
  return result;
}

function fuzzyCandidates(query: string): readonly FilterEntryInfo[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return [];
  }
  const scored: { readonly entry: FilterEntryInfo; readonly score: number }[] = [];
  for (const entry of FILTER_ENTRIES) {
    let score = 0;
    if (entry.slug.toLowerCase().includes(q)) {
      score += 3;
    }
    if (entry.className.toLowerCase().includes(q)) {
      score += 2;
    }
    if (entry.selector?.toLowerCase().includes(q)) {
      score += 2;
    }
    if (entry.description.toLowerCase().includes(q)) {
      score += 1;
    }
    if (score > 0) {
      scored.push({ entry, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map((s) => s.entry);
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

function formatEntry(entry: FilterEntryInfo, depth: 'brief' | 'full'): string {
  const lines: string[] = [];
  lines.push(`# ${entry.className}`);
  lines.push('');
  lines.push(entry.description);
  lines.push('');
  lines.push(bullet('slug', `\`${entry.slug}\``));
  lines.push(bullet('kind', `\`${entry.kind}\``));
  if (entry.selector) {
    lines.push(bullet('selector', `\`${entry.selector}\``));
  }
  lines.push(bullet('module', `\`${entry.module}\``));
  lines.push('');

  if (depth === 'full') {
    if (entry.inputs.length > 0) {
      lines.push('## Inputs');
      lines.push('');
      lines.push(formatInputsTable(entry.inputs));
      lines.push('');
    }
    lines.push('## Example');
    lines.push('');
    const fence = entry.kind === 'pattern' ? 'ts' : 'html';
    lines.push('```' + fence);
    lines.push(entry.example);
    lines.push('```');
    if (entry.relatedSlugs.length > 0) {
      const relatedText = entry.relatedSlugs.map((s) => code(s)).join(', ');
      lines.push('');
      lines.push(`→ Related: ${relatedText}`);
    }
    if (entry.skillRefs.length > 0) {
      const skillsText = entry.skillRefs.map((s) => code(s)).join(', ');
      lines.push('');
      lines.push(`→ Skills: ${skillsText}`);
    }
  } else {
    lines.push(`→ Call \`dbx_filter_lookup topic="${entry.slug}" depth="full"\` for inputs and the example.`);
  }

  return lines.join('\n');
}

function formatCatalog(): string {
  const lines: string[] = ['# Filter catalog', '', `${FILTER_ENTRIES.length} entries.`, ''];
  for (const entry of FILTER_ENTRIES) {
    const selector = entry.selector ? ` \`${entry.selector}\`` : '';
    lines.push(`- \`${entry.slug}\` → ${entry.className}${selector}`);
    lines.push(`  ${entry.description}`);
  }
  return lines.join('\n').trimEnd();
}

function formatNotFound(normalized: string, candidates: readonly FilterEntryInfo[]): string {
  const lines: string[] = [`No filter entry matched \`${normalized}\`.`, ''];
  if (candidates.length > 0) {
    lines.push('Did you mean one of these?');
    lines.push('');
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

// MARK: Handler
/**
 * Tool handler for `dbx_filter_lookup`. Resolves the requested filter topic
 * against the registry and renders the matching catalog, kind group, single
 * entry, or not-found suggestion list.
 *
 * @param rawArgs - the unvalidated tool arguments from the MCP runtime
 * @returns the rendered match, or an error result when args fail validation
 */
export function runLookupFilter(rawArgs: unknown): ToolResult {
  let args: ParsedLookupFilterArgs;
  try {
    args = parseArgs(rawArgs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }

  const match = resolveTopic(args.topic);
  let text: string;
  let isError = false;
  switch (match.kind) {
    case 'catalog':
      text = formatCatalog();
      break;
    case 'single':
      text = formatEntry(match.entry, args.depth);
      break;
    case 'not-found':
      text = formatNotFound(match.normalized, match.candidates);
      isError = true;
      break;
  }

  const result: ToolResult = { content: [{ type: 'text', text }], isError };
  return result;
}

export const lookupFilterTool: DbxTool = {
  definition: DBX_FILTER_LOOKUP_TOOL,
  run: runLookupFilter
};
