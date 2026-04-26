/**
 * `dbx_action_lookup` tool.
 *
 * Action-domain lookup. Accepts a topic (slug, role, directive selector,
 * class name, `DbxActionState` enum member, or the literal `'list'`) and a
 * depth; returns markdown documentation for the matched action entry.
 *
 * Mirrors {@link runLookupForm} in shape — low-level `setRequestHandler`,
 * arktype validation, plain JSON Schema. The resolution order is:
 *
 *   1. `'list'` / `'catalog'` / `'all'` → catalog
 *   2. role name (`'directive'` / `'store'` / `'state'`) → role group
 *   3. exact slug match → single entry
 *   4. directive selector match (with or without brackets) → directive
 *   5. class name match → directive or store
 *   6. `DbxActionState` enum member name → state entry
 *   7. fuzzy substring search across slug / className / selector / description
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ACTION_ENTRIES, ACTION_ROLE_ORDER, getActionDirectiveBySelector, getActionEntriesByRole, getActionEntry, getActionEntryByClassName, getActionStateEntry, type ActionDirectiveInfo, type ActionEntryInfo, type ActionEntryRole, type ActionStateInfo, type ActionStoreInfo } from '../registry/index.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Tool registry
const DBX_ACTION_LOOKUP_TOOL: Tool = {
  name: 'dbx_action_lookup',
  description: [
    'Look up the @dereekb/dbx-core action surface — directives, the underlying `ActionContextStore`, and the `DbxActionState` enum.',
    '',
    'The `topic` accepts:',
    '  • a registry slug like "handler", "auto-trigger", "action-context-store", "state-working";',
    '  • a directive selector with or without brackets ("[dbxActionHandler]", "dbxActionAutoTrigger");',
    '  • a class name ("DbxActionHandlerDirective", "ActionContextStore");',
    "  • a role (`'directive'`, `'store'`, `'state'`) to list every entry in that role;",
    '  • a `DbxActionState` enum member ("IDLE", "TRIGGERED", "WORKING", ...);',
    '  • the literal `"list"` for the full action catalog.',
    '',
    "When the topic is `'state'`, the response is the full state-machine listing with transition arrows."
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'Slug, role, selector, class name, DbxActionState member, or "list".'
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
const LookupActionArgsType = type({
  topic: 'string',
  'depth?': "'brief' | 'full'"
});

interface ParsedLookupActionArgs {
  readonly topic: string;
  readonly depth: 'brief' | 'full';
}

function parseLookupActionArgs(raw: unknown): ParsedLookupActionArgs {
  const parsed = LookupActionArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedLookupActionArgs = {
    topic: parsed.topic,
    depth: parsed.depth ?? 'full'
  };
  return result;
}

// MARK: Resolution
type LookupActionMatch = { readonly kind: 'single'; readonly entry: ActionEntryInfo } | { readonly kind: 'group'; readonly title: string; readonly entries: readonly ActionEntryInfo[] } | { readonly kind: 'catalog' } | { readonly kind: 'not-found'; readonly normalized: string; readonly candidates: readonly ActionEntryInfo[] };

const ROLE_TITLES: Record<ActionEntryRole, string> = {
  directive: 'Action directives',
  store: 'Action stores',
  state: 'DbxActionState members'
};

function resolveTopic(rawTopic: string): LookupActionMatch {
  const trimmed = rawTopic.trim();
  const lowered = trimmed.toLowerCase();
  let result: LookupActionMatch;

  if (lowered === 'list' || lowered === 'catalog' || lowered === 'all') {
    result = { kind: 'catalog' };
  } else if (ACTION_ROLE_ORDER.includes(lowered as ActionEntryRole)) {
    const role = lowered as ActionEntryRole;
    result = { kind: 'group', title: ROLE_TITLES[role], entries: getActionEntriesByRole(role) };
  } else {
    const slugHit = getActionEntry(trimmed);
    if (slugHit) {
      result = { kind: 'single', entry: slugHit };
    } else {
      const selectorHit = getActionDirectiveBySelector(trimmed);
      if (selectorHit) {
        result = { kind: 'single', entry: selectorHit };
      } else {
        const classHit = getActionEntryByClassName(trimmed);
        if (classHit) {
          result = { kind: 'single', entry: classHit };
        } else {
          const stateHit = getActionStateEntry(trimmed);
          if (stateHit) {
            result = { kind: 'single', entry: stateHit };
          } else {
            result = { kind: 'not-found', normalized: lowered, candidates: fuzzyCandidates(lowered) };
          }
        }
      }
    }
  }
  return result;
}

function scoreActionEntryRole(entry: ActionEntryInfo, q: string): number {
  let score = 0;
  if (entry.role === 'directive') {
    if (entry.selector.toLowerCase().includes(q)) score += 2;
    if (entry.className.toLowerCase().includes(q)) score += 2;
  } else if (entry.role === 'store') {
    if (entry.className.toLowerCase().includes(q)) score += 2;
  } else if (entry.role === 'state' && (entry.stateValue.toLowerCase().includes(q) || entry.literal.toLowerCase().includes(q))) {
    score += 2;
  }
  return score;
}

function scoreActionEntry(entry: ActionEntryInfo, q: string): number {
  let score = scoreActionEntryRole(entry, q);
  if (entry.slug.toLowerCase().includes(q)) score += 3;
  if (entry.description.toLowerCase().includes(q)) score += 1;
  return score;
}

function fuzzyCandidates(query: string): readonly ActionEntryInfo[] {
  const q = query.trim().toLowerCase();
  let result: readonly ActionEntryInfo[] = [];
  if (q.length > 0) {
    const scored = ACTION_ENTRIES.map((entry) => ({ entry, score: scoreActionEntry(entry, q) })).filter((s) => s.score > 0);
    scored.sort((a, b) => b.score - a.score);
    result = scored.slice(0, 5).map((s) => s.entry);
  }
  return result;
}

// MARK: Formatting helpers
function bullet(label: string, value: string): string {
  return `- **${label}:** ${value}`;
}

function formatInputsTable(inputs: readonly ActionDirectiveInfo['inputs'][number][]): string {
  let result = '';
  if (inputs.length > 0) {
    const lines: string[] = ['| Input | Type | Required | Default | Description |', '| --- | --- | --- | --- | --- |'];
    for (const input of inputs) {
      const required = input.required ? 'yes' : 'no';
      const def = input.defaultValue ?? '—';
      lines.push(`| \`${input.alias}\` | \`${input.type}\` | ${required} | \`${def}\` | ${input.description} |`);
    }
    result = lines.join('\n');
  }
  return result;
}

function formatStateInteraction(entry: ActionDirectiveInfo): string {
  let result = '_None — does not directly read or write the state machine._';
  if (entry.stateInteraction.length > 0) {
    result = entry.stateInteraction.map((s) => `\`${s}\``).join(', ');
  }
  return result;
}

function formatDirectiveEntry(entry: ActionDirectiveInfo, depth: 'brief' | 'full'): string {
  const lines: string[] = [];
  lines.push(`# ${entry.className}`);
  lines.push('');
  lines.push(entry.description);
  lines.push('');
  lines.push(bullet('selector', `\`${entry.selector}\``));
  lines.push(bullet('module', `\`${entry.module}\``));
  lines.push(bullet('slug', `\`${entry.slug}\``));
  lines.push(bullet('produces context', entry.producesContext ? 'yes (provides `ActionContextStore` via DI)' : 'no'));
  lines.push(bullet('consumes context', entry.consumesContext ? 'yes (injects `DbxActionContextStoreSourceInstance`)' : 'no'));
  lines.push('');

  if (depth === 'full') {
    lines.push('## Inputs');
    lines.push('');
    lines.push(entry.inputs.length > 0 ? formatInputsTable(entry.inputs) : '_No inputs._');
    lines.push('');
    if (entry.outputs.length > 0) {
      lines.push('## Outputs');
      lines.push('');
      for (const output of entry.outputs) {
        lines.push(`- \`${output.name}: ${output.type}\` — ${output.description}`);
      }
      lines.push('');
    }
    lines.push('## State interaction');
    lines.push('');
    lines.push(formatStateInteraction(entry));
    lines.push('');
    lines.push('## Example');
    lines.push('');
    lines.push('```html');
    lines.push(entry.example);
    lines.push('```');
    if (entry.skillRefs.length > 0) {
      const skillsText = entry.skillRefs.map((s) => code(s)).join(', ');
      lines.push('', `→ Skills: ${skillsText}`);
    }
  } else {
    lines.push('## State interaction', '', formatStateInteraction(entry), '', `→ Call \`dbx_action_lookup topic="${entry.slug}" depth="full"\` for inputs, outputs, and the example.`);
  }

  return lines.join('\n');
}

function formatStoreEntry(entry: ActionStoreInfo, depth: 'brief' | 'full'): string {
  const lines: string[] = [];
  lines.push(`# ${entry.className}`);
  lines.push('');
  lines.push(entry.description);
  lines.push('');
  lines.push(bullet('module', `\`${entry.module}\``));
  lines.push(bullet('slug', `\`${entry.slug}\``));
  lines.push('');

  if (depth === 'full') {
    if (entry.methods.length > 0) {
      lines.push('## Methods');
      lines.push('');
      lines.push('| Method | Signature | Description |');
      lines.push('| --- | --- | --- |');
      for (const method of entry.methods) {
        lines.push(`| \`${method.name}\` | \`${method.signature}\` | ${method.description} |`);
      }
      lines.push('');
    }
    if (entry.observables.length > 0) {
      lines.push('## Observables');
      lines.push('');
      lines.push('| Observable | Type | Description |');
      lines.push('| --- | --- | --- |');
      for (const obs of entry.observables) {
        lines.push(`| \`${obs.name}\` | \`${obs.type}\` | ${obs.description} |`);
      }
      lines.push('');
    }
    if (entry.disabledKeyDefaults.length > 0) {
      lines.push('## Disabled-key constants');
      lines.push('');
      for (const key of entry.disabledKeyDefaults) {
        lines.push(`- \`${key}\``);
      }
      lines.push('');
    }
    lines.push('## Example', '', '```ts', entry.example, '```');
    if (entry.skillRefs.length > 0) {
      const skillsText = entry.skillRefs.map((s) => code(s)).join(', ');
      lines.push('', `→ Skills: ${skillsText}`);
    }
  } else {
    lines.push(`Methods: ${entry.methods.length} · Observables: ${entry.observables.length}`, '', `→ Call \`dbx_action_lookup topic="${entry.slug}" depth="full"\` for the full method/observable tables.`);
  }

  return lines.join('\n');
}

function formatStateDiagram(entry: ActionStateInfo): string {
  const lines: string[] = [`DbxActionState.${entry.stateValue}`, ''];
  if (entry.transitionsFrom.length > 0) {
    lines.push(`← ${entry.transitionsFrom.join(', ')}`);
  } else {
    lines.push('← (initial state, no incoming transitions)');
  }
  if (entry.transitionsTo.length > 0) {
    lines.push(`→ ${entry.transitionsTo.join(', ')}`);
  } else {
    lines.push('→ (terminal state, no outgoing transitions)');
  }
  return lines.join('\n');
}

function formatStateEntry(entry: ActionStateInfo, depth: 'brief' | 'full'): string {
  const lines: string[] = [`# DbxActionState.${entry.stateValue}`, '', entry.description, '', bullet('enum value', `\`'${entry.literal}'\``), bullet('slug', `\`${entry.slug}\``), '', '## Transitions', '', '```', formatStateDiagram(entry), '```'];
  if (depth === 'full' && entry.skillRefs.length > 0) {
    const skillsText = entry.skillRefs.map((s) => code(s)).join(', ');
    lines.push('', `→ Skills: ${skillsText}`);
  }
  return lines.join('\n');
}

function formatActionEntry(entry: ActionEntryInfo, depth: 'brief' | 'full'): string {
  let result: string;
  switch (entry.role) {
    case 'directive':
      result = formatDirectiveEntry(entry, depth);
      break;
    case 'store':
      result = formatStoreEntry(entry, depth);
      break;
    case 'state':
      result = formatStateEntry(entry, depth);
      break;
  }
  return result;
}

function formatActionGroup(entries: readonly ActionEntryInfo[], title: string): string {
  const lines: string[] = [`# ${title}`, '', `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}.`, ''];
  for (const entry of entries) {
    let header: string;
    if (entry.role === 'directive') {
      header = `${entry.className} — \`${entry.selector}\``;
    } else if (entry.role === 'store') {
      header = entry.className;
    } else {
      header = `DbxActionState.${entry.stateValue}`;
    }
    lines.push(`## ${header}`);
    lines.push('');
    lines.push(`- **slug:** \`${entry.slug}\``);
    lines.push(`- ${entry.description}`);
    if (entry.role === 'state') {
      lines.push('');
      lines.push('```');
      lines.push(formatStateDiagram(entry));
      lines.push('```');
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

function formatCatalog(): string {
  const lines: string[] = ['# Action catalog', '', `${ACTION_ENTRIES.length} entries across ${ACTION_ROLE_ORDER.length} roles.`, ''];
  for (const role of ACTION_ROLE_ORDER) {
    const entries = getActionEntriesByRole(role);
    lines.push(`## ${ROLE_TITLES[role]} (${entries.length})`);
    lines.push('');
    for (const entry of entries) {
      let label: string;
      if (entry.role === 'directive') {
        label = `\`${entry.slug}\` → \`${entry.selector}\` (${entry.className})`;
      } else if (entry.role === 'store') {
        label = `\`${entry.slug}\` → ${entry.className}`;
      } else {
        label = `\`${entry.slug}\` → DbxActionState.${entry.stateValue}`;
      }
      lines.push(`- ${label}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

function formatNotFound(normalized: string, candidates: readonly ActionEntryInfo[]): string {
  const lines: string[] = [`No action entry matched \`${normalized}\`.`, ''];
  if (candidates.length > 0) {
    lines.push('Did you mean one of these?');
    lines.push('');
    for (const entry of candidates) {
      let label: string;
      if (entry.role === 'directive') {
        label = `\`${entry.slug}\` → ${entry.className} (\`${entry.selector}\`)`;
      } else if (entry.role === 'store') {
        label = `\`${entry.slug}\` → ${entry.className}`;
      } else {
        label = `\`${entry.slug}\` → DbxActionState.${entry.stateValue}`;
      }
      lines.push(`- ${label} — ${entry.description}`);
    }
  } else {
    lines.push('Try `dbx_action_lookup topic="list"` to browse the catalog.');
  }
  return lines.join('\n');
}

function code(value: string): string {
  return '`' + value + '`';
}

// MARK: Handler
/**
 * Tool handler for `dbx_action_lookup`. Resolves the requested action topic
 * against the registry and renders the matching catalog, role group, single
 * entry, state taxonomy, or not-found suggestion list.
 *
 * @param rawArgs - the unvalidated tool arguments from the MCP runtime
 * @returns the rendered match, or an error result when args fail validation
 */
export function runLookupAction(rawArgs: unknown): ToolResult {
  let args: ParsedLookupActionArgs;
  try {
    args = parseLookupActionArgs(rawArgs);
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
      text = formatActionEntry(match.entry, args.depth);
      break;
    case 'group':
      text = formatActionGroup(match.entries, match.title);
      break;
    case 'not-found':
      text = formatNotFound(match.normalized, match.candidates);
      break;
  }

  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const lookupActionTool: DbxTool = {
  definition: DBX_ACTION_LOOKUP_TOOL,
  run: runLookupAction
};
