/**
 * `dbx_ui_examples` tool.
 *
 * Surfaces curated multi-component dbx-web compositions ("settings section",
 * "list page", "two-column master/detail", "card with action") and any
 * runnable example components scraped from a downstream app's docs module
 * via the `dbxDocsUiExamples` cluster (e.g. `apps/demo`'s
 * `<dbx-docs-ui-example>`-anchored examples). Complements `dbx_ui_lookup` —
 * lookup shows a SINGLE component's docs, examples show how to compose
 * several into a working layout, with full source for the host invocation
 * AND every supporting list/view/item template captured via
 * `@dbxDocsUiExampleUses`.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { UI_PATTERNS, getUiExamplePattern, type UiExampleDepth, type UiExamplePattern } from './data/patterns/ui-patterns.js';
import { type DbxDocsUiExamplesRegistry, EMPTY_DBX_DOCS_UI_EXAMPLES_REGISTRY } from '@dereekb/dbx-cli';
import { type DbxDocsUiExampleEntry, type DbxDocsUiExampleUseEntry } from '@dereekb/dbx-cli';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const DEPTH_VALUES = ['minimal', 'brief', 'full'] as const;

// MARK: Tool advertisement
const DBX_UI_EXAMPLES_TOOL: Tool = {
  name: 'dbx_ui_examples',
  description: [
    'Get curated multi-component @dereekb/dbx-web compositions plus any runnable example components scraped from a downstream app docs module (e.g. apps/demo).',
    '',
    'Curated patterns: "settings-section", "list-page", "two-column-detail", "card-with-action", "loading-with-empty", "sidenav-app-shell".',
    '',
    'App-sourced examples (when the dbxDocsUiExamples cluster is populated): one entry per `@dbxDocsUiExample`-tagged component, with the host template snippet plus every supporting list/view/item class from `@dbxDocsUiExampleUses` tags.',
    '',
    'Pass `pattern="list"` to see every available example. Pass any slug for a copy-paste-ready answer at the requested depth (`minimal`, `brief`, or `full`).',
    '',
    'This complements `dbx_ui_lookup`, which covers single-component docs.'
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
        description: "Code detail level. 'minimal' is the shortest; 'full' includes imports, supporting class sources, and the full component skeleton.",
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
    throw new TypeError(`Invalid arguments: ${parsed.summary}`);
  }
  return {
    pattern: parsed.pattern,
    depth: parsed.depth ?? 'full'
  };
}

// MARK: Formatting — curated patterns
function formatPattern(pattern: UiExamplePattern, depth: UiExampleDepth): string {
  const snippet = pattern.snippets[depth];
  const usesText = pattern.usesUiSlugs.map(code).join(', ');
  const sections: string[] = [`# ${pattern.name}`, '', pattern.summary, '', `**slug:** \`${pattern.slug}\` · **origin:** \`curated\` · **depth:** \`${depth}\` · **uses:** ${usesText}`, '', '```ts', snippet, '```'];
  if (pattern.notes && depth === 'full') {
    sections.push('', '## Notes', '', pattern.notes);
  }
  if (depth !== 'full') {
    sections.push('', `→ Call \`dbx_ui_examples pattern="${pattern.slug}" depth="full"\` for imports and a complete component skeleton.`);
  }
  return sections.join('\n');
}

// MARK: Formatting — scanned entries
function formatScannedExample(entry: DbxDocsUiExampleEntry, depth: UiExampleDepth): string {
  const lines: string[] = [];
  appendScannedExampleHeader(lines, entry, depth);
  appendScannedExampleDescription(lines, entry, depth);
  appendScannedExampleSnippet(lines, entry, depth);
  appendScannedExampleUses(lines, entry, depth);
  appendScannedExampleNotes(lines, entry, depth);
  appendScannedExampleFooter(lines, entry, depth);
  return lines.join('\n').trimEnd();
}

function appendScannedExampleHeader(lines: string[], entry: DbxDocsUiExampleEntry, depth: UiExampleDepth): void {
  const relatedText = (entry.relatedSlugs ?? []).map(code).join(', ');
  const relatedSuffix = relatedText.length > 0 ? ` · **related:** ${relatedText}` : '';
  lines.push(`# ${entry.header}`, '', entry.summary, '', `**slug:** \`${entry.slug}\` · **origin:** \`${entry.appRef}\` · **category:** \`${entry.category}\` · **depth:** \`${depth}\`${relatedSuffix}`, '');
}

function appendScannedExampleDescription(lines: string[], entry: DbxDocsUiExampleEntry, depth: UiExampleDepth): void {
  if (depth === 'full') {
    if (entry.info.length > 0) {
      lines.push('## Description', '', entry.info, '');
    }
  } else if (entry.hint !== undefined) {
    lines.push(entry.hint, '');
  }
}

function appendScannedExampleSnippet(lines: string[], entry: DbxDocsUiExampleEntry, depth: UiExampleDepth): void {
  lines.push('## Host snippet', '', '```html', entry.snippet, '```', '');
  if (entry.imports !== undefined && depth !== 'minimal') {
    lines.push('## Imports', '', '```ts', entry.imports, '```', '');
  }
}

function appendScannedExampleUses(lines: string[], entry: DbxDocsUiExampleEntry, depth: UiExampleDepth): void {
  if (entry.uses.length === 0) return;
  if (depth === 'brief') {
    lines.push('## Uses', '');
    for (const use of entry.uses) {
      lines.push(`- ${formatUseSummaryLine(use)}`);
    }
    lines.push('');
  } else if (depth === 'full') {
    lines.push('## Uses', '');
    for (const use of entry.uses) {
      lines.push(`### ${formatUseHeading(use)}`, '');
      if (use.classSource.length > 0) {
        lines.push('```ts', use.classSource, '```', '');
      }
    }
  }
}

function appendScannedExampleNotes(lines: string[], entry: DbxDocsUiExampleEntry, depth: UiExampleDepth): void {
  if (depth === 'full' && entry.notes !== undefined && entry.notes.length > 0) {
    lines.push('## Notes', '', entry.notes);
  }
}

function appendScannedExampleFooter(lines: string[], entry: DbxDocsUiExampleEntry, depth: UiExampleDepth): void {
  if (depth !== 'full') {
    lines.push('', `→ Call \`dbx_ui_examples pattern="${entry.slug}" depth="full"\` for the complete component, every supporting class, and notes.`);
  }
}

function formatUseHeading(use: DbxDocsUiExampleUseEntry): string {
  const role = use.role === undefined ? '' : `${use.role} — `;
  let selector = '';
  if (use.selector !== undefined) {
    selector = ` \`${use.selector}\``;
  } else if (use.pipeName !== undefined) {
    selector = ` (\`| ${use.pipeName}\`)`;
  }
  return `${role}${use.className} (\`${use.kind}\`)${selector}`;
}

function formatUseSummaryLine(use: DbxDocsUiExampleUseEntry): string {
  const role = use.role === undefined ? '' : `**${use.role}** `;
  let selector = '';
  if (use.selector !== undefined) {
    selector = ` — selector \`${use.selector}\``;
  } else if (use.pipeName !== undefined) {
    selector = ` — pipe \`${use.pipeName}\``;
  }
  return `${role}\`${use.className}\` (${use.kind})${selector}`;
}

// MARK: Catalog formatting
function formatCatalog(scannedEntries: readonly DbxDocsUiExampleEntry[]): string {
  const lines: string[] = [];
  const appSourcedSuffix = scannedEntries.length > 0 ? `, ${scannedEntries.length} app-sourced` : '';
  lines.push(`# UI example patterns (${UI_PATTERNS.length} curated${appSourcedSuffix})`, '', 'Call `dbx_ui_examples pattern="<slug>"` for a full example.', '', '## Curated', '');
  for (const pattern of UI_PATTERNS) {
    const usesText = pattern.usesUiSlugs.map(code).join(', ');
    lines.push(`### ${pattern.name}`, '', `- **slug:** \`${pattern.slug}\``, `- **origin:** \`curated\``, `- **summary:** ${pattern.summary}`, `- **uses:** ${usesText}`, '');
  }

  if (scannedEntries.length > 0) {
    lines.push('## App-sourced', '');
    for (const entry of scannedEntries) {
      const relatedText = (entry.relatedSlugs ?? []).map(code).join(', ');
      lines.push(`### ${entry.header}`, '', `- **slug:** \`${entry.slug}\``, `- **origin:** \`${entry.appRef}\``, `- **category:** \`${entry.category}\``, `- **summary:** ${entry.summary}`);
      if (relatedText.length > 0) {
        lines.push(`- **related:** ${relatedText}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n').trimEnd();
}

function formatNotFound(slug: string, scannedEntries: readonly DbxDocsUiExampleEntry[]): string {
  const curated = UI_PATTERNS.map((p) => code(p.slug)).join(', ');
  const scanned = scannedEntries.map((e) => code(e.slug)).join(', ');
  const lines: string[] = [`No UI pattern matched \`${slug}\`.`, '', `Curated: ${curated}.`];
  if (scanned.length > 0) {
    lines.push(`App-sourced: ${scanned}.`);
  }
  lines.push('', 'Call `dbx_ui_examples pattern="list"` for summaries.');
  return lines.join('\n');
}

function code(value: string): string {
  return '`' + value + '`';
}

// MARK: Tool factory
/**
 * Input to {@link createUiExamplesTool}.
 */
