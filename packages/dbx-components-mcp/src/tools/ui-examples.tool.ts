/**
 * `dbx_ui_examples` tool.
 *
 * Surfaces curated multi-component dbx-web compositions ("settings section",
 * "list page", "two-column master/detail", "card with action"). Complements
 * `dbx_ui_lookup` — lookup shows a SINGLE component's docs, examples show how
 * to compose several into a working layout.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { UI_PATTERNS, getUiExamplePattern, type UiExampleDepth, type UiExamplePattern } from './data/ui-patterns.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const DEPTH_VALUES = ['minimal', 'brief', 'full'] as const;

// MARK: Tool advertisement
const DBX_UI_EXAMPLES_TOOL: Tool = {
  name: 'dbx_ui_examples',
  description: [
    'Get curated multi-component @dereekb/dbx-web compositions — e.g. "settings-section", "list-page", "two-column-detail", "card-with-action", "loading-with-empty", "sidenav-app-shell".',
    '',
    'Pass `pattern="list"` to see every available composition. Pass any slug for a copy-paste-ready example at the requested depth (`minimal`, `brief`, or `full`).',
    '',
    'This complements `dbx_ui_lookup`, which covers single-component docs. Reach for `dbx_ui_examples` when the question is "how do I lay out a ___ with dbx-web?"'
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
        description: "Code detail level. 'minimal' is the shortest; 'full' includes imports and a complete component skeleton.",
        default: 'full'
      }
    },
    required: ['pattern']
  }
};

// MARK: Input validation
const UiExamplesArgsType = type({
  pattern: 'string',
  'depth?': "'minimal' | 'brief' | 'full'"
});

interface ParsedUiExamplesArgs {
  readonly pattern: string;
  readonly depth: UiExampleDepth;
}

function parseUiExamplesArgs(raw: unknown): ParsedUiExamplesArgs {
  const parsed = UiExamplesArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedUiExamplesArgs = {
    pattern: parsed.pattern,
    depth: parsed.depth ?? 'full'
  };
  return result;
}

// MARK: Formatting
function formatPatternCatalog(): string {
  const lines: string[] = [`# UI example patterns (${UI_PATTERNS.length})`, '', 'Call `dbx_ui_examples pattern="<slug>"` for a full example.', ''];
  for (const pattern of UI_PATTERNS) {
    lines.push(`## ${pattern.name}`);
    lines.push('');
    const usesText = pattern.usesUiSlugs.map((s) => code(s)).join(', ');
    lines.push(`- **slug:** \`${pattern.slug}\``);
    lines.push(`- **summary:** ${pattern.summary}`);
    lines.push(`- **uses:** ${usesText}`);
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

function formatPattern(pattern: UiExamplePattern, depth: UiExampleDepth): string {
  const snippet = pattern.snippets[depth];
  const usesText = pattern.usesUiSlugs.map((s) => code(s)).join(', ');
  const sections: string[] = [`# ${pattern.name}`, '', pattern.summary, '', `**slug:** \`${pattern.slug}\` · **depth:** \`${depth}\` · **uses:** ${usesText}`, '', '```ts', snippet, '```'];
  if (pattern.notes && depth === 'full') {
    sections.push('');
    sections.push('## Notes');
    sections.push('');
    sections.push(pattern.notes);
  }
  if (depth !== 'full') {
    sections.push('');
    sections.push(`→ Call \`dbx_ui_examples pattern="${pattern.slug}" depth="full"\` for imports and a complete component skeleton.`);
  }
  return sections.join('\n');
}

function formatNotFound(slug: string): string {
  const available = UI_PATTERNS.map((p) => code(p.slug)).join(', ');
  return [`No UI pattern matched \`${slug}\`.`, '', `Available patterns: ${available}.`, '', 'Call `dbx_ui_examples pattern="list"` for summaries.'].join('\n');
}

function code(value: string): string {
  return '`' + value + '`';
}

// MARK: Handler
/**
 * Tool handler for `dbx_ui_examples`. Resolves a UI example pattern from the
 * registry and renders it at the requested depth.
 *
 * @param rawArgs - the unvalidated tool arguments from the MCP runtime
 * @returns the formatted pattern text, or an error result when args fail validation
 */
export function runUiExamples(rawArgs: unknown): ToolResult {
  let args: ParsedUiExamplesArgs;
  try {
    args = parseUiExamplesArgs(rawArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toolError(message);
  }

  const lowered = args.pattern.trim().toLowerCase();
  let text: string;
  if (lowered === 'list' || lowered === 'catalog' || lowered === 'all') {
    text = formatPatternCatalog();
  } else {
    const pattern = getUiExamplePattern(args.pattern);
    text = pattern ? formatPattern(pattern, args.depth) : formatNotFound(args.pattern);
  }

  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const uiExamplesTool: DbxTool = {
  definition: DBX_UI_EXAMPLES_TOOL,
  run: runUiExamples
};
