/**
 * `dbx_css_token_lookup` tool.
 *
 * Forward-lookup over the design-token catalog. Accepts any combination of
 * `intent`, `value`, `role`, `component`, or `category` and returns markdown
 * documentation for the best-matching token(s).
 *
 * Reads from a {@link TokenRegistry} supplied at construction time — the
 * server bootstrap composes the registry from the bundled
 * `dereekb-dbx-web` / `dereekb-dbx-form` / `angular-material-m3` /
 * `angular-material-mdc` manifests plus any external manifests declared in
 * `dbx-mcp.config.json`.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { TOKEN_ROLES, type TokenRegistry } from '@dereekb/dbx-cli';
import { resolveToken, formatCssTokenLookup, type ResolveTokenInput } from './css-token-lookup/index.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Tool advertisement
const DBX_CSS_TOKEN_LOOKUP_TOOL: Tool = {
  name: 'dbx_css_token_lookup',
  description: [
    'Forward-lookup over the dbx-web + Angular Material design-token catalog.',
    '',
    'Pass any combination of:',
    '  • `intent` — plain English ("hint text color", "card radius", "section gap", "primary button color");',
    '  • `value` — raw CSS value to reverse-lookup (`rgba(0,0,0,0.6)`, `12px`, `#26353f`, `0 1px 2px rgba(0,0,0,.06)`);',
    '  • `role` — narrow the candidate pool (color, text-color, surface, spacing, radius, elevation, shadow, typography, motion, state-layer, size, breakpoint);',
    '  • `component` — component scope slug: an Angular Material slug ("mat-progress-bar", "mat-button", ...) for MDC tokens, or a dbx component scope ("sidenav", "list", "section", ...) for component-scoped `--dbx-*` tokens;',
    '  • `category` — `"list"` for the full catalog, or `"dbx-web"|"dbx-form"|"mat-sys"|"mdc"|"app"` to browse one source.',
    '',
    'Returns the recommended `var(--…)` plus light/dark defaults, anti-use notes, the dbx-web utility class or primitive that wraps the underlying token, and any see-also references.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      intent: { type: 'string', description: 'Plain-English intent — what the value is for.' },
      value: { type: 'string', description: 'Raw CSS value to reverse-lookup.' },
      role: { type: 'string', enum: [...TOKEN_ROLES], description: 'Token-role filter.' },
      component: { type: 'string', description: 'Component scope slug — an Angular Material slug for MDC tokens, or a dbx component scope (e.g. "sidenav") for component-scoped --dbx-* tokens.' },
      category: { type: 'string', description: '"list" for the full catalog, or "dbx-web"|"dbx-form"|"mat-sys"|"mdc"|"app" to browse one source.' }
    }
  }
};

// MARK: Input validation
const CssTokenLookupArgs = type({
  'intent?': 'string',
  'value?': 'string',
  'role?': 'string',
  'component?': 'string',
  'category?': 'string'
});

function parseArgs(raw: unknown): ResolveTokenInput {
  const parsed = CssTokenLookupArgs(raw);
  if (parsed instanceof type.errors) {
    throw new TypeError(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ResolveTokenInput = {
    intent: parsed.intent,
    value: parsed.value,
    role: parsed.role,
    component: parsed.component,
    category: parsed.category
  };
  return result;
}

// MARK: Tool factory
/**
 * Input to {@link createCssTokenLookupTool}.
 */
export interface CreateCssTokenLookupToolInput {
  /**
   * Token registry the tool reads from.
   */
  readonly registry: TokenRegistry;
}

/**
 * Creates the `dbx_css_token_lookup` tool wired to the supplied registry.
 *
 * @param input - The registry the tool reads from.
 * @returns A {@link DbxTool} ready to register with the dispatcher.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createCssTokenLookupTool(input: CreateCssTokenLookupToolInput): DbxTool {
  const { registry } = input;
  const run = (rawArgs: unknown): ToolResult => {
    let tool: ToolResult;
    try {
      const args = parseArgs(rawArgs);
      const result = resolveToken(registry, args);
      const text = formatCssTokenLookup(registry, args, result);
      tool = { content: [{ type: 'text', text }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      tool = toolError(message);
    }
    return tool;
  };
  return { definition: DBX_CSS_TOKEN_LOOKUP_TOOL, run };
}
