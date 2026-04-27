/**
 * `dbx_system_m_validate_folder` tool.
 *
 * Validates that one or more `system/` model folders follow the
 * downstream convention. At the folder level: `system.ts` and `index.ts`
 * are required; `system.action.ts` and `system.api.ts` are optional;
 * `system.id.ts` and `system.query.ts` are disallowed. Inside
 * `system.ts`, every `<NAME>_SYSTEM_STATE_TYPE` constant must be paired
 * with an interface `<Foo>SystemData extends SystemStateStoredData` and
 * a converter `<foo>SystemDataConverter` typed
 * `SystemStateStoredDataFieldConverterConfig<<Foo>SystemData>`; the file
 * must end with the aggregate `<app>SystemStateStoredDataConverterMap`
 * whose keys reference each declared type constant.
 *
 * Stray `.ts` files that don't start with `system.` and aren't
 * `index.ts` emit a warning, mirroring `dbx_validate_model_folder`.
 *
 * Accepts two interchangeable input forms (at least one required):
 *   - `paths`: relative folder paths resolved against cwd.
 *   - `glob`: a single glob pattern expanded via `node:fs/promises`;
 *     non-directory matches are filtered out automatically.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type DbxTool } from './types.js';
import { createFolderValidateTool } from './validate-tool.js';
import { formatResult, inspectFolder, validateSystemFolders } from './system-m-validate-folder/index.js';

// MARK: Tool definition
const DBX_SYSTEM_M_VALIDATE_FOLDER_TOOL: Tool = {
  name: 'dbx_system_m_validate_folder',
  description: [
    'Validate that one or more `system/` model folders follow the downstream convention. Each folder must contain `system.ts` and `index.ts` at minimum; `system.action.ts` and `system.api.ts` are optional; `system.id.ts` and `system.query.ts` are disallowed.',
    '',
    'Inside `system.ts`, every `<NAME>_SYSTEM_STATE_TYPE` constant must be paired with an interface `<Foo>SystemData extends SystemStateStoredData` and a converter `<foo>SystemDataConverter` typed `SystemStateStoredDataFieldConverterConfig<<Foo>SystemData>`. The file must end with an aggregate `<app>SystemStateStoredDataConverterMap` whose keys reference each declared type constant.',
    '',
    'Warnings cover: stray `.ts` files at the folder root that do not start with `system.`, converter-map ordering (should be the last top-level export), and bare or unknown identifiers used as converter-map keys.',
    '',
    'Always runs in downstream mode — the base `@dereekb/firebase` system folder ships machinery (`systemStateIdentity`, `SystemStateDocument`, etc.) rather than state-type triples and should not be validated with this tool.',
    '',
    'Provide at least one of:',
    '- `paths`: array of folder paths (relative to the server cwd).',
    '- `glob`: a glob pattern resolved against the server cwd (e.g. `components/foo-firebase/src/lib/model/system`). Non-directory matches are skipped.',
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

export const systemMValidateFolderTool: DbxTool = createFolderValidateTool({
  definition: DBX_SYSTEM_M_VALIDATE_FOLDER_TOOL,
  inspectFolder,
  validate: validateSystemFolders,
  format: formatResult
});
