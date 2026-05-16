/**
 * `dbx_model_archetype_lookup` tool.
 *
 * Read-only browser for the archetype catalog. Accepts a slug (v3 or any
 * v1/v2 alias) or the literal `"list"` and returns markdown documentation
 * for the matched archetype — shape, sync mode, when-to-use, axes, aliases,
 * and implementation pointers. When the input is a v1/v2 alias, the output
 * leads with a deprecation note pointing at the v3 successor.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { MODEL_ARCHETYPES, resolveModelArchetype, type ModelArchetypeInfo } from '../registry/index.js';
import { formatArchetypeCatalog, formatArchetypeEntry } from './archetype/format.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const DBX_MODEL_ARCHETYPE_LOOKUP_TOOL: Tool = {
  name: 'dbx_model_archetype_lookup',
  description: [
    'Look up an archetype in the model-archetype catalog. Accepts:',
    '  • a v3 slug (`"root-entity"`, `"denormalised-aggregate"`, …);',
    '  • a v1/v2 alias (`"entity-private"`, `"digest"`, `"temporal-summary"`, `"subcollection-entity"`, …) — returns the v3 successor with a deprecation note;',
    '  • the literal `"list"` for the full catalog grouped by family.',
    '',
    'Optional inputs:',
    '  • `axes`: optional axis filter (`{ "subPurpose": "private" }`) — when set, the description shifts to focus on the matched axis.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'v3 archetype slug, any v1/v2 alias, or "list".' },
      axes: {
        type: 'object',
        description: 'Optional axis filter — e.g. `{ "subPurpose": "private" }`.',
        additionalProperties: { type: 'string' }
      }
    },
    required: ['slug']
  }
};

const LookupArgsType = type({
  slug: 'string',
  'axes?': { '[string]': 'string' }
});

const CATALOG_KEYWORDS: ReadonlySet<string> = new Set(['list', 'catalog', 'all']);

interface ParsedLookupArgs {
  readonly slug: string;
  readonly axes: { readonly [k: string]: string } | undefined;
}

function parseArgs(raw: unknown): ParsedLookupArgs {
  const parsed = LookupArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new TypeError(`Invalid arguments: ${parsed.summary}`);
  }
  return { slug: parsed.slug, axes: parsed.axes };
}

function formatNotFound(slug: string): string {
  const candidates = MODEL_ARCHETYPES.filter((a) => a.slug.includes(slug.toLowerCase()) || a.aliases.some((al) => al.includes(slug.toLowerCase())))
    .slice(0, 5)
    .map((a) => `\`${a.slug}\``);
  const lines: string[] = [`No archetype matched \`${slug}\`.`];
  if (candidates.length > 0) {
    lines.push('', `Did you mean: ${candidates.join(', ')}?`);
  }
  lines.push('', 'Try `dbx_model_archetype_lookup slug="list"` to browse the full catalog.');
  return lines.join('\n');
}

/**
 * Handler for `dbx_model_archetype_lookup`.
 *
 * @param rawArgs - the unvalidated tool arguments
 * @returns the rendered archetype entry / catalog / not-found message
 */
export function runArchetypeLookup(rawArgs: unknown): ToolResult {
  let args: ParsedLookupArgs;
  try {
    args = parseArgs(rawArgs);
  } catch (err) {
    return toolError(err instanceof Error ? err.message : String(err));
  }

  const slugLower = args.slug.trim().toLowerCase();
  let text: string;
  let isError = false;
  if (CATALOG_KEYWORDS.has(slugLower)) {
    text = formatArchetypeCatalog(MODEL_ARCHETYPES);
  } else {
    const resolved = resolveModelArchetype(args.slug);
    if (!resolved) {
      text = formatNotFound(args.slug);
      isError = true;
    } else {
      text = formatLookup(resolved.archetype, resolved.viaAlias ? args.slug : undefined, args.axes);
    }
  }
  return { content: [{ type: 'text', text }], isError };
}

function formatLookup(archetype: ModelArchetypeInfo, deprecatedAlias: string | undefined, axesFilter: { readonly [k: string]: string } | undefined): string {
  const axes = axesFilter ?? undefined;
  return formatArchetypeEntry(archetype, { axes, deprecatedAlias, showFullAxes: true });
}

export const archetypeLookupTool: DbxTool = {
  definition: DBX_MODEL_ARCHETYPE_LOOKUP_TOOL,
  run: runArchetypeLookup
};
