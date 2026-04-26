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
import { type } from 'arktype';
import { type Maybe } from '@dereekb/util';
import { PIPE_ENTRIES, getPipeEntry, getPipeEntryByClassName, getPipeEntryByPipeName, type PipeEntryInfo, type PipeRegistrySlug } from './data/pipe-entries.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

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

// MARK: Input validation
const LookupPipeArgsType = type({
  topic: 'string',
  'depth?': "'brief' | 'full'"
});

interface ParsedLookupPipeArgs {
  readonly topic: string;
  readonly depth: 'brief' | 'full';
}

function parseArgs(raw: unknown): ParsedLookupPipeArgs {
  const parsed = LookupPipeArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedLookupPipeArgs = {
    topic: parsed.topic,
    depth: parsed.depth ?? 'full'
  };
  return result;
}

// MARK: Resolution
type LookupPipeMatch = { readonly kind: 'single'; readonly entry: PipeEntryInfo } | { readonly kind: 'catalog' } | { readonly kind: 'not-found'; readonly normalized: string; readonly candidates: readonly PipeEntryInfo[] };

function resolveTopic(rawTopic: string): LookupPipeMatch {
  const trimmed = rawTopic.trim();
  const lowered = trimmed.toLowerCase();
  let result: LookupPipeMatch;

  if (lowered === 'list' || lowered === 'catalog' || lowered === 'all') {
    result = { kind: 'catalog' };
  } else {
    const slugHit = getPipeEntry(trimmed);
    if (slugHit) {
      result = { kind: 'single', entry: slugHit };
    } else {
      const pipeHit = getPipeEntryByPipeName(trimmed);
      if (pipeHit) {
        result = { kind: 'single', entry: pipeHit };
      } else {
        const classHit = getPipeEntryByClassName(trimmed);
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

function fuzzyCandidates(query: string): readonly PipeEntryInfo[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return [];
  }
  const scored: { readonly entry: PipeEntryInfo; readonly score: number }[] = [];
  for (const entry of PIPE_ENTRIES) {
    let score = 0;
    if (entry.slug.toLowerCase().includes(q)) {
      score += 3;
    }
    if (entry.pipeName.toLowerCase().includes(q)) {
      score += 3;
    }
    if (entry.className.toLowerCase().includes(q)) {
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

function formatArgsTable(args: readonly { readonly name: string; readonly type: string; readonly description: string; readonly required: boolean }[]): string {
  const lines: string[] = ['| Arg | Type | Required | Description |', '| --- | --- | --- | --- |'];
  for (const arg of args) {
    lines.push(`| \`${arg.name}\` | \`${arg.type}\` | ${arg.required ? 'yes' : 'no'} | ${arg.description} |`);
  }
  return lines.join('\n');
}

function formatEntry(entry: PipeEntryInfo, depth: 'brief' | 'full'): string {
  const lines: string[] = [];
  lines.push(`# ${entry.className}`);
  lines.push('');
  lines.push(entry.description);
  lines.push('');
  lines.push(bullet('slug', `\`${entry.slug}\``));
  lines.push(bullet('pipe', `\`${entry.pipeName}\``));
  lines.push(bullet('category', `\`${entry.category}\``));
  lines.push(bullet('purity', `\`${entry.purity}\``));
  lines.push(bullet('input', `\`${entry.inputType}\``));
  lines.push(bullet('output', `\`${entry.outputType}\``));
  lines.push(bullet('module', `\`${entry.module}\``));
  lines.push('');

  if (depth === 'full') {
    if (entry.args.length > 0) {
      lines.push('## Args');
      lines.push('');
      lines.push(formatArgsTable(entry.args));
      lines.push('');
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

function formatCatalog(): string {
  const lines: string[] = ['# Pipe catalog', '', `${PIPE_ENTRIES.length} entries.`, ''];
  let lastCategory: Maybe<string>;
  for (const entry of PIPE_ENTRIES) {
    if (entry.category !== lastCategory) {
      lines.push('');
      lines.push(`## ${entry.category}`);
      lines.push('');
      lastCategory = entry.category;
    }
    lines.push(`- \`${entry.slug}\` → \`${entry.pipeName}\` (${entry.className})`);
    lines.push(`  ${entry.description}`);
  }
  return lines.join('\n').trimEnd();
}

function formatNotFound(normalized: string, candidates: readonly PipeEntryInfo[]): string {
  const lines: string[] = [`No pipe entry matched \`${normalized}\`.`, ''];
  if (candidates.length > 0) {
    lines.push('Did you mean one of these?');
    lines.push('');
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

// MARK: Handler
/**
 * Tool handler for `dbx_pipe_lookup`. Resolves the requested pipe topic
 * against the registry and renders the matching catalog, category group,
 * single entry, or not-found suggestion list.
 *
 * @param rawArgs - the unvalidated tool arguments from the MCP runtime
 * @returns the rendered match, or an error result when args fail validation
 */
export function runLookupPipe(rawArgs: unknown): ToolResult {
  let args: ParsedLookupPipeArgs;
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

export const lookupPipeTool: DbxTool = {
  definition: DBX_PIPE_LOOKUP_TOOL,
  run: runLookupPipe
};

// Re-export so consumers don't need to reach into `data/`.
export type { PipeRegistrySlug };