export interface CreateUiExamplesToolInput {
  /**
   * App-sourced examples registry. When omitted (or empty), the tool
   * surfaces only the curated `UI_PATTERNS`.
   */
  readonly examplesRegistry?: DbxDocsUiExamplesRegistry;
}

/**
 * Creates the `dbx_ui_examples` tool wired to the supplied app-sourced
 * examples registry. Tests can omit `examplesRegistry` to exercise the
 * curated-only path; the production server passes the merged registry from
 * {@link loadDbxDocsUiExamplesRegistry}.
 *
 * @param input - Optional app-sourced examples registry.
 * @returns A {@link DbxTool} that responds to `dbx_ui_examples` invocations.
 * @__NO_SIDE_EFFECTS__
 */
export function createUiExamplesTool(input: CreateUiExamplesToolInput = {}): DbxTool {
  const examplesRegistry = input.examplesRegistry ?? EMPTY_DBX_DOCS_UI_EXAMPLES_REGISTRY;
  const run = (rawArgs: unknown): ToolResult => {
    let args: ParsedUiExamplesArgs | undefined;
    let parseError: string | undefined;
    try {
      args = parseUiExamplesArgs(rawArgs);
    } catch (error) {
      parseError = error instanceof Error ? error.message : String(error);
    }

    let result: ToolResult;
    if (parseError !== undefined || args === undefined) {
      result = toolError(parseError ?? 'Failed to parse arguments.');
    } else {
      const lowered = args.pattern.trim().toLowerCase();
      const scannedEntries = examplesRegistry.all;
      let text: string;
      if (lowered === 'list' || lowered === 'catalog' || lowered === 'all') {
        text = formatCatalog(scannedEntries);
      } else {
        const curated = getUiExamplePattern(args.pattern);
        if (curated === undefined) {
          const scanned = examplesRegistry.findBySlug(args.pattern.trim());
          text = scanned === undefined ? formatNotFound(args.pattern, scannedEntries) : formatScannedExample(scanned, args.depth);
        } else {
          text = formatPattern(curated, args.depth);
        }
      }
      result = { content: [{ type: 'text', text }] };
    }
    return result;
  };
  return { definition: DBX_UI_EXAMPLES_TOOL, run };
}

/**
 * Default tool instance with no app-sourced examples registry. Kept for
 * backwards compat with the static `DBX_TOOLS` registration array; the
 * server bootstrap replaces this with a registry-bound instance via
 * {@link createUiExamplesTool}.
 */
export const uiExamplesTool: DbxTool = createUiExamplesTool();

/**
 * Re-exported handler kept for tests that exercise the curated-only path.
 *
 * @param rawArgs - The raw MCP tool arguments object.
 * @returns The tool result containing the rendered example text.
 */
export function runUiExamples(rawArgs: unknown): ToolResult {
  return uiExamplesTool.run(rawArgs);
}
