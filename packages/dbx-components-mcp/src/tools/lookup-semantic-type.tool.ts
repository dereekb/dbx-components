/**
 * `dbx_semantic_type_lookup` tool factory.
 *
 * Exact-name lookup against the merged semantic-types registry. The tool
 * needs the registry passed in because the registry is loaded
 * asynchronously at server startup, unlike the static Firebase /
 * form-field registries that can be imported at module load time.
 *
 * Brief vs full output is controlled by the `depth` argument; both shapes
 * are rendered by {@link formatSemanticTypeEntry}. When the same name
 * resolves in multiple packages (rare cross-package collision) the tool
 * returns every match in brief form.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import type { SemanticTypeRegistry } from '../registry/semantic-types.js';
import { formatSemanticTypeCatalog, formatSemanticTypeCollision, formatSemanticTypeEntry } from './semantic-type-lookup.formatter.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Tool advertisement
const DBX_SEMANTIC_TYPE_LOOKUP_TOOL: Tool = {
  name: 'dbx_semantic_type_lookup',
  description: [
    'Look up a semantic type by exact name in the merged @dereekb registry plus any downstream-app manifests configured via dbx-mcp.config.json.',
    '',
    'Names are case-sensitive. Pass the literal `"catalog"` to print a registry summary (entry count, distinct topics, packages, baseTypes).',
    '',
    'When the same name is exported by multiple packages (rare) every match is returned in brief form.',
    '',
    'Use `dbx_semantic_type_search` to find candidates by topic, baseType, package, or substring before calling lookup.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Exact semantic-type name (e.g. "EmailAddress", "Milliseconds"), or "catalog" for a registry summary.'
      },
      depth: {
        type: 'string',
        enum: ['brief', 'full'],
        description: "Detail level for single-entry hits. Defaults to 'full'.",
        default: 'full'
      }
    },
    required: ['name']
  }
};

// MARK: Input validation
const LookupSemanticTypeArgsType = type({
  name: 'string',
  'depth?': "'brief' | 'full'"
});

interface ParsedLookupArgs {
  readonly name: string;
  readonly depth: 'brief' | 'full';
}

function parseLookupArgs(raw: unknown): ParsedLookupArgs {
  const parsed = LookupSemanticTypeArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new TypeError(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedLookupArgs = {
    name: parsed.name,
    depth: parsed.depth ?? 'full'
  };
  return result;
}

// MARK: Factory
/**
 * Configuration for {@link createSemanticTypeLookupTool}.
 */
export interface CreateSemanticTypeLookupToolConfig {
  readonly registry: SemanticTypeRegistry;
}

/**
 * Builds the `dbx_semantic_type_lookup` tool against a registry. Called by
 * {@link registerTools} once the registry has been loaded at server startup.
 *
 * @param config - the registry the tool should resolve against
 * @returns a registered {@link DbxTool} ready to add to the dispatch table
 */
export function createSemanticTypeLookupTool(config: CreateSemanticTypeLookupToolConfig): DbxTool {
  const { registry } = config;

  function run(rawArgs: unknown): ToolResult {
    let args: ParsedLookupArgs;
    let result: ToolResult;
    try {
      args = parseLookupArgs(rawArgs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return toolError(message);
    }

    const trimmed = args.name.trim();
    const lowered = trimmed.toLowerCase();
    if (lowered === 'catalog' || lowered === 'list' || lowered === 'all') {
      const text = formatSemanticTypeCatalog({
        total: registry.all.length,
        topics: registry.topics,
        packages: registry.packages,
        baseTypes: registry.baseTypes,
        loadedSources: registry.loadedSources
      });
      result = { content: [{ type: 'text', text }] };
    } else {
      const matches = registry.findByName(trimmed);
      let text: string;
      if (matches.length === 0) {
        text = formatNotFound(trimmed, registry);
      } else if (matches.length === 1) {
        text = formatSemanticTypeEntry(matches[0], args.depth);
      } else {
        text = formatSemanticTypeCollision(trimmed, matches);
      }
      result = { content: [{ type: 'text', text }] };
    }
    return result;
  }

  const tool: DbxTool = {
    definition: DBX_SEMANTIC_TYPE_LOOKUP_TOOL,
    run
  };
  return tool;
}

// MARK: Helpers
function formatNotFound(name: string, registry: SemanticTypeRegistry): string {
  let result: string;
  if (registry.all.length === 0) {
    result = [`No semantic type matched \`${name}\` — the registry is currently empty.`, '', 'The registry fills in as `@dereekb/util` and `@dereekb/model` types gain `@semanticType` JSDoc tags. Until then, `dbx_semantic_type_lookup name="catalog"` confirms which sources have loaded.'].join('\n');
  } else {
    result = [`No semantic type matched \`${name}\`.`, '', `Try \`dbx_semantic_type_search query="${name}"\` for a fuzzy match, or \`dbx_semantic_type_lookup name="catalog"\` to browse the registry summary.`].join('\n');
  }
  return result;
}
