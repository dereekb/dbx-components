/**
 * `dbx_storagefile_m_validate_folder` tool.
 *
 * Validates that the `storagefile/` model folder layout on both the
 * component (`<componentDir>/src/lib/model/storagefile/`) and API
 * (`<apiDir>/src/app/common/model/storagefile/`) sides follows the
 * downstream convention. The API side must contain
 * `storagefile.upload.service.ts`, `storagefile.module.ts`, and
 * `storagefile.init.ts` at minimum. Any `.ts` file that does not start
 * with `storagefile.` (and is not `index.ts`) is flagged as a stray
 * filename. When a `handlers/` subfolder exists at the API root,
 * non-canonical files at root are flagged so handler logic stays
 * inside `handlers/`.
 *
 * Cross-file wiring (whether each declared StorageFilePurpose is
 * reachable from the upload service / processing handler) is checked
 * by the sibling `dbx_storagefile_m_validate_app` tool.
 *
 * Accepts two required inputs:
 *   - `componentDir`: relative path to the `-firebase` component package.
 *   - `apiDir`: relative path to the API app.
 *
 * Paths escaping the cwd are rejected.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type DbxTool } from './types.js';
import { createTwoSideValidateTool } from './validate-tool.js';
import { formatResult, inspectStorageFileFolder, validateStorageFileFolder } from './storagefile-m-validate-folder/index.js';

// MARK: Tool definition
const DBX_STORAGEFILE_M_VALIDATE_FOLDER_TOOL: Tool = {
  name: 'dbx_storagefile_m_validate_folder',
  description: [
    'Validate that the `storagefile/` model folder layout on both the component and API sides follows the downstream convention. The component-side folder lives at `<componentDir>/src/lib/model/storagefile/` and the API-side folder at `<apiDir>/src/app/common/model/storagefile/`.',
    '',
    'API-side required files (errors when missing): `storagefile.upload.service.ts`, `storagefile.module.ts`, `storagefile.init.ts`.',
    '',
    'Layout warnings cover: `.ts` files at the folder root that do not start with `storagefile.` (and are not `index.ts`); and non-canonical files at the API root when a sibling `handlers/` subfolder also exists (suggesting they should move into `handlers/`).',
    '',
    "Barrel rule (error): when an `index.ts` is present at either folder root, every `export * from './X'` clause must resolve locally — to either `./X.ts` or `./X/`.",
    '',
    'Cross-file wiring (whether every declared `StorageFilePurpose` is reachable from the upload service and processing handler) is verified by the sibling `dbx_storagefile_m_validate_app` tool and is not re-checked here.',
    '',
    'Provide both:',
    '- `componentDir`: relative path to the `-firebase` component package (e.g. `components/demo-firebase`).',
    '- `apiDir`: relative path to the API app (e.g. `apps/demo-api`).',
    '',
    'Paths escaping the server cwd are rejected.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      componentDir: {
        type: 'string',
        description: 'Relative path to the `-firebase` component package (e.g. `components/demo-firebase`).'
      },
      apiDir: {
        type: 'string',
        description: 'Relative path to the API app (e.g. `apps/demo-api`).'
      }
    },
    required: ['componentDir', 'apiDir']
  }
};

export const storageFileMValidateFolderTool: DbxTool = createTwoSideValidateTool({
  definition: DBX_STORAGEFILE_M_VALIDATE_FOLDER_TOOL,
  inspectAndValidate: async ({ componentAbs, componentRel, apiAbs, apiRel }) => {
    const inspection = await inspectStorageFileFolder({
      componentRootDir: componentAbs,
      componentRelDir: componentRel,
      apiRootDir: apiAbs,
      apiRelDir: apiRel
    });
    return validateStorageFileFolder(inspection);
  },
  format: formatResult
});
