/**
 * `dbx_form_lookup` tool.
 *
 * Form-domain lookup. Accepts a topic (slug, factory name, `produces` value,
 * tier name, alias, or the literal `'list'`) and a depth and returns markdown
 * documentation for `@dereekb/dbx-form` form entries.
 *
 * Registered via the low-level `server.setRequestHandler(CallToolRequestSchema, ...)`
 * API (not `McpServer.registerTool`) because registerTool requires a zod
 * schema — the workspace standard is arktype. Input validation happens in
 * {@link parseLookupFormArgs} using arktype.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { FORM_FIELDS, FORM_TIER_ORDER, getFormField, getFormFieldsByProduces, getFormFieldsByTier, getFormProducesCatalog, type FormFieldInfo, type FormTier } from '../registry/index.js';
import { resolveTopicAlias } from './form-alias-resolver.js';
import { formatFormFieldEntry, formatFormFieldGroup } from './form-lookup.formatter.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Tool registry
/**
 * Tool advertised via `tools/list`. Input schema is plain JSON Schema so the
 * MCP SDK passes it straight through without any zod involvement.
 */
const DBX_FORM_LOOKUP_TOOL: Tool = {
  name: 'dbx_form_lookup',
  description: [
    'Look up @dereekb/dbx-form entries.',
    '',
    'The `topic` accepts:',
    '  • a form registry slug like "text", "date-range-row", "address-group";',
    '  • a form factory name like "dbxForgeTextField";',
    '  • an output primitive like "string", "Date", "RowField" (returns every form entry that produces that primitive);',
    "  • a form tier name (`'field-factory'`, `'composite-builder'`, `'primitive'`) to list every entry in that tier;",
    '  • the literal `"list"` for the form catalog.',
    '',
    'Form synonyms resolve automatically (e.g. "datepicker" → "date").'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'Slug, factory name, alias, produces value, tier name, or "list".'
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
const LookupFormArgsType = type({
  topic: 'string',
  'depth?': "'brief' | 'full'"
});

/**
 * Parses and validates the caller's args via arktype. Throws a user-facing
 * error string when validation fails — the handler catches and formats it.
 */
function parseLookupFormArgs(raw: unknown): { readonly topic: string; readonly depth: 'brief' | 'full' } {
  const parsed = LookupFormArgsType(raw);

  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }

  const result = {
    topic: parsed.topic,
    depth: parsed.depth ?? ('full' as const)
  };
  return result;
}

// MARK: Resolution
type LookupFormMatch = { readonly kind: 'single'; readonly field: FormFieldInfo } | { readonly kind: 'group'; readonly title: string; readonly fields: readonly FormFieldInfo[] } | { readonly kind: 'catalog' } | { readonly kind: 'not-found'; readonly normalized: string; readonly candidates: readonly FormFieldInfo[] };

/**
 * Resolves a topic string into the best form match.
 *
 * Resolution order:
 *   1. `'list'` → catalog
 *   2. form tier name → form group
 *   3. exact form slug or factory-name match → single form entry
 *   4. form alias → remap and retry slug/factory lookup
 *   5. form `produces` value match → form group
 *   6. fuzzy substring search over form slug/factoryName/description
 */
function resolveTopic(rawTopic: string): LookupFormMatch {
  const lowered = rawTopic.trim().toLowerCase();
  let result: LookupFormMatch;

  if (lowered === 'list' || lowered === 'catalog' || lowered === 'all') {
    result = { kind: 'catalog' };
  } else if (FORM_TIER_ORDER.includes(lowered as FormTier)) {
    const tier = lowered as FormTier;
    result = { kind: 'group', title: `Form entries: tier = ${tier}`, fields: getFormFieldsByTier(tier) };
  } else {
    const directHit = getFormField(rawTopic) ?? getFormField(lowered);
    if (directHit) {
      result = { kind: 'single', field: directHit };
    } else {
      const aliased = resolveTopicAlias(rawTopic);
      const aliasHit = aliased !== lowered ? getFormField(aliased) : undefined;
      if (aliasHit) {
        result = { kind: 'single', field: aliasHit };
      } else {
        const produces = findProducesMatch(rawTopic);
        if (produces) {
          result = { kind: 'group', title: `Form entries producing \`${produces}\``, fields: getFormFieldsByProduces(produces) };
        } else {
          result = { kind: 'not-found', normalized: aliased, candidates: fuzzyCandidates(aliased) };
        }
      }
    }
  }
  return result;
}

/**
 * Case-insensitive exact match against the catalog of `produces` values.
 * Returns the catalog value with its original casing when found.
 */
function findProducesMatch(topic: string): string | undefined {
  const lowered = topic.trim().toLowerCase();
  const catalog = getFormProducesCatalog();
  const result = catalog.find((v) => v.toLowerCase() === lowered);
  return result;
}

/**
 * Cheap substring-based candidate list used when a topic doesn't resolve.
 * Returns up to five entries whose slug / factory name / description contains
 * the query. Good enough at registry size <50 — revisit if it grows.
 */
function fuzzyCandidates(query: string): readonly FormFieldInfo[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return [];
  }
  const scored: { readonly field: FormFieldInfo; readonly score: number }[] = [];
  for (const field of FORM_FIELDS) {
    const slugHit = field.slug.toLowerCase().includes(q) ? 3 : 0;
    const nameHit = field.factoryName.toLowerCase().includes(q) ? 2 : 0;
    const descHit = field.description.toLowerCase().includes(q) ? 1 : 0;
    const score = slugHit + nameHit + descHit;
    if (score > 0) {
      scored.push({ field, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const result = scored.slice(0, 5).map((s) => s.field);
  return result;
}

// MARK: Formatting
function formatCatalog(): string {
  const lines: string[] = ['# Form catalog', '', `${FORM_FIELDS.length} entries across ${FORM_TIER_ORDER.length} tiers.`, ''];
  for (const tier of FORM_TIER_ORDER) {
    const list = getFormFieldsByTier(tier);
    lines.push(`## ${tier} (${list.length})`);
    lines.push('');
    for (const field of list) {
      lines.push(`- \`${field.slug}\` → ${field.factoryName} · produces \`${field.produces}\``);
    }
    lines.push('');
  }
  lines.push('## Output primitives');
  lines.push('');
  const catalog = getFormProducesCatalog();
  for (const value of catalog) {
    const count = getFormFieldsByProduces(value).length;
    lines.push(`- \`${value}\` (${count})`);
  }
  const result = lines.join('\n').trimEnd();
  return result;
}

function formatNotFound(normalized: string, candidates: readonly FormFieldInfo[]): string {
  const lines: string[] = [`No form entry matched \`${normalized}\`.`, ''];
  if (candidates.length > 0) {
    lines.push('Did you mean one of these?');
    lines.push('');
    for (const field of candidates) {
      lines.push(`- \`${field.slug}\` → ${field.factoryName} — ${field.description}`);
    }
  } else {
    lines.push('Try `dbx_form_lookup topic="list"` to browse the catalog.');
  }
  const result = lines.join('\n');
  return result;
}

// MARK: Handler
/**
 * Executes a form lookup and returns a ToolResult. Exported separately so it
 * can be tested without spinning up the full MCP transport.
 */
export function runLookupForm(rawArgs: unknown): ToolResult {
  let args: { readonly topic: string; readonly depth: 'brief' | 'full' };
  try {
    args = parseLookupFormArgs(rawArgs);
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
      text = formatFormFieldEntry(match.field, args.depth);
      break;
    case 'group':
      text = formatFormFieldGroup(match.fields, match.title);
      break;
    case 'not-found':
      text = formatNotFound(match.normalized, match.candidates);
      break;
  }

  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const lookupFormTool: DbxTool = {
  definition: DBX_FORM_LOOKUP_TOOL,
  run: runLookupForm
};
