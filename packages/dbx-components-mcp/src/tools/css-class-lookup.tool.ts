/**
 * `dbx_css_class_lookup` tool.
 *
 * Combined-mode lookup over the dbx-web (and downstream-app) CSS-utility-
 * class catalog. Mirrors `dbx_css_token_lookup` for tokens — a single tool
 * call accepts:
 *
 * - `name`         exact selector / slug match (`.dbx-flex-fill-0` or
 *                  `dbx-flex-fill-0`)
 * - `declarations` raw CSS declarations to reverse-search ("am I
 *                  reinventing an existing utility?")
 * - `intent`       plain-English intent ("vertical stack with gap")
 * - `role`         filter (`layout` / `flex` / `text` / `spacing` /
 *                  `state` / `interaction` / `misc`)
 * - `category`     `"list"` for the full catalog, or one source slug to
 *                  browse just that source's utilities
 *
 * Reads from a {@link CssUtilityRegistry} supplied at construction time —
 * the server bootstrap composes it from the bundled
 * `dereekb-dbx-web.css-utilities.mcp.generated.json` plus any external
 * manifests declared in `dbx-mcp.config.json`.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { CSS_UTILITY_ROLES, type CssUtilityEntry } from '../manifest/css-utilities-schema.js';
import type { CssUtilityRegistry, ScoredCssUtilityMatch } from '../registry/css-utilities-runtime.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Tool advertisement
const DBX_CSS_CLASS_LOOKUP_TOOL: Tool = {
  name: 'dbx_css_class_lookup',
  description: [
    'Forward + reverse lookup over the dbx-web (and downstream-app) CSS-utility-class catalog.',
    '',
    'Pass any combination of:',
    '  • `name` — exact selector or slug (`.dbx-flex-fill-0`, `dbx-flex-fill-0`);',
    '  • `declarations` — raw CSS to reverse-search ("display: flex; align-items: center; gap: 8px");',
    '  • `intent` — plain-English intent ("horizontal flex bar", "vertical stack with gap");',
    '  • `role` — `layout` / `flex` / `text` / `spacing` / `state` / `interaction` / `misc`;',
    '  • `category` — `"list"` for the full catalog, or a source slug (`@dereekb/dbx-web`, `<app>`);',
    '  • `parent` — list / scope-search to children of a parent slug (e.g. `dbx-list-two-line-item`);',
    '  • `includeChildren` — set `true` to surface child utilities in browse / declarations / intent results (children are hidden by default).',
    '',
    'Child utilities are utilities annotated with `/// @parent <parent-slug>`. They are hidden from list / search / intent results by default to keep output focused on top-level primitives. Use `parent="<slug>"` to pull just one parent\'s children, or `includeChildren=true` to include children alongside top-level entries. `name` lookups always resolve children directly.',
    '',
    'Compound utilities (rules defined as descendant chains, e.g. `.dbx-list-no-item-padding .dbx-list > .dbx-list-content … { padding: 0 }`) are cataloged keyed on their FIRST flat class — that is the host class consumers add to their HTML. The full descendant chain is preserved as `selectorContext` and rendered as "Use inside" so the usage context (e.g. "must be applied within a `.dbx-list`") is not lost.',
    '',
    'Component-owned classes (e.g. `.dbx-icon-tile` ↔ `DbxIconTileComponent`, `.dbx-step-block-badge` ↔ `DbxStepBlockComponent`) are surfaced with `component` + `scope: "component-class"`. The catalog includes them so their CSS-variable surface is discoverable; the rendered output names the owning component and warns against applying the class to arbitrary markup.',
    '',
    'Token capture: every `var(--name, …)` reference in a rule\'s declarations is surfaced as `tokensRead` ("override these to customize"); every `--name: value` declaration the rule emits is surfaced as `tokensSet` ("this rule overrides these on descendants"). Useful for understanding how to customize a component via its CSS variables without re-reading the SCSS.',
    '',
    'Returns the canonical host selector, file:line provenance, parsed declarations, intent, role, scope, owning component (when present), tokens read/set, see-also, parent slug, optional descendant-chain context, and any anti-use note. Reverse-search results include matched/extra/missing property breakdown. Rendered parent entries also list their registered children.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Exact selector or slug to look up.' },
      declarations: { type: 'string', description: 'Raw CSS declarations to reverse-search.' },
      intent: { type: 'string', description: 'Plain-English intent.' },
      role: { type: 'string', enum: [...CSS_UTILITY_ROLES], description: 'Utility-role filter.' },
      category: { type: 'string', description: '"list" for the full catalog, or a source slug.' },
      parent: { type: 'string', description: 'List or scope-search to children of this parent slug.' },
      includeChildren: { type: 'boolean', description: 'Include child utilities in results (default false).' }
    }
  }
};

// MARK: Input validation
const CssClassLookupArgs = type({
  'name?': 'string',
  'declarations?': 'string',
  'intent?': 'string',
  'role?': 'string',
  'category?': 'string',
  'parent?': 'string',
  'includeChildren?': 'boolean'
});

interface ParsedArgs {
  readonly name?: string;
  readonly declarations?: string;
  readonly intent?: string;
  readonly role?: string;
  readonly category?: string;
  readonly parent?: string;
  readonly includeChildren?: boolean;
}

function parseArgs(raw: unknown): ParsedArgs {
  const parsed = CssClassLookupArgs(raw);
  if (parsed instanceof type.errors) {
    throw new TypeError(`Invalid arguments: ${parsed.summary}`);
  }
  return {
    name: parsed.name,
    declarations: parsed.declarations,
    intent: parsed.intent,
    role: parsed.role,
    category: parsed.category,
    parent: parsed.parent,
    includeChildren: parsed.includeChildren
  };
}

// MARK: Tool factory
/**
 * Input to {@link createCssClassLookupTool}.
 */
