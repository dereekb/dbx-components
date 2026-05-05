/**
 * `dbx_asset_validate_folder` tool.
 *
 * Folder-level validator for the component-side asset catalog: checks
 * that `<componentDir>/src/lib/assets.ts` exists, exports at least one
 * `AssetPathRef` constant or `AssetPathRef[]` aggregator, and that
 * `<componentDir>/src/lib/index.ts` re-exports `./assets`.
 *
 * Cross-app wiring (provider, local file existence) is verified by the
 * sibling `dbx_asset_validate_app` tool.
 *
 * Accepts two required inputs:
 *   - `componentDir`: relative path to the `-firebase` component package.
 *   - `apiDir`: relative path to the Angular app (kept for parity with
 *     the other folder validators — not consulted in folder-level
 *     checks but validated as cwd-bounded).
 *
 * Paths escaping the cwd are rejected.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type DbxTool } from './types.js';
import { createTwoSideValidateTool } from './validate-tool.js';
import { formatResult, inspectAppAssets, validateAssetFolder } from './dbx-asset-validate-folder/index.js';

const DBX_ASSET_VALIDATE_FOLDER_TOOL: Tool = {
  name: 'dbx_asset_validate_folder',
  description: [
    'Validate the component-side asset catalog folder layout. The component must expose `<componentDir>/src/lib/assets.ts` exporting at least one `AssetPathRef` constant or `AssetPathRef[]` aggregator, and `<componentDir>/src/lib/index.ts` must re-export `./assets`.',
    '',
    'Cross-app wiring (provider, local file existence, remote URL prefixes) is verified by the sibling `dbx_asset_validate_app` tool and is not re-checked here.',
    '',
    'Provide:',
    '- `componentDir`: relative path to the `-firebase` component package (e.g. `components/demo-firebase`).',
    '- `apiDir`: relative path to the Angular app (e.g. `apps/demo`). Kept for parity with the other folder validators.',
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
        description: 'Relative path to the Angular app (e.g. `apps/demo`).'
      }
    },
    required: ['componentDir', 'apiDir']
  }
};

export const dbxAssetValidateFolderTool: DbxTool = createTwoSideValidateTool({
  definition: DBX_ASSET_VALIDATE_FOLDER_TOOL,
  inspectAndValidate: async ({ componentAbs, componentRel, apiAbs, apiRel }) => {
    const inspection = await inspectAppAssets(componentAbs, apiAbs);
    return validateAssetFolder(inspection, { componentDir: componentRel, apiDir: apiRel });
  },
  format: formatResult
});
