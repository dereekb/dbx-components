/**
 * `dbx_ui_lookup` tool.
 *
 * UI-domain lookup. Accepts a topic (slug, selector, class name, category, or
 * the literal `'list'`) and a depth and returns markdown documentation for
 * `@dereekb/dbx-web` UI building blocks.
 *
 * Mirrors `lookup-forge.tool.ts` shape: low-level `setRequestHandler` registration
 * via the central dispatcher, plain JSON Schema input, arktype validation in
 * the handler. No zod.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { UI_CATEGORY_ORDER, UI_KIND_ORDER, UI_COMPONENTS, getUiComponent, getUiComponentsByCategory, type UiComponentCategory, type UiComponentInfo } from '../registry/index.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Tool advertisement
const DBX_UI_LOOKUP_TOOL: Tool = {
  name: 'dbx_ui_lookup',
  description: [
    'Look up @dereekb/dbx-web UI building blocks (layout, list, button, card, feedback, overlay, navigation, text, action).',
    '',
    'The `topic` accepts:',
    '  • a registry slug like "section", "two-column", "list", "button";',
    "  • an Angular selector like 'dbx-section', '[dbxAction]', or '[dbxContentContainer]';",
    "  • a class name like 'DbxSectionComponent';",
    "  • a category name (`'layout'`, `'list'`, `'button'`, `'card'`, `'feedback'`, `'overlay'`, `'navigation'`, `'text'`, `'screen'`, `'action'`, `'router'`) to list every entry in that bucket;",
    '  • the literal `"list"` for the full UI catalog grouped by category.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'Slug, selector, class name, category name, or "list".'
      },
      depth: {
        type: 'string',
        enum: ['brief', 'full'],
        description: "Detail level for single-entry hits. Defaults to 'full'.",
        default: 'full'
      }
    },
    required: ['topic']
  }
};

// MARK: Input validation
const LookupUiArgsType = type({
  topic: 'string',
  'depth?': "'brief' | 'full'"
});

interface ParsedLookupUiArgs {
  readonly topic: string;
  readonly depth: 'brief' | 'full';
}

function parseLookupUiArgs(raw: unknown): ParsedLookupUiArgs {
  const parsed = LookupUiArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedLookupUiArgs = {
    topic: parsed.topic,
    depth: parsed.depth ?? 'full'
  };
  return result;
}

// MARK: Resolution
type LookupUiMatch = { readonly kind: 'single'; readonly entry: UiComponentInfo } | { readonly kind: 'group'; readonly title: string; readonly entries: readonly UiComponentInfo[] } | { readonly kind: 'catalog' } | { readonly kind: 'not-found'; readonly normalized: string; readonly candidates: readonly UiComponentInfo[] };

function isCategory(value: string): value is UiComponentCategory {
  return UI_CATEGORY_ORDER.includes(value as UiComponentCategory);
}

/**
 * Resolves a topic string into the best UI match.
 *
 * Resolution order:
 *   1. `'list'` / `'catalog'` / `'all'` → catalog
 *   2. category name → category group
 *   3. exact slug / className / selector → single entry
 *   4. fuzzy substring search over slug / className / selector / description
 */
function resolveTopic(rawTopic: string): LookupUiMatch {
  const lowered = rawTopic.trim().toLowerCase();
  let result: LookupUiMatch;

  if (lowered === 'list' || lowered === 'catalog' || lowered === 'all') {
    result = { kind: 'catalog' };
  } else if (isCategory(lowered)) {
    const category = lowered;
    result = { kind: 'group', title: `UI components: category = ${category}`, entries: getUiComponentsByCategory(category) };
  } else {
    const directHit = getUiComponent(rawTopic) ?? getUiComponent(lowered);
    if (directHit) {
      result = { kind: 'single', entry: directHit };
    } else {
      result = { kind: 'not-found', normalized: lowered, candidates: fuzzyCandidates(lowered) };
    }
  }
  return result;
}

