/**
 * `dbx_css_token_lookup` tool.
 *
 * Forward-lookup over the design-token catalog. Accepts any combination of
 * `intent`, `value`, `role`, `component`, or `category` and returns markdown
 * documentation for the best-matching token(s).
 *
 * Reads from a {@link TokenRegistry} supplied at construction time — the
 * server bootstrap composes the registry from the bundled
 * `dereekb-dbx-web` / `angular-material-m3` / `angular-material-mdc`
 * manifests plus any external manifests declared in `dbx-mcp.config.json`.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { TOKEN_ROLES } from '../manifest/tokens-schema.js';
import type { TokenRegistry } from '../registry/tokens-runtime.js';
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
    '  • `component` — Angular Material component slug ("mat-progress-bar", "mat-button", ...) to surface the relevant MDC tokens;',
    '  • `category` — `"list"` for the full catalog, or `"dbx-web"|"mat-sys"|"mdc"|"app"` to browse one source.',
    '',
    'Returns the recommended `var(--…)` plus light/dark defaults, anti-use notes, the dbx-web utility class or primitive that wraps the underlying token, and any see-also references.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      intent: { type: 'string', description: 'Plain-English intent — what the value is for.' },
      value: { type: 'string', description: 'Raw CSS value to reverse-lookup.' },
      role: { type: 'string', enum: [...TOKEN_ROLES], description: 'Token-role filter.' },
      component: { type: 'string', description: 'Angular Material component slug — narrows the lookup to MDC tokens scoped to that component.' },
      category: { type: 'string', description: '"list" for the full catalog, or "dbx-web"|"mat-sys"|"mdc"|"app" to browse one source.' }
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
 * @param input - the registry the tool reads from
 * @returns a {@link DbxTool} ready to register with the dispatcher
 */
export function createCssTokenLookupTool(input: CreateCssTokenLookupToolInput): DbxTool {
  const { registry } = input;
  const run = (rawArgs: unknown): ToolResult => {
    let args: ResolveTokenInput;
    try {
      args = parseArgs(rawArgs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return toolError(message);
    }
    const result = resolveToken(registry, args);
    const text = formatCssTokenLookup(registry, args, result);
    const tool: ToolResult = { content: [{ type: 'text', text }] };
    return tool;
  };
  return { definition: DBX_CSS_TOKEN_LOOKUP_TOOL, run };
}