export interface CreateCssClassLookupToolInput {
  /**
   * Css-utility registry the tool reads from.
   */
  readonly registry: CssUtilityRegistry;
}

/**
 * Creates the `dbx_css_class_lookup` tool wired to the supplied registry.
 *
 * @param input - the registry the tool reads from
 * @returns a {@link DbxTool} ready to register with the dispatcher
 */
export function createCssClassLookupTool(input: CreateCssClassLookupToolInput): DbxTool {
  const { registry } = input;
  const run = (rawArgs: unknown): ToolResult => {
    let args: ParsedArgs;
    try {
      args = parseArgs(rawArgs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return toolError(message);
    }
    const text = renderResponse(registry, args);
    const tool: ToolResult = { content: [{ type: 'text', text }] };
    return tool;
  };
  return { definition: DBX_CSS_CLASS_LOOKUP_TOOL, run };
}

// MARK: Rendering
function renderResponse(registry: CssUtilityRegistry, args: ParsedArgs): string {
  let text: string;
  if (args.name !== undefined) {
    text = renderByName(registry, args);
  } else if (args.declarations !== undefined) {
    text = renderByDeclarations(registry, args);
  } else if (args.intent !== undefined) {
    text = renderByIntent(registry, args);
  } else if (args.parent !== undefined) {
    text = renderByParent(registry, args);
  } else if (args.category !== undefined || args.role !== undefined) {
    text = renderBrowse(registry, args);
  } else {
    text = renderNoQuery();
  }
  return text;
}

function renderByName(registry: CssUtilityRegistry, args: ParsedArgs): string {
  const name = args.name ?? '';
  const entry = registry.findByName(name);
  let text: string;
  if (entry === undefined) {
    text = `# No match for \`${name}\`\n\nNo utility class registered under that selector or slug.`;
  } else {
    text = renderEntry({ entry, registry });
  }
  return text;
}

function renderByDeclarations(registry: CssUtilityRegistry, args: ParsedArgs): string {
  const matches = registry.searchByDeclarations(args.declarations ?? '', {
    role: args.role,
    parent: args.parent,
    includeChildren: args.includeChildren
  });
  let text: string;
  if (matches.length === 0) {
    text = `# No utility-class matches for declarations\n\n\`\`\`css\n${args.declarations ?? ''}\n\`\`\`\n\nThe equivalency engine did not find a confident match. Consider whether the rule should compose existing utilities (\`.dbx-flex-bar\`, \`.dbx-flex-fill\`, …) or if it is genuinely feature-specific.`;
  } else {
    const top = matches[0];
    const others = matches.slice(1);
    text = renderEntry({ entry: top.entry, scored: top, otherMatches: others, registry });
  }
  return text;
}

function renderByIntent(registry: CssUtilityRegistry, args: ParsedArgs): string {
  const matches = registry.findByIntent(args.intent ?? '', {
    role: args.role,
    parent: args.parent,
    includeChildren: args.includeChildren
  });
  let text: string;
  if (matches.length === 0) {
    text = `# No utility-class matches for intent "${args.intent ?? ''}"\n\nTry \`declarations\` with a CSS sketch instead, or \`category="list"\` to browse the catalog.`;
  } else if (matches.length === 1) {
    text = renderEntry({ entry: matches[0].entry, registry });
  } else {
    text = renderAmbiguous(matches);
  }
  return text;
}

function renderByParent(registry: CssUtilityRegistry, args: ParsedArgs): string {
  const parent = args.parent ?? '';
  const children = registry.findChildrenOf(parent);
  const parentEntry = registry.findByName(parent);
  let text: string;
  if (children.length === 0) {
    const lines: string[] = [`# No children registered under \`${parent}\``, ''];
    if (parentEntry !== undefined) {
      lines.push(`The parent utility \`${parentEntry.selector}\` exists but has no annotated children. Mark related helpers with \`/// @parent ${parent}\` to group them.`);
    } else {
      lines.push(`No utility class is registered under that slug, and no children reference it. Check the slug spelling, or list the catalog with \`category="list"\`.`);
    }
    text = lines.join('\n');
  } else {
    const lines: string[] = [`# Children of \`${parent}\` (${children.length})`, ''];
    if (parentEntry !== undefined) {
      const intent = parentEntry.intent === undefined ? '' : ` — ${parentEntry.intent}`;
      lines.push(`Parent: \`${parentEntry.selector}\`${intent}`);
      lines.push('');
    }
    for (const child of children) {
      const role = child.role ?? 'misc';
      const intent = child.intent === undefined ? '' : ` — ${child.intent}`;
      lines.push(`- \`${child.selector}\` (${role})${intent}`);
    }
    text = lines.join('\n');
  }
  return text;
}

function renderBrowse(registry: CssUtilityRegistry, args: ParsedArgs): string {
  let candidates: readonly CssUtilityEntry[];
  if (args.category !== undefined && args.category !== 'list') {
    candidates = registry.bySource.get(args.category) ?? [];
  } else if (args.role !== undefined) {
    candidates = registry.byRole.get(args.role) ?? [];
  } else {
    candidates = registry.all;
  }

  const includeChildren = args.includeChildren === true;
  const visible = includeChildren ? candidates : candidates.filter((entry) => entry.parent === undefined);

  let text: string;
  if (visible.length === 0) {
    if (candidates.length > 0 && !includeChildren) {
      text = `# No top-level utilities found\n\nThe filtered set has ${candidates.length} entr${candidates.length === 1 ? 'y' : 'ies'}, but every entry is a child utility. Pass \`includeChildren=true\` to surface them, or use \`parent="<slug>"\` to scope to a specific parent.`;
    } else {
      text = `# No utilities found\n\nThe registry has ${registry.all.length} entr${registry.all.length === 1 ? 'y' : 'ies'} across ${registry.loadedSources.length} source(s): ${registry.loadedSources.join(', ') || '(none)'}.`;
    }
  } else {
    const heading = includeChildren ? `# CSS utilities (${visible.length})` : `# CSS utilities (${visible.length} top-level)`;
    const lines: string[] = [heading, ''];
    for (const entry of visible) {
      const role = entry.role ?? 'misc';
      const intent = entry.intent === undefined ? '' : ` — ${entry.intent}`;
      const parentTag = entry.parent === undefined ? '' : ` ↳ parent: \`${entry.parent}\``;
      lines.push(`- \`${entry.selector}\` (${role})${intent}${parentTag}`);
    }
    text = lines.join('\n');
  }
  return text;
}

function renderNoQuery(): string {
  return [
    '# `dbx_css_class_lookup`',
    '',
    'Pass at least one of: `name`, `declarations`, `intent`, `role`, `category="list"`, or `parent="<slug>"`.',
    '',
    'Examples:',
    '- `name=".dbx-flex-fill-0"` — exact lookup.',
    '- `declarations="display:flex; align-items:center; gap:8px"` — equivalency search.',
    '- `intent="horizontal flex bar"` — intent match.',
    '- `category="list"` — browse the entire catalog (top-level only by default).',
    '- `parent="dbx-list-two-line-item"` — list a parent\'s helper utilities.',
    '- `includeChildren=true` — include child utilities alongside top-level entries.'
  ].join('\n');
}

interface RenderEntryInput {
  readonly entry: CssUtilityEntry;
  readonly scored?: ScoredCssUtilityMatch;
  readonly otherMatches?: readonly ScoredCssUtilityMatch[];
  readonly registry?: CssUtilityRegistry;
}

function renderEntry(input: RenderEntryInput): string {
  const { entry, scored, otherMatches = [], registry } = input;
  const lines: string[] = [`# \`${entry.selector}\``];
  const headerBits: string[] = [];
  if (entry.role !== undefined) headerBits.push(`role: ${entry.role}`);
  if (entry.scope !== undefined) headerBits.push(`scope: ${entry.scope}`);
  headerBits.push(`source: ${entry.source}`);
  headerBits.push(`${entry.file}:${entry.line}`);
  lines.push(`*${headerBits.join(' · ')}*`);
  lines.push('');
  if (entry.intent !== undefined) {
    lines.push(`**Intent:** ${entry.intent}`);
  }
  if (entry.component !== undefined) {
    lines.push(`**Component:** \`${entry.component}\``);
  }
  if (entry.scope === 'component-class') {
    lines.push("**Heads up:** this is a component-owned class. It's cataloged so its CSS variables are discoverable, but apply it via the owning component rather than adding the class to arbitrary markup.");
  }
  if (entry.parent !== undefined) {
    lines.push(`**Parent:** \`${entry.parent}\``);
  }
  if (entry.selectorContext !== undefined) {
    lines.push(`**Use inside:** \`${entry.selectorContext}\``);
  }

  lines.push('', '## Declarations', '');
  lines.push('```css');
  // Render the full compound chain when present so consumers can see the
  // exact rule head; flat utilities just show the host selector.
  const ruleHead = entry.selectorContext ?? entry.selector;
  lines.push(`${ruleHead} {`);
  for (const decl of entry.declarations) {
    lines.push(`  ${decl.property}: ${decl.value};`);
  }
  lines.push('}');
  lines.push('```');

  if (entry.tokensRead !== undefined && entry.tokensRead.length > 0) {
    lines.push('', '## Tokens read', '', 'Override these CSS variables to customize the rule:', '');
    for (const token of entry.tokensRead) {
      lines.push(`- \`${token}\``);
    }
  }

  if (entry.tokensSet !== undefined && entry.tokensSet.length > 0) {
    lines.push('', '## Tokens set', '', 'These CSS variables are declared by this rule and cascade to descendants:', '');
    for (const token of entry.tokensSet) {
      lines.push(`- \`${token}\``);
    }
  }

  if (scored !== undefined) {
    lines.push('', '## Match diff', '');
    const score = (scored.score * 100).toFixed(0);
    lines.push(`Match score: ${score}%`);
    if (scored.matchedProperties.length > 0) {
      lines.push(`- matched: ${formatPropList(scored.matchedProperties)}`);
    }
    if (scored.extraEntryProperties.length > 0) {
      lines.push(`- extra on entry: ${formatPropList(scored.extraEntryProperties)}`);
    }
    if (scored.missingInputProperties.length > 0) {
      lines.push(`- missing from input: ${formatPropList(scored.missingInputProperties)}`);
    }
  }

  if (entry.antiUse !== undefined) {
    lines.push('', "## Don't use when", '', entry.antiUse);
  }

  if (entry.seeAlso !== undefined && entry.seeAlso.length > 0) {
    const list = entry.seeAlso.map((s) => `\`${s}\``).join(', ');
    lines.push('', '## See also', '', list);
  }

  if (registry !== undefined) {
    const children = registry.findChildrenOf(entry.slug);
    if (children.length > 0) {
      lines.push('', `## Children (${children.length})`, '');
      for (const child of children) {
        const role = child.role ?? 'misc';
        const intent = child.intent === undefined ? '' : ` — ${child.intent}`;
        lines.push(`- \`${child.selector}\` (${role})${intent}`);
      }
    }
  }

  if (entry.since !== undefined) {
    lines.push('', `*Since: ${entry.since}*`);
  }

  if (otherMatches.length > 0) {
    lines.push('', '## Other candidates', '');
    for (const other of otherMatches) {
      const score = (other.score * 100).toFixed(0);
      lines.push(`- \`${other.entry.selector}\` (${score}%)`);
    }
  }

  return lines.join('\n');
}

function formatPropList(props: readonly string[]): string {
  const parts: string[] = [];
  for (const p of props) {
    parts.push(`\`${p}\``);
  }
  return parts.join(', ');
}

function renderAmbiguous(matches: readonly ScoredCssUtilityMatch[]): string {
  const lines: string[] = ['# Multiple utility classes match', ''];
  for (const match of matches.slice(0, 5)) {
    const role = match.entry.role ?? 'misc';
    const intent = match.entry.intent === undefined ? '' : ` — ${match.entry.intent}`;
    lines.push(`- \`${match.entry.selector}\` (${role})${intent}`);
  }
  return lines.join('\n');
}