/**
 * Cheap substring-based candidate list used when a topic doesn't resolve.
 * Returns up to five entries whose slug / className / selector / description
 * contains the query.
 */
function fuzzyCandidates(query: string): readonly UiComponentInfo[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return [];
  }
  const scored: { readonly entry: UiComponentInfo; readonly score: number }[] = [];
  for (const entry of UI_COMPONENTS) {
    const slugHit = entry.slug.toLowerCase().includes(q) ? 4 : 0;
    const classHit = entry.className.toLowerCase().includes(q) ? 3 : 0;
    const selectorHit = entry.selector.toLowerCase().includes(q) ? 2 : 0;
    const descHit = entry.description.toLowerCase().includes(q) ? 1 : 0;
    const score = slugHit + classHit + selectorHit + descHit;
    if (score > 0) {
      scored.push({ entry, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const result = scored.slice(0, 5).map((s) => s.entry);
  return result;
}

// MARK: Formatting
type Depth = 'brief' | 'full';

function formatEntry(entry: UiComponentInfo, depth: Depth): string {
  const result = depth === 'brief' ? formatBrief(entry) : formatFull(entry);
  return result;
}

function formatBrief(entry: UiComponentInfo): string {
  const lines: string[] = [`## ${entry.className}`, '', `**slug:** \`${entry.slug}\` · **kind:** \`${entry.kind}\` · **category:** \`${entry.category}\` · **selector:** \`${entry.selector}\``, '', entry.description, '', '```html', entry.minimalExample, '```'];
  const result = lines.join('\n');
  return result;
}

function formatFull(entry: UiComponentInfo): string {
  const sections: string[] = [formatHeader(entry), entry.description, formatInputsTable(entry), formatOutputsTable(entry), formatContentProjection(entry), formatExampleSection(entry), formatRelated(entry), formatSkillRefs(entry)];
  const filtered = sections.filter((s) => s.length > 0);
  const result = filtered.join('\n\n');
  return result;
}

function formatHeader(entry: UiComponentInfo): string {
  const lines: string[] = [`# ${entry.className}`, '', `- **slug:** \`${entry.slug}\``, `- **kind:** \`${entry.kind}\``, `- **category:** \`${entry.category}\``, `- **selector:** \`${entry.selector}\``, `- **module:** \`${entry.module}\``, `- **source:** \`packages/dbx-web/src/${entry.sourcePath}\``];
  const result = lines.join('\n');
  return result;
}

function formatInputsTable(entry: UiComponentInfo): string {
  let result: string;
  if (entry.inputs.length === 0) {
    result = '## Inputs\n\nNone.';
  } else {
    const rows = entry.inputs.map((input) => {
      const required = input.required ? '✓' : '';
      const defaultCell = input.default !== undefined ? `\`${input.default}\`` : '';
      const desc = input.description.replace(/\|/g, '\\|');
      const typeCell = input.type.replace(/\|/g, '\\|');
      return `| \`${input.name}\` | \`${typeCell}\` | ${required} | ${defaultCell} | ${desc} |`;
    });
    result = ['## Inputs', '', '| Name | Type | Required | Default | Description |', '| --- | --- | --- | --- | --- |', ...rows].join('\n');
  }
  return result;
}

function formatOutputsTable(entry: UiComponentInfo): string {
  let result: string;
  if (entry.outputs.length === 0) {
    result = '';
  } else {
    const rows = entry.outputs.map((output) => {
      const desc = output.description.replace(/\|/g, '\\|');
      const emits = output.emits.replace(/\|/g, '\\|');
      return `| \`${output.name}\` | \`${emits}\` | ${desc} |`;
    });
    result = ['## Outputs', '', '| Name | Emits | Description |', '| --- | --- | --- |', ...rows].join('\n');
  }
  return result;
}

function formatContentProjection(entry: UiComponentInfo): string {
  let result = '';
  if (entry.contentProjection) {
    result = `## Content projection\n\n\`\`\`html\n${entry.contentProjection}\n\`\`\``;
  }
  return result;
}

function formatExampleSection(entry: UiComponentInfo): string {
  const result = ['## Example', '', '```html', entry.example, '```', '', '### Minimal', '', '```html', entry.minimalExample, '```'].join('\n');
  return result;
}

function formatRelated(entry: UiComponentInfo): string {
  let result = '';
  if (entry.relatedSlugs.length > 0) {
    const refs = entry.relatedSlugs.map((s) => `\`${s}\``).join(', ');
    result = `## Related\n\n${refs}`;
  }
  return result;
}

function formatSkillRefs(entry: UiComponentInfo): string {
  let result = '';
  if (entry.skillRefs.length > 0) {
    const refs = entry.skillRefs.map((s) => `\`${s}\``).join(', ');
    result = `## See also\n\n${refs}`;
  }
  return result;
}

function formatGroup(entries: readonly UiComponentInfo[], title: string): string {
  let result: string;
  if (entries.length === 0) {
    result = '_No UI components matched._';
  } else {
    const byKind = new Map<string, UiComponentInfo[]>();
    for (const entry of entries) {
      const list = byKind.get(entry.kind) ?? [];
      list.push(entry);
      byKind.set(entry.kind, list);
    }
    const sections: string[] = [`# ${title}`, ''];
    for (const kind of UI_KIND_ORDER) {
      const list = byKind.get(kind);
      if (!list || list.length === 0) {
        continue;
      }
      sections.push(`## ${kind} (${list.length})`);
      sections.push('');
      for (const entry of list) {
        sections.push(`- **\`${entry.slug}\`** → \`${entry.className}\` (\`${entry.selector}\`) — ${entry.description}`);
      }
      sections.push('');
    }
    result = sections.join('\n').trimEnd();
  }
  return result;
}

function formatCatalog(): string {
  const lines: string[] = ['# UI catalog', '', `${UI_COMPONENTS.length} entries across ${UI_CATEGORY_ORDER.length} categories.`, ''];
  for (const category of UI_CATEGORY_ORDER) {
    const list = getUiComponentsByCategory(category);
    if (list.length === 0) {
      continue;
    }
    lines.push(`## ${category} (${list.length})`);
    lines.push('');
    for (const entry of list) {
      lines.push(`- \`${entry.slug}\` → ${entry.className} · selector \`${entry.selector}\``);
    }
    lines.push('');
  }
  const result = lines.join('\n').trimEnd();
  return result;
}

function formatNotFound(normalized: string, candidates: readonly UiComponentInfo[]): string {
  const lines: string[] = [`No UI component matched \`${normalized}\`.`, ''];
  if (candidates.length > 0) {
    lines.push('Did you mean one of these?');
    lines.push('');
    for (const entry of candidates) {
      lines.push(`- \`${entry.slug}\` → ${entry.className} (\`${entry.selector}\`) — ${entry.description}`);
    }
  } else {
    lines.push('Try `dbx_ui_lookup topic="list"` to browse the catalog.');
  }
  const result = lines.join('\n');
  return result;
}

// MARK: Handler
export function runLookupUi(rawArgs: unknown): ToolResult {
  let args: ParsedLookupUiArgs;
  try {
    args = parseLookupUiArgs(rawArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toolError(message);
  }

  const match = resolveTopic(args.topic);
  let text: string;
  switch (match.kind) {
    case 'catalog':
      text = formatCatalog();
      break;
    case 'single':
      text = formatEntry(match.entry, args.depth);
      break;
    case 'group':
      text = formatGroup(match.entries, match.title);
      break;
    case 'not-found':
      text = formatNotFound(match.normalized, match.candidates);
      break;
  }

  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const lookupUiTool: DbxTool = {
  definition: DBX_UI_LOOKUP_TOOL,
  run: runLookupUi
};
