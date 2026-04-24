/**
 * `dbx_examples` tool.
 *
 * Surfaces curated multi-field forge compositions ("contact form", "sign-up",
 * "address form"). Complements `dbx_lookup` — lookup shows a SINGLE field's
 * docs, examples show how to compose several into a working form.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { EXAMPLE_PATTERNS, getExamplePattern, type ExampleDepth, type ExamplePattern } from './data/patterns.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const DEPTH_VALUES = ['minimal', 'brief', 'full'] as const;

// MARK: Tool advertisement
const DBX_EXAMPLES_TOOL: Tool = {
  name: 'dbx_examples',
  description: [
    'Get curated multi-field @dereekb/dbx-form forge compositions — e.g. "contact-form", "sign-up-form", "address-form", "date-range-filter", "tag-picker".',
    '',
    'Pass `pattern="list"` to see every available composition. Pass any slug for a copy-paste-ready example at the requested depth (`minimal`, `brief`, or `full`).',
    '',
    'This complements `dbx_lookup`, which covers single-field docs. Reach for `dbx_examples` when the question is "how do I compose several forge helpers together?"'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Pattern slug, or "list" to browse every available pattern.'
      },
      depth: {
        type: 'string',
        enum: [...DEPTH_VALUES],
        description: "Code detail level. 'minimal' is the shortest; 'full' includes imports, the FormConfig wrapper, and the value-type interface.",
        default: 'full'
      }
    },
    required: ['pattern']
  }
};

// MARK: Input validation
const ExamplesArgsType = type({
  pattern: 'string',
  'depth?': "'minimal' | 'brief' | 'full'"
});

interface ParsedExamplesArgs {
  readonly pattern: string;
  readonly depth: ExampleDepth;
}

function parseExamplesArgs(raw: unknown): ParsedExamplesArgs {
  const parsed = ExamplesArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedExamplesArgs = {
    pattern: parsed.pattern,
    depth: parsed.depth ?? 'full'
  };
  return result;
}

// MARK: Formatting
function formatPatternCatalog(): string {
  const lines: string[] = [`# Forge example patterns (${EXAMPLE_PATTERNS.length})`, '', 'Call `dbx_examples pattern="<slug>"` for a full example.', ''];
  for (const pattern of EXAMPLE_PATTERNS) {
    lines.push(`## ${pattern.name}`);
    lines.push('');
    lines.push(`- **slug:** \`${pattern.slug}\``);
    lines.push(`- **summary:** ${pattern.summary}`);
    lines.push(`- **uses:** ${pattern.usesForgeSlugs.map((s) => `\`${s}\``).join(', ')}`);
    lines.push('');
  }
  const result = lines.join('\n').trimEnd();
  return result;
}

function formatPattern(pattern: ExamplePattern, depth: ExampleDepth): string {
  const snippet = pattern.snippets[depth];
  const sections: string[] = [`# ${pattern.name}`, '', pattern.summary, '', `**slug:** \`${pattern.slug}\` · **depth:** \`${depth}\` · **uses:** ${pattern.usesForgeSlugs.map((s) => `\`${s}\``).join(', ')}`, '', '```ts', snippet, '```'];
  if (pattern.notes && depth === 'full') {
    sections.push('');
    sections.push('## Notes');
    sections.push('');
    sections.push(pattern.notes);
  }
  if (depth !== 'full') {
    sections.push('');
    sections.push(`→ Call \`dbx_examples pattern="${pattern.slug}" depth="full"\` for imports, FormConfig wrapper, and value-type interface.`);
  }
  const result = sections.join('\n');
  return result;
}

function formatNotFound(slug: string): string {
  const available = EXAMPLE_PATTERNS.map((p) => `\`${p.slug}\``).join(', ');
  const result = [`No example pattern matched \`${slug}\`.`, '', `Available patterns: ${available}.`, '', 'Call `dbx_examples pattern="list"` for summaries.'].join('\n');
  return result;
}

// MARK: Handler
export function runExamples(rawArgs: unknown): ToolResult {
  let args: ParsedExamplesArgs;
  try {
    args = parseExamplesArgs(rawArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toolError(message);
  }

  const lowered = args.pattern.trim().toLowerCase();
  let text: string;
  if (lowered === 'list' || lowered === 'catalog' || lowered === 'all') {
    text = formatPatternCatalog();
  } else {
    const pattern = getExamplePattern(args.pattern);
    text = pattern ? formatPattern(pattern, args.depth) : formatNotFound(args.pattern);
  }

  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const examplesTool: DbxTool = {
  definition: DBX_EXAMPLES_TOOL,
  run: runExamples
};
