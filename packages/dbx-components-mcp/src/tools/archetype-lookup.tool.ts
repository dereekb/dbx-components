/**
 * `dbx_model_archetype_lookup` tool.
 *
 * Read-only browser for the archetype catalog. Accepts a slug or the literal
 * `"list"` and returns markdown documentation for the matched archetype —
 * shape, sync mode, when-to-use, axes, and implementation pointers.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { MODEL_ARCHETYPES, resolveModelArchetype, type ModelArchetypeInfo } from '../registry/index.js';
import { formatArchetypeCatalog, formatArchetypeEntry } from './archetype/format.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const DBX_MODEL_ARCHETYPE_LOOKUP_TOOL: Tool = {
  name: 'dbx_model_archetype_lookup',
  description: ['Look up an archetype in the model-archetype catalog. Accepts:', '  • a slug (`"root-entity"`, `"denormalised-aggregate"`, …);', '  • the literal `"list"` for the full catalog grouped by family.', '', 'Optional inputs:', '  • `axes`: optional axis filter (`{ "subPurpose": "private" }`) — when set, the description shifts to focus on the matched axis.'].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'Archetype slug, or "list".' },
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
  const candidates = MODEL_ARCHETYPES.filter((a) => a.slug.includes(slug.toLowerCase()))
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
 * @param rawArgs - The unvalidated tool arguments.
 * @returns The rendered archetype entry / catalog / not-found message.
 */
export function runArchetypeLookup(rawArgs: unknown): ToolResult {
  let result: ToolResult;
  try {
    const args = parseArgs(rawArgs);
    const slugLower = args.slug.trim().toLowerCase();
    let text: string;
    let isError = false;
    if (CATALOG_KEYWORDS.has(slugLower)) {
      text = formatArchetypeCatalog(MODEL_ARCHETYPES);
    } else {
      const resolved = resolveModelArchetype(args.slug);
      if (resolved) {
        text = formatLookup(resolved.archetype, args.axes);
      } else {
        text = formatNotFound(args.slug);
        isError = true;
      }
    }
    result = { content: [{ type: 'text', text }], isError };
  } catch (err) {
    result = toolError(err instanceof Error ? err.message : String(err));
  }
  return result;
}

function formatLookup(archetype: ModelArchetypeInfo, axesFilter: { readonly [k: string]: string } | undefined): string {
  const axes = axesFilter ?? undefined;
  return formatArchetypeEntry(archetype, { axes, showFullAxes: true });
}

export const archetypeLookupTool: DbxTool = {
  definition: DBX_MODEL_ARCHETYPE_LOOKUP_TOOL,
  run: runArchetypeLookup
};
