/**
 * `dbx_lookup` tool.
 *
 * Unified lookup over the forge registry. Accepts a topic (slug, factory name,
 * `produces` value, alias, or the literal `'list'`) and a depth and returns
 * markdown documentation.
 *
 * Registered via the low-level `server.setRequestHandler(CallToolRequestSchema, ...)`
 * API (not `McpServer.registerTool`) because registerTool requires a zod
 * schema — the workspace standard is arktype. Input validation happens in
 * {@link parseLookupArgs} using arktype.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { FORGE_FIELDS, FORGE_TIER_ORDER, getForgeField, getForgeFieldsByProduces, getForgeFieldsByTier, getForgeProducesCatalog, type ForgeFieldInfo, type ForgeTier } from '../registry/index.js';
import { resolveTopicAlias } from './alias-resolver.js';
import { formatForgeFieldEntry, formatForgeFieldGroup } from './forge-lookup.formatter.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Tool registry
/**
 * Tool advertised via `tools/list`. Input schema is plain JSON Schema so the
 * MCP SDK passes it straight through without any zod involvement.
 */
const DBX_LOOKUP_TOOL: Tool = {
  name: 'dbx_lookup',
  description: [
    'Look up @dereekb/dbx-form forge entries — field factories, composite builders, and primitives.',
    '',
    'The `topic` accepts:',
    '  • a registry slug like "text", "date-range-row", "address-group";',
    '  • a factory name like "dbxForgeTextField";',
    '  • an output primitive like "string", "Date", "RowField" (returns every entry that produces that primitive);',
    "  • a tier name (`'field-factory'`, `'composite-builder'`, `'primitive'`) to list every entry in that tier;",
    '  • the literal `"list"` to get the full catalog grouped by tier.',
    '',
    'Many common synonyms also resolve (e.g. "datepicker" → "date", "chips" → "pickable-chip", "login" → "username-password-login-fields").'
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
const LookupArgsType = type({
  topic: 'string',
  'depth?': "'brief' | 'full'"
});

/**
 * Parses and validates the caller's args via arktype. Throws a user-facing
 * error string when validation fails — the handler catches and formats it.
 */
function parseLookupArgs(raw: unknown): { readonly topic: string; readonly depth: 'brief' | 'full' } {
  const parsed = LookupArgsType(raw);

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
type LookupMatch = { readonly kind: 'single'; readonly field: ForgeFieldInfo } | { readonly kind: 'group'; readonly title: string; readonly fields: readonly ForgeFieldInfo[] } | { readonly kind: 'catalog' } | { readonly kind: 'not-found'; readonly normalized: string; readonly candidates: readonly ForgeFieldInfo[] };

/**
 * Resolves a topic string into the best match against the registry.
 *
 * Resolution order:
 *   1. `'list'` → catalog
 *   2. tier name (`'field-factory'`, etc.) → group
 *   3. exact slug or factory-name match → single entry
 *   4. alias → remap and retry slug/factory lookup
 *   5. `produces` value match → group
 *   6. fuzzy substring search over slug/factoryName/description
 */
function resolveTopic(rawTopic: string): LookupMatch {
  const lowered = rawTopic.trim().toLowerCase();
  let result: LookupMatch;

  if (lowered === 'list' || lowered === 'catalog' || lowered === 'all') {
    result = { kind: 'catalog' };
  } else if (FORGE_TIER_ORDER.includes(lowered as ForgeTier)) {
    const tier = lowered as ForgeTier;
    result = { kind: 'group', title: `Forge entries: tier = ${tier}`, fields: getForgeFieldsByTier(tier) };
  } else {
    const directHit = getForgeField(rawTopic) ?? getForgeField(lowered);
    if (directHit) {
      result = { kind: 'single', field: directHit };
    } else {
      const aliased = resolveTopicAlias(rawTopic);
      const aliasHit = aliased !== lowered ? getForgeField(aliased) : undefined;
      if (aliasHit) {
        result = { kind: 'single', field: aliasHit };
      } else {
        const produces = findProducesMatch(rawTopic);
        if (produces) {
          result = { kind: 'group', title: `Forge entries producing \`${produces}\``, fields: getForgeFieldsByProduces(produces) };
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
  const catalog = getForgeProducesCatalog();
  const result = catalog.find((v) => v.toLowerCase() === lowered);
  return result;
}

/**
 * Cheap substring-based candidate list used when a topic doesn't resolve.
 * Returns up to five entries whose slug / factory name / description contains
 * the query. Good enough at registry size <50 — revisit if it grows.
 */
function fuzzyCandidates(query: string): readonly ForgeFieldInfo[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return [];
  }
  const scored: { readonly field: ForgeFieldInfo; readonly score: number }[] = [];
  for (const field of FORGE_FIELDS) {
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
  const lines: string[] = ['# Forge catalog', '', `${FORGE_FIELDS.length} entries across ${FORGE_TIER_ORDER.length} tiers.`, ''];
  for (const tier of FORGE_TIER_ORDER) {
    const list = getForgeFieldsByTier(tier);
    lines.push(`## ${tier} (${list.length})`);
    lines.push('');
    for (const field of list) {
      lines.push(`- \`${field.slug}\` → ${field.factoryName} · produces \`${field.produces}\``);
    }
    lines.push('');
  }
  lines.push('## Output primitives');
  lines.push('');
  const catalog = getForgeProducesCatalog();
  for (const value of catalog) {
    const count = getForgeFieldsByProduces(value).length;
    lines.push(`- \`${value}\` (${count})`);
  }
  const result = lines.join('\n').trimEnd();
  return result;
}

function formatNotFound(normalized: string, candidates: readonly ForgeFieldInfo[]): string {
  const lines: string[] = [`No forge entry matched \`${normalized}\`.`, ''];
  if (candidates.length > 0) {
    lines.push('Did you mean one of these?');
    lines.push('');
    for (const field of candidates) {
      lines.push(`- \`${field.slug}\` → ${field.factoryName} — ${field.description}`);
    }
  } else {
    lines.push('Try `dbx_lookup topic="list"` to browse the catalog.');
  }
  const result = lines.join('\n');
  return result;
}

// MARK: Handler
/**
 * Executes a lookup against the forge registry and returns a ToolResult.
 * Exported separately so it can be tested without spinning up the full MCP
 * transport.
 */
export function runLookup(rawArgs: unknown): ToolResult {
  let args: { readonly topic: string; readonly depth: 'brief' | 'full' };
  try {
    args = parseLookupArgs(rawArgs);
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
      text = formatForgeFieldEntry(match.field, args.depth);
      break;
    case 'group':
      text = formatForgeFieldGroup(match.fields, match.title);
      break;
    case 'not-found':
      text = formatNotFound(match.normalized, match.candidates);
      break;
  }

  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const lookupTool: DbxTool = {
  definition: DBX_LOOKUP_TOOL,
  run: runLookup
};
