/**
 * `dbx_model_validate_folder` tool.
 *
 * Validates that one or more model folders follow the canonical layout:
 * every folder must contain `<name>.ts`, `<name>.id.ts`,
 * `<name>.query.ts`, `<name>.action.ts`, `<name>.api.ts`, and
 * `index.ts`. Stray `.ts` files at the folder root that don't start
 * with `<name>.` trigger a warning.
 *
 * Reserved folder names — `system/`, `notification/`, `storagefile/` —
 * emit a warning naming the dedicated validator to use instead and
 * skip structural checks. `system/` is covered by
 * `dbx_system_m_validate_folder`; `notification/` and `storagefile/` are
 * imported from `@dereekb/firebase` and downstream folders extend the
 * canonical group rather than redeclaring it.
 *
 * Accepts two interchangeable input forms (at least one required):
 *   - `paths`: relative folder paths resolved against cwd.
 *   - `glob`: a single glob pattern expanded via `node:fs/promises`;
 *     non-directory matches are filtered out automatically.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type DbxTool } from './types.js';
import { createFolderValidateTool } from './validate-tool.js';
import { formatResult, inspectFolder, validateModelFolders } from './model-validate-folder/index.js';

// MARK: Tool definition
const DBX_MODEL_VALIDATE_FOLDER_TOOL: Tool = {
  name: 'dbx_model_validate_folder',
  description: [
    'Validate that one or more model folders follow the canonical layout. Each folder named `<name>/` must contain `<name>.ts`, `<name>.id.ts`, `<name>.query.ts`, `<name>.action.ts`, `<name>.api.ts`, and `index.ts`. Missing files are hard errors.',
    '',
    'Warnings cover: stray `.ts` files at the folder root that do not start with `<name>.` (they should be grouped under the model prefix), and reserved folder names (`system/`, `notification/`, `storagefile/`) that have dedicated validators and are skipped here.',
    '',
    'Provide at least one of:',
    '- `paths`: array of folder paths (relative to the server cwd).',
    '- `glob`: a glob pattern resolved against the server cwd (e.g. `packages/foo/src/lib/model/*`). Non-directory matches are skipped.',
    '',
    'Paths escaping the cwd are rejected.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      paths: {
        type: 'array',
        description: 'Folder paths (relative to server cwd) to validate.',
        items: { type: 'string' }
      },
      glob: {
        type: 'string',
        description: 'Single glob pattern to expand against the server cwd. Non-directory matches are filtered out.'
      }
    }
  }
};

export const modelValidateFolderTool: DbxTool = createFolderValidateTool({
  definition: DBX_MODEL_VALIDATE_FOLDER_TOOL,
  inspectFolder,
  validate: validateModelFolders,
  format: formatResult
});
