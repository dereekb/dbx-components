/**
 * `dbx_ui_lookup` tool.
 *
 * UI-domain lookup. Accepts a topic (slug, selector, class name, category, or
 * the literal `'list'`) and a depth and returns markdown documentation for
 * `@dereekb/dbx-web` UI building blocks.
 *
 * Reads from a {@link UiComponentRegistry} supplied at construction time —
 * the server bootstrap composes the registry from the bundled
 * `@dereekb/dbx-web` manifest plus any external manifests declared in
 * `dbx-mcp.config.json`.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { type Maybe } from '@dereekb/util';
import { UI_COMPONENT_CATEGORIES, UI_COMPONENT_KINDS, type UiComponentCategoryValue, type UiComponentEntry } from '../manifest/ui-components-schema.js';
import type { UiComponentRegistry } from '../registry/ui-components-runtime.js';
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
    throw new TypeError(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedLookupUiArgs = {
    topic: parsed.topic,
    depth: parsed.depth ?? 'full'
  };
  return result;
}

// MARK: Resolution
type LookupUiMatch = { readonly kind: 'single'; readonly entry: UiComponentEntry } | { readonly kind: 'group'; readonly title: string; readonly entries: readonly UiComponentEntry[] } | { readonly kind: 'catalog' } | { readonly kind: 'not-found'; readonly normalized: string; readonly candidates: readonly UiComponentEntry[] };

function isCategory(value: string): value is UiComponentCategoryValue {
  return UI_COMPONENT_CATEGORIES.includes(value as UiComponentCategoryValue);
}

/**
 * Cheap substring-based candidate list used when a topic doesn't resolve.
 * Returns up to five entries whose slug / className / selector / description
 * contains the query.
 *
 * @param registry - the registry whose entries to search
 * @param query - the unmatched lookup topic to fuzzy-search
 * @returns up to five candidate entries ordered by descending score
 */
