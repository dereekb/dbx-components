/**
 * `dbx_action_examples` tool.
 *
 * Surfaces curated multi-directive action wirings — "button confirm delete",
 * "form submit", "auto-trigger on modify", etc. Complements
 * `dbx_action_lookup` (single-directive docs) by answering "how do I compose
 * these directives into a working action stack?".
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ACTION_EXAMPLE_PATTERNS, getActionExamplePattern, type ActionExampleDepth, type ActionExamplePattern } from './data/action-patterns.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const DEPTH_VALUES = ['minimal', 'brief', 'full'] as const;

// MARK: Tool advertisement
const DBX_ACTION_EXAMPLES_TOOL: Tool = {
  name: 'dbx_action_examples',
  description: [
    'Get curated dbx-core action wirings — e.g. "button-confirm-delete", "form-submit", "auto-trigger-on-modify", "disabled-by-key", "value-getter-on-trigger", "provide-context-up".',
    '',
    'Pass `pattern="list"` to see every available wiring. Pass any slug for a copy-paste-ready snippet at the requested depth (`minimal`, `brief`, or `full`).',
    '',
    'This complements `dbx_action_lookup`, which covers single-directive docs. Reach for `dbx_action_examples` when the question is "how do I assemble the directive stack for X?"'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Pattern slug, or "list" to browse every available wiring.'
      },
      depth: {
        type: 'string',
        enum: [...DEPTH_VALUES],
        description: "Code detail level. 'minimal' is the shortest; 'full' includes a full component with imports, state stores, and handlers.",
        default: 'full'
      }
    },
    required: ['pattern']
  }
};

// MARK: Input validation
const ActionExamplesArgsType = type({
  pattern: 'string',
  'depth?': "'minimal' | 'brief' | 'full'"
});

interface ParsedActionExamplesArgs {
  readonly pattern: string;
  readonly depth: ActionExampleDepth;
}

function parseActionExamplesArgs(raw: unknown): ParsedActionExamplesArgs {
  const parsed = ActionExamplesArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedActionExamplesArgs = {
    pattern: parsed.pattern,
    depth: parsed.depth ?? 'full'
  };
  return result;
}

// MARK: Formatting
function formatPatternCatalog(): string {
  const lines: string[] = [`# Action example patterns (${ACTION_EXAMPLE_PATTERNS.length})`, '', 'Call `dbx_action_examples pattern="<slug>"` for a full example.', ''];
  for (const pattern of ACTION_EXAMPLE_PATTERNS) {
    const usesText = pattern.usesActionSlugs.map((s) => code(s)).join(', ');
    lines.push(`## ${pattern.name}`, '', `- **slug:** \`${pattern.slug}\``, `- **summary:** ${pattern.summary}`, `- **uses:** ${usesText}`, '');
  }
  return lines.join('\n').trimEnd();
}

function formatPattern(pattern: ActionExamplePattern, depth: ActionExampleDepth): string {
  const snippet = pattern.snippets[depth];
  const fence = depth === 'full' ? 'ts' : 'html';
  const usesText = pattern.usesActionSlugs.map((s) => code(s)).join(', ');
  const sections: string[] = [`# ${pattern.name}`, '', pattern.summary, '', `**slug:** \`${pattern.slug}\` · **depth:** \`${depth}\` · **uses:** ${usesText}`, '', '```' + fence, snippet, '```'];
  if (pattern.notes && depth === 'full') {
    sections.push('');
    sections.push('## Notes');
    sections.push('');
    sections.push(pattern.notes);
  }
  if (depth !== 'full') {
    sections.push('');
    sections.push(`→ Call \`dbx_action_examples pattern="${pattern.slug}" depth="full"\` for the full component including imports, stores, and handler wiring.`);
  }
  return sections.join('\n');
}

function formatNotFound(slug: string): string {
  const available = ACTION_EXAMPLE_PATTERNS.map((p) => code(p.slug)).join(', ');
  return [`No action example pattern matched \`${slug}\`.`, '', `Available patterns: ${available}.`, '', 'Call `dbx_action_examples pattern="list"` for summaries.'].join('\n');
}

function code(value: string): string {
  return '`' + value + '`';
}

// MARK: Handler
/**
 * Tool handler for `dbx_action_examples`. Resolves an action example pattern
 * from the registry, formats it at the requested depth, and packages the
 * result as a tool content payload.
 *
 * @param rawArgs - the unvalidated tool arguments object from the MCP runtime
 * @returns the formatted pattern text, or an error result when args fail validation
 */
export function runActionExamples(rawArgs: unknown): ToolResult {
  let args: ParsedActionExamplesArgs;
  try {
    args = parseActionExamplesArgs(rawArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toolError(message);
  }

  const lowered = args.pattern.trim().toLowerCase();
  let text: string;
  if (lowered === 'list' || lowered === 'catalog' || lowered === 'all') {
    text = formatPatternCatalog();
  } else {
    const pattern = getActionExamplePattern(args.pattern);
    text = pattern ? formatPattern(pattern, args.depth) : formatNotFound(args.pattern);
  }

  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const actionExamplesTool: DbxTool = {
  definition: DBX_ACTION_EXAMPLES_TOOL,
  run: runActionExamples
};
