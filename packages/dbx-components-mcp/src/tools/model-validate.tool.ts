/**
 * `dbx_model_validate` tool.
 *
 * Validates that a @dereekb/firebase model file follows the workspace's
 * model-group convention: a `<Group>FirestoreCollections` interface and
 * `<Group>Types` union declared before the first model, and each model
 * anchored on a `firestoreModelIdentity(...)` call with the canonical
 * ordered set of declarations (identity, interface, roles, document class,
 * converter, reference fn, collection type, collection fn — plus the
 * single-item factory and collection-group triple for subcollections).
 *
 * Accepts three interchangeable input forms (at least one required):
 *   - `sources`: `{ name, text }[]` — file contents supplied by the caller.
 *   - `paths`: relative file paths resolved against cwd.
 *   - `glob`: a single glob pattern expanded via `node:fs/promises` (Node 24+).
 *
 * Returns a markdown report with all violations grouped by file and model.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type DbxTool } from './types.js';
import { createSourceValidateTool } from './validate-tool.js';
import { formatResult, validateFirebaseModelSources, type RuleOptions } from './model-validate/index.js';

// MARK: Tool definition
const DBX_MODEL_VALIDATE_TOOL: Tool = {
  name: 'dbx_model_validate',
  description: [
    'Validate a @dereekb/firebase model file against the workspace model-group convention. Checks that the file exports a `<Group>FirestoreCollections` interface and `<Group>Types` union, and that every `firestoreModelIdentity(...)` has the canonical declarations in order (interface, roles, document class, converter, collection reference fn, collection type, collection fn) — plus the factory-type + collection-group triple for subcollections. Also enforces JSDoc tagging required for catalog discovery and downstream traversal: `@dbxModelGroup <Group>` on the group container, `@dbxModel` on every model interface (with a per-identity `MODEL_IDENTITY_NOT_TAGGED` error anchored at the `firestoreModelIdentity(...)` line), and `@dbxModelVariable <name>` on every persisted field (warning).',
    '',
    'Provide at least one of:',
    '- `sources`: array of `{ name, text }` — file contents supplied directly.',
    '- `paths`: array of file paths (relative to the server cwd).',
    '- `glob`: a glob pattern resolved against the server cwd (e.g. `packages/foo/src/lib/model/**/*.ts`).',
    '',
    'Paths escaping the cwd are rejected.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      sources: {
        type: 'array',
        description: 'File contents to validate directly.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Display name (used in violation messages).' },
            text: { type: 'string', description: 'Full TypeScript source text.' }
          },
          required: ['name', 'text']
        }
      },
      paths: {
        type: 'array',
        description: 'File paths (relative to server cwd) to read and validate.',
        items: { type: 'string' }
      },
      glob: {
        type: 'string',
        description: 'Single glob pattern to expand against the server cwd.'
      }
    }
  }
};

/**
 * Optional inputs to {@link createModelValidateTool}.
 */
export interface CreateModelValidateToolOptions {
  /**
   * Rule overrides resolved from the workspace's `dbx-mcp.config.json`
   * `modelValidate` block. When omitted, the validator falls back to the
   * built-in defaults (see {@link MAX_FIELD_NAME_LENGTH}).
   */
  readonly ruleOptions?: RuleOptions;
}

/**
 * Builds the `dbx_model_validate` tool, optionally injecting rule
 * overrides from the workspace config. The default-options instance is
 * exported as {@link modelValidateTool} below for callers (and tests)
 * that don't need config.
 *
 * @param options - optional rule overrides
 * @returns the registered MCP tool wrapper
 */
export function createModelValidateTool(options: CreateModelValidateToolOptions = {}): DbxTool {
  const { ruleOptions } = options;
  return createSourceValidateTool({
    definition: DBX_MODEL_VALIDATE_TOOL,
    validate: (sources) => validateFirebaseModelSources(sources, ruleOptions),
    format: formatResult
  });
}

export const modelValidateTool: DbxTool = createModelValidateTool();

/**
 * Direct invocation of the `dbx_model_validate` handler. Re-exported so
 * the tool spec can drive the wrapper without going through the MCP
 * dispatcher.
 *
 * @param rawArgs - the unvalidated tool arguments
 * @returns the formatted validation report, or an error result when args fail validation
 */
export const runModelValidate = modelValidateTool.run;