function fuzzyCandidates(registry: UiComponentRegistry, query: string): readonly UiComponentEntry[] {
  const q = query.trim().toLowerCase();
  let result: readonly UiComponentEntry[] = [];
  if (q.length > 0) {
    const scored: { readonly entry: UiComponentEntry; readonly score: number }[] = [];
    for (const entry of registry.all) {
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
    result = scored.slice(0, 5).map((s) => s.entry);
  }
  return result;
}

function resolveSingle(registry: UiComponentRegistry, rawTopic: string): Maybe<UiComponentEntry> {
  const trimmed = rawTopic.trim();
  const lowered = trimmed.toLowerCase();
  const slugHit = registry.findBySlug(trimmed);
  let entry: Maybe<UiComponentEntry>;
  if (slugHit.length > 0) {
    entry = slugHit[0];
  } else {
    const slugLowerHit = registry.findBySlug(lowered);
    entry = slugLowerHit.length > 0 ? slugLowerHit[0] : undefined;
  }
  entry ??= registry.findByClassName(trimmed);
  entry ??= registry.findBySelector(trimmed);
  return entry;
}

function resolveTopic(registry: UiComponentRegistry, rawTopic: string): LookupUiMatch {
  const lowered = rawTopic.trim().toLowerCase();
  let result: LookupUiMatch;

  if (lowered === 'list' || lowered === 'catalog' || lowered === 'all') {
    result = { kind: 'catalog' };
  } else if (isCategory(lowered)) {
    result = { kind: 'group', title: `UI components: category = ${lowered}`, entries: registry.findByCategory(lowered) };
  } else {
    const directHit = resolveSingle(registry, rawTopic);
    if (directHit) {
      result = { kind: 'single', entry: directHit };
    } else {
      result = { kind: 'not-found', normalized: lowered, candidates: fuzzyCandidates(registry, lowered) };
    }
  }
  return result;
}

// MARK: Formatting
type Depth = 'brief' | 'full';

function formatEntry(entry: UiComponentEntry, depth: Depth): string {
  return depth === 'brief' ? formatBrief(entry) : formatFull(entry);
}

function formatBrief(entry: UiComponentEntry): string {
  const minimal = entry.minimalExample ?? '';
  const lines: string[] = [`## ${entry.className}`, '', `**slug:** \`${entry.slug}\` · **kind:** \`${entry.kind}\` · **category:** \`${entry.category}\` · **selector:** \`${entry.selector}\``, '', entry.description];
  if (minimal.length > 0) {
    lines.push('', '```html', minimal, '```');
  }
  return lines.join('\n');
}

function formatFull(entry: UiComponentEntry): string {
  const sections: string[] = [formatHeader(entry), entry.description, formatInputsTable(entry), formatOutputsTable(entry), formatContentProjection(entry), formatExampleSection(entry), formatRelated(entry), formatSkillRefs(entry)];
  const filtered = sections.filter((s) => s.length > 0);
  return filtered.join('\n\n');
}

function formatHeader(entry: UiComponentEntry): string {
  const lines: string[] = [`# ${entry.className}`, '', `- **slug:** \`${entry.slug}\``, `- **kind:** \`${entry.kind}\``, `- **category:** \`${entry.category}\``, `- **selector:** \`${entry.selector}\``, `- **module:** \`${entry.module}\``];
  return lines.join('\n');
}

function formatInputsTable(entry: UiComponentEntry): string {
  let result: string;
  if (entry.inputs.length === 0) {
    result = '## Inputs\n\nNone.';
  } else {
    const rows = entry.inputs.map((input) => {
      const required = input.required ? '✓' : '';
      const defaultCell = input.default === undefined ? '' : `\`${input.default}\``;
      const desc = input.description.replaceAll('|', String.raw`\|`);
      const typeCell = input.type.replaceAll('|', String.raw`\|`);
      return `| \`${input.name}\` | \`${typeCell}\` | ${required} | ${defaultCell} | ${desc} |`;
    });
    result = ['## Inputs', '', '| Name | Type | Required | Default | Description |', '| --- | --- | --- | --- | --- |', ...rows].join('\n');
  }
  return result;
}

function formatOutputsTable(entry: UiComponentEntry): string {
  let result: string;
  if (entry.outputs.length === 0) {
    result = '';
  } else {
    const rows = entry.outputs.map((output) => {
      const desc = output.description.replaceAll('|', String.raw`\|`);
      const emits = output.emits.replaceAll('|', String.raw`\|`);
      return `| \`${output.name}\` | \`${emits}\` | ${desc} |`;
    });
    result = ['## Outputs', '', '| Name | Emits | Description |', '| --- | --- | --- |', ...rows].join('\n');
  }
  return result;
}

function formatContentProjection(entry: UiComponentEntry): string {
  let result = '';
  if (entry.contentProjection !== undefined && entry.contentProjection.length > 0) {
    result = `## Content projection\n\n\`\`\`html\n${entry.contentProjection}\n\`\`\``;
  }
  return result;
}

function formatExampleSection(entry: UiComponentEntry): string {
  const example = entry.example ?? '';
  const minimal = entry.minimalExample ?? '';
  let result = '';
  if (example.length > 0 || minimal.length > 0) {
    const lines: string[] = ['## Example'];
    if (example.length > 0) {
      lines.push('', '```html', example, '```');
    }
    if (minimal.length > 0) {
      lines.push('', '### Minimal', '', '```html', minimal, '```');
    }
    result = lines.join('\n');
  }
  return result;
}

function formatRelated(entry: UiComponentEntry): string {
  const related = entry.relatedSlugs ?? [];
  let result = '';
  if (related.length > 0) {
    const refs = related.map((s) => `\`${s}\``).join(', ');
    result = `## Related\n\n${refs}`;
  }
  return result;
}

function formatSkillRefs(entry: UiComponentEntry): string {
  const refs = entry.skillRefs ?? [];
  let result = '';
  if (refs.length > 0) {
    const formatted = refs.map((s) => `\`${s}\``).join(', ');
    result = `## See also\n\n${formatted}`;
  }
  return result;
}

function formatGroup(entries: readonly UiComponentEntry[], title: string): string {
  let result: string;
  if (entries.length === 0) {
    result = '_No UI components matched._';
  } else {
    const byKind = new Map<string, UiComponentEntry[]>();
    for (const entry of entries) {
      const list = byKind.get(entry.kind) ?? [];
      list.push(entry);
      byKind.set(entry.kind, list);
    }
    const sections: string[] = [`# ${title}`, ''];
    for (const kind of UI_COMPONENT_KINDS) {
      const list = byKind.get(kind);
      if (!list || list.length === 0) {
        continue;
      }
      sections.push(`## ${kind} (${list.length})`, '');
      for (const entry of list) {
        sections.push(`- **\`${entry.slug}\`** → \`${entry.className}\` (\`${entry.selector}\`) — ${entry.description}`);
      }
      sections.push('');
    }
    result = sections.join('\n').trimEnd();
  }
  return result;
}

function formatCatalog(registry: UiComponentRegistry): string {
  const lines: string[] = ['# UI catalog', '', `${registry.all.length} entries across ${UI_COMPONENT_CATEGORIES.length} categories.`, ''];
  for (const category of UI_COMPONENT_CATEGORIES) {
    const list = registry.findByCategory(category);
    if (list.length === 0) {
      continue;
    }
    lines.push(`## ${category} (${list.length})`, '');
    for (const entry of list) {
      lines.push(`- \`${entry.slug}\` → ${entry.className} · selector \`${entry.selector}\``);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

function formatNotFound(normalized: string, candidates: readonly UiComponentEntry[]): string {
  const lines: string[] = [`No UI component matched \`${normalized}\`.`, ''];
  if (candidates.length > 0) {
    lines.push('Did you mean one of these?', '');
    for (const entry of candidates) {
      lines.push(`- \`${entry.slug}\` → ${entry.className} (\`${entry.selector}\`) — ${entry.description}`);
    }
  } else {
    lines.push('Try `dbx_ui_lookup topic="list"` to browse the catalog.');
  }
  return lines.join('\n');
}

// MARK: Tool factory
/**
 * Input to {@link createLookupUiTool}.
 */
export interface CreateLookupUiToolInput {
  /**
   * UI components registry the tool reads from. The server bootstrap supplies
   * this after loading the bundled `@dereekb/dbx-web` ui-components manifest
   * plus any external manifests declared in `dbx-mcp.config.json`.
   */
  readonly registry: UiComponentRegistry;
}

/**
 * Creates the `dbx_ui_lookup` tool wired to the supplied registry. Tests pass
 * a fixture registry; the production server passes the merged registry from
 * {@link loadUiComponentRegistry}.
 *
 * @param input - the registry the tool reads from
 * @returns a {@link DbxTool} ready to register with the dispatcher
 */
export function createLookupUiTool(input: CreateLookupUiToolInput): DbxTool {
  const { registry } = input;
  const run = (rawArgs: unknown): ToolResult => {
    let args: ParsedLookupUiArgs;
    try {
      args = parseLookupUiArgs(rawArgs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return toolError(message);
    }

    const match = resolveTopic(registry, args.topic);
    let text: string;
    switch (match.kind) {
      case 'catalog':
        text = formatCatalog(registry);
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
  };
  return { definition: DBX_UI_LOOKUP_TOOL, run };
}
