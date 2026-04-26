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
import { formatResult, validateFirebaseModelSources } from './model-validate/index.js';

// MARK: Tool definition
const DBX_MODEL_VALIDATE_TOOL: Tool = {
  name: 'dbx_model_validate',
  description: [
    'Validate a @dereekb/firebase model file against the workspace model-group convention. Checks that the file exports a `<Group>FirestoreCollections` interface and `<Group>Types` union, and that every `firestoreModelIdentity(...)` has the canonical declarations in order (interface, roles, document class, converter, collection reference fn, collection type, collection fn) — plus the factory-type + collection-group triple for subcollections. All reported issues are hard errors.',
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

export const modelValidateTool: DbxTool = createSourceValidateTool({
  definition: DBX_MODEL_VALIDATE_TOOL,
  validate: validateFirebaseModelSources,
  format: formatResult
});

/**
 * Direct invocation of the `dbx_model_validate` handler. Re-exported so
 * the tool spec can drive the wrapper without going through the MCP
 * dispatcher.
 *
 * @param rawArgs - the unvalidated tool arguments
 * @returns the formatted validation report, or an error result when args fail validation
 */
export const runModelValidate = modelValidateTool.run;
